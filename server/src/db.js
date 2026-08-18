// SQLite storage via Node's built-in `node:sqlite` module (Node >= 22.5).
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './passwords.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.ARKOJ_DATA_DIR || path.join(__dirname, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const DB_PATH = path.join(DATA_DIR, 'arkoj.db')
export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS problems (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    code          TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    input_format  TEXT NOT NULL DEFAULT '',
    output_format TEXT NOT NULL DEFAULT '',
    samples       TEXT NOT NULL DEFAULT '[]',
    hint          TEXT NOT NULL DEFAULT '',
    difficulty    TEXT NOT NULL DEFAULT '入门',
    time_limit    INTEGER NOT NULL DEFAULT 1000,
    memory_limit  INTEGER NOT NULL DEFAULT 256,
    tags          TEXT NOT NULL DEFAULT '[]',
    source        TEXT NOT NULL DEFAULT '',
    accepted      INTEGER NOT NULL DEFAULT 0,
    submitted     INTEGER NOT NULL DEFAULT 0,
    author_id     INTEGER REFERENCES users(id),
    is_public     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_problems_diff ON problems(difficulty);
  CREATE INDEX IF NOT EXISTS idx_problems_public ON problems(is_public);

  CREATE TABLE IF NOT EXISTS test_cases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    input       TEXT NOT NULL DEFAULT '',
    output      TEXT NOT NULL DEFAULT '',
    is_sample   INTEGER NOT NULL DEFAULT 0,
    score       INTEGER NOT NULL DEFAULT 0,
    ord         INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_tc_problem ON test_cases(problem_id);

  CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    language    TEXT NOT NULL,
    code        TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'Pending',
    time_ms     INTEGER,
    memory_kb   INTEGER,
    score       INTEGER NOT NULL DEFAULT 0,
    detail      TEXT NOT NULL DEFAULT '',
    contest_id  INTEGER REFERENCES contests(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sub_user ON submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sub_problem ON submissions(problem_id);
  CREATE INDEX IF NOT EXISTS idx_sub_created ON submissions(created_at);

  CREATE TABLE IF NOT EXISTS problem_lists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS problem_list_items (
    list_id     INTEGER NOT NULL REFERENCES problem_lists(id) ON DELETE CASCADE,
    problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    ord         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (list_id, problem_id)
  );

  CREATE TABLE IF NOT EXISTS contests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    rule        TEXT NOT NULL DEFAULT 'ACM',
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    is_public   INTEGER NOT NULL DEFAULT 1,
    created_by  INTEGER REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contest_problems (
    contest_id  INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    problem_id  INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    score       INTEGER NOT NULL DEFAULT 100,
    ord         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (contest_id, problem_id)
  );

  CREATE TABLE IF NOT EXISTS contest_registrations (
    contest_id    INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    registered_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (contest_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS discussions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id  INTEGER REFERENCES problems(id) ON DELETE SET NULL,
    pinned      INTEGER NOT NULL DEFAULT 0,
    replies     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discussion_replies (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    discussion_id   INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    author_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)

// Migrate older databases: add profile columns when missing.
function ensureColumn(table, column, ddl) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    console.log(`[arkoj] migrated ${table}: added column ${column}`)
  }
}
ensureColumn('users', 'nickname', 'nickname TEXT')
ensureColumn('users', 'avatar', 'avatar TEXT')
ensureColumn('users', 'bio', 'bio TEXT')

// Seed an admin account on first boot so the system is immediately usable.
function seedAdmin() {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
  if (exists) return exists.id
  const { salt, hash } = hashPassword(process.env.ARKOJ_ADMIN_PASSWORD || 'admin123')
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role, nickname, bio) VALUES (?, ?, ?, ?, ?)')
    .run('admin', `${salt}:${hash}`, 'admin', 'Ark Admin', 'ArkOJ 系统管理员')
  console.log('[arkoj] seeded admin account: admin / admin123 (change it after first login)')
  return Number(info.lastInsertRowid)
}

function seedProblems(adminId) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM problems').get().c
  if (count > 0) return

  const insertProblem = db.prepare(`
    INSERT INTO problems
      (code, title, description, input_format, output_format, samples, hint,
       difficulty, time_limit, memory_limit, tags, source, author_id, accepted, submitted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertTc = db.prepare(`
    INSERT INTO test_cases (problem_id, input, output, is_sample, score, ord)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const problems = [
    {
      code: 'A001',
      title: 'A+B Problem',
      description:
        '这是一道经典的入门题。\n\n给定两个整数 $A$ 和 $B$，请你计算 $A + B$ 的值。\n\n这道题用于验证你的提交环境是否工作正常。',
      input_format: '一行两个整数 $A$ 和 $B$（$-10^9 \\le A, B \\le 10^9$），以空格分隔。',
      output_format: '输出一个整数，表示 $A + B$ 的结果。',
      samples: [
        { input: '1 2', output: '3' },
        { input: '-5 8', output: '3' },
      ],
      hint: '注意整数范围，使用 64 位整数更稳妥。',
      difficulty: '入门',
      tags: ['基础', '模拟'],
      source: 'ArkOJ Tutorial',
      tests: [
        { input: '1 2', output: '3', sample: 1 },
        { input: '-5 8', output: '3', sample: 1 },
        { input: '0 0', output: '0', sample: 0 },
        { input: '1000000000 1000000000', output: '2000000000', sample: 0 },
        { input: '-1 -1', output: '-2', sample: 0 },
      ],
    },
    {
      code: 'A002',
      title: '最大公约数',
      description: '给定两个正整数 $A$ 和 $B$，求它们的最大公约数 $\\gcd(A, B)$。',
      input_format: '一行两个正整数 $A$ 和 $B$（$1 \\le A, B \\le 10^9$）。',
      output_format: '输出一个整数，表示 $\\gcd(A, B)$。',
      samples: [{ input: '12 18', output: '6' }],
      hint: '欧几里得算法：gcd(a,b) = gcd(b, a mod b)。',
      difficulty: '入门',
      tags: ['数学', '数论'],
      source: 'ArkOJ Tutorial',
      tests: [
        { input: '12 18', output: '6', sample: 1 },
        { input: '7 13', output: '1', sample: 0 },
        { input: '100 25', output: '25', sample: 0 },
        { input: '1 1', output: '1', sample: 0 },
      ],
    },
    {
      code: 'A017',
      title: '不稳定的排序系统',
      description:
        '给定 $n$ 个整数，请你将它们按升序排序后输出。\n\n注意：数据规模可能较大，请选择合适的排序算法。',
      input_format:
        '第一行一个整数 $n$（$1 \\le n \\le 10^5$）。\n第二行 $n$ 个整数 $a_i$（$|a_i| \\le 10^9$）。',
      output_format: '一行 $n$ 个整数，表示排序后的序列，以空格分隔。',
      samples: [{ input: '5\n3 1 4 1 5', output: '1 1 3 4 5' }],
      hint: 'n 可达 1e5，请使用 O(n log n) 算法。',
      difficulty: '进阶',
      tags: ['排序', '数据结构'],
      source: 'ArkOJ Round #1',
      tests: [
        { input: '5\n3 1 4 1 5', output: '1 1 3 4 5', sample: 1 },
        { input: '1\n42', output: '42', sample: 0 },
        { input: '4\n-1 0 -3 2', output: '-3 -1 0 2', sample: 0 },
      ],
    },
    {
      code: 'B101',
      title: '括号匹配',
      description:
        '给定一个只包含 `()` `[]` `{}` 的字符串，判断括号是否合法匹配。\n\n合法的定义：每个右括号都能找到与之对应的左括号，且类型相同，嵌套正确。',
      input_format: '一行一个字符串 $s$（$1 \\le |s| \\le 10^5$）。',
      output_format: '如果合法输出 `Yes`，否则输出 `No`。',
      samples: [
        { input: '()[]{}', output: 'Yes' },
        { input: '([)]', output: 'No' },
      ],
      hint: '使用栈模拟即可。',
      difficulty: '进阶',
      tags: ['栈', '字符串'],
      source: 'ArkOJ Round #2',
      tests: [
        { input: '()[]{}', output: 'Yes', sample: 1 },
        { input: '([)]', output: 'No', sample: 1 },
        { input: '((()))', output: 'Yes', sample: 0 },
        { input: '(', output: 'No', sample: 0 },
        { input: '', output: 'Yes', sample: 0 },
      ],
    },
    {
      code: 'B204',
      title: '轨道网络的最短路径',
      description:
        '太空站之间由 $m$ 条双向轨道连接，构成一张无向加权图。\n\n给定起点 $s$ 与终点 $t$，求从 $s$ 到 $t$ 的最短路径长度。保证图连通。',
      input_format:
        '第一行四个整数 $n, m, s, t$（$2 \\le n \\le 10^5$，$n-1 \\le m \\le 2 \\cdot 10^5$，$1 \\le s, t \\le n$）。\n接下来 $m$ 行，每行三个整数 $u, v, w$，表示 $u$ 与 $v$ 之间有一条长度为 $w$ 的轨道（$1 \\le w \\le 10^9$）。',
      output_format: '输出一个整数，表示最短路径长度。',
      samples: [
        {
          input: '4 4 1 4\n1 2 3\n2 4 4\n1 3 5\n3 4 1',
          output: '6',
        },
      ],
      hint: 'Dijkstra + 优先队列。注意边权较大，距离请使用 64 位整数。',
      difficulty: '困难',
      tags: ['图论', '最短路', 'Dijkstra'],
      source: 'ArkOJ Finals',
      tests: [
        {
          input: '4 4 1 4\n1 2 3\n2 4 4\n1 3 5\n3 4 1',
          output: '6',
          sample: 1,
        },
        {
          input: '2 1 1 2\n1 2 10',
          output: '10',
          sample: 0,
        },
      ],
    },
    {
      code: 'C301',
      title: '动态规划：最长上升子序列',
      description:
        '给定长度为 $n$ 的整数序列 $a_1, a_2, \\ldots, a_n$，求最长严格上升子序列的长度。',
      input_format:
        '第一行一个整数 $n$（$1 \\le n \\le 10^5$）。\n第二行 $n$ 个整数 $a_i$（$|a_i| \\le 10^9$）。',
      output_format: '输出一个整数，表示 LIS 的长度。',
      samples: [{ input: '6\n1 3 2 4 3 5', output: '4' }],
      hint: '经典 O(n log n) 做法：维护一个递增的 tail 数组。',
      difficulty: '困难',
      tags: ['DP', '二分'],
      source: 'ArkOJ DP Series',
      tests: [
        { input: '6\n1 3 2 4 3 5', output: '4', sample: 1 },
        { input: '1\n1', output: '1', sample: 0 },
        { input: '5\n5 4 3 2 1', output: '1', sample: 0 },
      ],
    },
  ]

  for (const p of problems) {
    const info = insertProblem.run(
      p.code,
      p.title,
      p.description,
      p.input_format,
      p.output_format,
      JSON.stringify(p.samples),
      p.hint,
      p.difficulty,
      1000,
      256,
      JSON.stringify(p.tags),
      p.source,
      adminId,
      Math.floor(Math.random() * 300) + 40,
      Math.floor(Math.random() * 400) + 350,
    )
    const pid = Number(info.lastInsertRowid)
    p.tests.forEach((t, i) => {
      insertTc.run(pid, t.input, t.output, t.sample ? 1 : 0, 0, i)
    })
  }
  console.log(`[arkoj] seeded ${problems.length} problems`)
}

function seedLists(adminId) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM problem_lists').get().c
  if (count > 0) return

  const listInfo = db
    .prepare(
      `INSERT INTO problem_lists (title, description, owner_id, is_public)
       VALUES (?, ?, ?, 1)`,
    )
    .run(
      '新手村训练计划',
      '从零开始的算法入门路线：基础运算 → 数论 → 数据结构。建议按顺序完成。',
      adminId,
    )
  const listId = Number(listInfo.lastInsertRowid)

  const list2 = db
    .prepare(
      `INSERT INTO problem_lists (title, description, owner_id, is_public)
       VALUES (?, ?, ?, 1)`,
    )
    .run(
      '图论专题精选',
      '覆盖最短路、拓扑、并查集等高频图论考点，适合进阶选手刷题。',
      adminId,
    )
  const list2Id = Number(list2.lastInsertRowid)

  const codes1 = ['A001', 'A002', 'A017', 'B101']
  const codes2 = ['B204', 'C301']
  const getPid = db.prepare('SELECT id FROM problems WHERE code = ?')
  const addItem = db.prepare(
    'INSERT INTO problem_list_items (list_id, problem_id, ord) VALUES (?, ?, ?)',
  )

  codes1.forEach((c, i) => {
    const row = getPid.get(c)
    if (row) addItem.run(listId, row.id, i)
  })
  codes2.forEach((c, i) => {
    const row = getPid.get(c)
    if (row) addItem.run(list2Id, row.id, i)
  })
  console.log('[arkoj] seeded problem lists')
}

function seedContests(adminId) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM contests').get().c
  if (count > 0) return

  const now = Date.now()
  const fmt = (ms) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19)

  // Ongoing contest
  const c1 = db
    .prepare(
      `INSERT INTO contests (title, description, rule, start_at, end_at, is_public, created_by)
       VALUES (?, ?, 'ACM', ?, ?, 1, ?)`,
    )
    .run(
      'ArkOJ 全面测试赛 #1',
      '系统上线后的第一次公开赛。规则：ACM 计时罚时，每题错误提交 +20 分钟。欢迎所有人参加。',
      fmt(now - 2 * 3600_000),
      fmt(now + 6 * 3600_000),
      adminId,
    )
  const c1Id = Number(c1.lastInsertRowid)

  // Upcoming
  const c2 = db
    .prepare(
      `INSERT INTO contests (title, description, rule, start_at, end_at, is_public, created_by)
       VALUES (?, ?, 'OI', ?, ?, 1, ?)`,
    )
    .run(
      '周末算法联赛 Round 3',
      'OI 赛制，每题部分分，以最后一次有效提交计分。比赛结束后公开榜单与题解。',
      fmt(now + 2 * 24 * 3600_000),
      fmt(now + 2 * 24 * 3600_000 + 5 * 3600_000),
      adminId,
    )
  const c2Id = Number(c2.lastInsertRowid)

  // Ended
  const c3 = db
    .prepare(
      `INSERT INTO contests (title, description, rule, start_at, end_at, is_public, created_by)
       VALUES (?, ?, 'ACM', ?, ?, 1, ?)`,
    )
    .run(
      'ArkOJ 入门邀请赛',
      '面向新手的友谊赛，已结束。可查看历史榜单与题目。',
      fmt(now - 10 * 24 * 3600_000),
      fmt(now - 10 * 24 * 3600_000 + 3 * 3600_000),
      adminId,
    )
  const c3Id = Number(c3.lastInsertRowid)

  const getPid = db.prepare('SELECT id FROM problems WHERE code = ?')
  const addCp = db.prepare(
    'INSERT INTO contest_problems (contest_id, problem_id, label, score, ord) VALUES (?, ?, ?, ?, ?)',
  )

  ;[
    [c1Id, ['A001', 'A002', 'A017', 'B101'], 100],
    [c2Id, ['B204', 'C301', 'B101'], 100],
    [c3Id, ['A001', 'A002'], 100],
  ].forEach(([cid, codes, score]) => {
    codes.forEach((code, i) => {
      const row = getPid.get(code)
      if (row) addCp.run(cid, row.id, String.fromCharCode(65 + i), score, i)
    })
  })

  // Register admin into ongoing contest
  db.prepare(
    'INSERT OR IGNORE INTO contest_registrations (contest_id, user_id) VALUES (?, ?)',
  ).run(c1Id, adminId)

  console.log('[arkoj] seeded contests')
}

function seedDiscussions(adminId) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM discussions').get().c
  if (count > 0) return

  const a001 = db.prepare('SELECT id FROM problems WHERE code = ?').get('A001')
  db.prepare(
    `INSERT INTO discussions (title, body, author_id, problem_id, pinned, replies)
     VALUES (?, ?, ?, ?, 1, 0)`,
  ).run(
    '欢迎来到 ArkOJ 讨论区',
    '在这里分享题解、提问与竞赛经验。请保持友善，禁止剧透未结束比赛的题目。',
    adminId,
    null,
  )
  db.prepare(
    `INSERT INTO discussions (title, body, author_id, problem_id, pinned, replies)
     VALUES (?, ?, ?, ?, 0, 0)`,
  ).run(
    'A001 题解：一行搞定',
    '大多数语言都可以直接读入两个整数并输出它们的和。注意边界：A、B 可达 1e9。',
    adminId,
    a001?.id ?? null,
  )
  console.log('[arkoj] seeded discussions')
}

const adminId = seedAdmin()
seedProblems(adminId)
seedLists(adminId)
seedContests(adminId)
seedDiscussions(adminId)
