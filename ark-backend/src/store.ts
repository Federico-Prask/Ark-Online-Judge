import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { problems as staticProblems, type Problem as ProblemRec } from './problems.js'
import {
  readMeta,
  writeMeta,
  listProblemIds,
  readDesc,
  writeDesc,
  writeTestsInline,
  writeInteractor,
  readInteractor,
  readPairEntries,
  recognizeTests,
  readTestsMeta,
  type ProblemMeta,
} from './problemsfs.js'

export type { ProblemRec }

export const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

// 无状态会话：HMAC 签名 token，不入库 —— 环境重置/回滚后依然有效
const TOKEN_SECRET = 'arkoj-mvp-hmac-secret'
const TOKEN_TTL = 30 * 864e5 // 30 天

export function issueToken(name: string): string {
  const payload = Buffer.from(JSON.stringify({ n: name, e: Date.now() + TOKEN_TTL })).toString('base64url')
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export const newToken = () => crypto.randomBytes(24).toString('hex')

export const ALL_PERMS = ['enter', 'discuss', 'admin_admin', 'contest', 'user_perms', 'problem']
// 普通用户默认（可移除）
export const DEFAULT_PERMS = ['enter', 'discuss']

// ---------------- 持久化（JSON 文件，抽象层可换 SQLite） ----------------

export type Verdict = 'AC' | 'WA' | 'TLE' | 'CE' | 'JUDGING' | 'CANCELLED'

export interface TestPointResult {
  idx: number
  status: 'AC' | 'WA' | 'TLE'
  ms: number
}
export interface SubtaskResult {
  idx: number
  score: number
  full: number
  points: TestPointResult[]
}
export interface Detail {
  score: number
  ms: number
  subtasks: SubtaskResult[]
  passed: number
  total: number
  ceLog?: string
}
export interface Submission {
  id: number
  pid: string
  user: string
  lang: string
  verdict: Verdict
  time: string
  date: string
  ts: number // epoch ms，比赛排名用
  cid?: string
  code?: string // 保存源码，管理员重测用
  opt?: string // 优化选项 O0..Ofast
  detail?: Detail
}

export type ThreadCategory = 'announce' | 'help' | 'solution' | 'water'

export interface Thread {
  id: number
  title: string
  author: string
  ts: number
  content: string
  category: ThreadCategory
  replies: { id: number; author: string; ts: number; content: string }[]
}

export interface Contest {
  id: string
  title: string
  mode: 'ACM' | 'OI'
  start: number
  end: number
  problems: string[]
  freezeMin: number // 封榜：结束前 N 分钟的提交对公众隐藏
}

export interface SiteSettings {
  new_access: boolean // 新用户默认是否能进入 OJ
  inv_needed: boolean // 注册是否需要邀请码
  inv_code: string // 邀请码
}

interface UserStat {
  a: number // 总尝试
  t?: number // AC 后冻结为首次 AC 时的尝试数
  ac: boolean
}
interface ProblemStat {
  seedAc: number
  seedSumT: number
  users: Record<string, UserStat>
}
export interface UserRec {
  uid: number
  name: string
  pass: string // sha256
  email: string
  bio: string
  school: string
  reg: string
  role: 'admin' | 'user'
  perms: string[] // 可多选：problem / discussion / contest / user
}
interface DB {
  seq: number
  threadSeq: number
  subs: Submission[]
  stats: Record<string, ProblemStat>
  users: Record<string, UserRec>
  tokens: Record<string, string>
  uidSeq: number
  contests: Contest[]
  problems?: ProblemRec[] // 仅旧库迁移用，迁移后删除
  discussions: Thread[]
  settings: SiteSettings
}

const DB_PATH = path.resolve(import.meta.dirname, '../data/db.json')

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 种子用户：与前端展示口径一致（每人 t 依定义生成） */
function seedStats(): Record<string, ProblemStat> {
  const stats: Record<string, ProblemStat> = {}
  for (const p of staticProblems) {
    const rnd = mulberry32(parseInt(p.id.slice(1), 10) * 104729 + 7)
    const users = Math.max(30, Math.round(p.submitted / 1.7))
    const acUsers = Math.min(p.ac, users)
    let sumT = 0
    for (let i = 0; i < users; i++) sumT += 1 + Math.floor(rnd() * 3)
    stats[p.id] = { seedAc: acUsers, seedSumT: sumT, users: {} }
  }
  return stats
}

function seedThreads(): Thread[] {
  const now = Date.now()
  const H = 3600e3
  return [
    {
      id: 1, title: '评测集群扩容完成，峰值排队降至 3s', author: 'admin', ts: now - 1 * H,
      content: '新增两台评测节点，C++ 编译并发提升。祝各位 AC 愉快。',
      category: 'announce', replies: [],
    },
    {
      id: 2, title: '题解｜P1007 轨道测绘的三种做法', author: '北落师门', ts: now - 2 * H,
      content: 'Dijkstra 裸跑即可。注意不可达输出 -1。\n进阶可以写 SPFA 或 01BFS 变种对比耗时。',
      category: 'solution',
      replies: [{ id: 1, author: 'admin', ts: now - 1 * H, content: '补一个：邻接表比矩阵快一个数量级。' }],
    },
    {
      id: 3, title: '求问 P1019 为什么卡常？附代码', author: '向渊行者', ts: now - 26 * H,
      content: '线段树加了懒标记还是 TLE 一个点，求指点。',
      category: 'help', replies: [],
    },
    {
      id: 4, title: '关于 ArkOJ —— 为算法竞赛人而建', author: 'admin', ts: now - 48 * H,
      content:
        'ArkOJ 是一个为算法竞赛人而建的在线评测平台。\n克制的界面、快速的评测、干净的题面——把一切注意力留给题目本身。\n// FOCUS ON THE PROBLEM.\n// NOTHING ELSE.',
      category: 'announce', replies: [],
    },
  ]
}

/** 种子赛事：进行中 / 即将开始 / 已结束 各一 */
function seedContests(): Contest[] {
  const now = Date.now()
  const H = 3600e3
  const D = 24 * H
  return [
    { id: 'C001', title: '周末新手赛 #12', mode: 'ACM', start: now - 1 * H, end: now + 2 * H, problems: ['P1001', 'P1002', 'P1036'], freezeMin: 30 },
    { id: 'C002', title: '双周算法挑战赛 #08', mode: 'OI', start: now + 2 * D, end: now + 2 * D + 3 * H, problems: ['P1007', 'P1024', 'P1042'], freezeMin: 30 },
    { id: 'C003', title: 'ArkOJ 月赛 #04', mode: 'ACM', start: now - 3 * D, end: now - 3 * D + 3 * H, problems: ['P1018', 'P1031'], freezeMin: 30 },
  ]
}

function load(): DB {
  let base: DB
  try {
    base = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')) as DB
  } catch {
    base = { seq: 48213, subs: [], stats: seedStats(), users: {}, tokens: {}, uidSeq: 10000 }
  }
  // 旧库迁移：补用户表
  base.users ??= {}
  base.tokens ??= {}
  base.uidSeq ??= 10000
  base.contests ??= seedContests()
  base.problems ??= staticProblems.map((p) => ({ ...p }))
  base.discussions ??= seedThreads()
  base.threadSeq ??= 100
  for (const t of base.discussions) {
    if (!t.category) {
      t.category = t.title.startsWith('题解') ? 'solution' : t.title.includes('求问') ? 'help' : t.title.includes('扩容') ? 'announce' : 'water'
    }
  }
  base.settings ??= { new_access: true, inv_needed: false, inv_code: '' }
  for (const s of base.subs) s.ts ??= 0

  // 旧库迁移：题目全部落盘 data/[pid]/，db.json 不再存题目
  if (base.problems && base.problems.length > 0) {
    for (const p of base.problems) {
      if (!readMeta(p.id)) {
        writeMeta(p.id, {
          id: p.id,
          title: p.title,
          base: p.base,
          tags: p.tags,
          tl: p.tl,
          ac: p.ac ?? 0,
          submitted: p.submitted ?? 0,
          visibility: p.visibility,
          interactive: p.interactive,
        })
      }
      if (!readDesc(p.id) && (p.statement ?? []).length > 0) {
        writeDesc(p.id, {
          description: (p.statement ?? []).join('\n\n'),
          input: p.input,
          output: p.output,
          samples: (p.samples ?? []).map((s) => ({ in: s.input, out: s.output })),
        })
      }
      if (readPairEntries(p.id).length === 0 && (p.tests ?? []).length > 0) {
        writeTestsInline(p.id, p.tests ?? [])
      }
      if (p.interactor && !readInteractor(p.id)) writeInteractor(p.id, p.interactor)
      if (!readTestsMeta(p.id)) recognizeTests(p.id)
    }
    delete base.problems
  }
  // 静态种子（全新库）也落盘
  if (listProblemIds().length === 0) {
    for (const p of staticProblems) {
      writeMeta(p.id, {
        id: p.id,
        title: p.title,
        base: p.base,
        tags: p.tags,
        tl: p.tl,
        ac: p.ac,
        submitted: p.submitted,
        visibility: p.visibility,
        interactive: p.interactive,
      })
      writeDesc(p.id, {
        description: p.statement.join('\n\n'),
        input: p.input,
        output: p.output,
        samples: p.samples.map((s) => ({ in: s.input, out: s.output })),
      })
      writeTestsInline(p.id, p.tests)
      if (p.interactor) writeInteractor(p.id, p.interactor)
      recognizeTests(p.id)
    }
  }
  for (const u of Object.values(base.users)) {
    u.role ??= 'user'
    if (u.name === 'admin') u.role = 'admin'
    // 迁移旧版权限键：admin 全量，其余回到默认
    if (!u.perms || u.perms.length === 0 || u.perms.some((p) => !ALL_PERMS.includes(p))) {
      u.perms = u.name === 'admin' ? [...ALL_PERMS] : [...DEFAULT_PERMS]
    }
  }
  if (!base.users['admin']) {
    base.users['admin'] = {
      uid: ++base.uidSeq,
      name: 'admin',
      pass: hash('admin123'),
      email: 'admin@arkoj.dev',
      bio: '为算法竞赛人而建。',
      school: 'Ark 理工学院',
      reg: '2026.01.01',
      role: 'admin',
      perms: [...ALL_PERMS],
    }
  }
  return base
}

const db = load()
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

// ---------------- 通过率 / 评级（按定义：rate = AC人数 / Σt） ----------------

export function passRate(pid: string): number {
  const st = db.stats[pid]
  const extra = liveProblemExtra(pid)
  const ac = (st?.seedAc ?? 0) + extra.ac
  const sumT = (st?.seedSumT ?? 0) + extra.sumT
  return sumT === 0 ? 0 : ac / sumT
}

function delta(pct: number): number {
  if (pct >= 85) return -0.3
  if (pct >= 70) return -0.2
  if (pct >= 55) return -0.1
  if (pct >= 45) return 0
  if (pct >= 30) return 0.1
  if (pct >= 20) return 0.2
  if (pct >= 10) return 0.3
  return 0.4
}

export function rating(pid: string, base: number): number {
  const pct = Math.round(passRate(pid) * 100)
  return Math.round(Math.min(8, Math.max(1, base + delta(pct))) * 10) / 10
}

// ---------------- 提交 ----------------

export function nextId() {
  return ++db.seq
}

export function addSubmission(sub: Submission) {
  db.subs.unshift(sub)
  save()
}

/** 判题完成后登记尝试统计（t 定义：首次 AC 及以前的尝试数） */
export function registerAttempt(pid: string, user: string, verdict: Verdict) {
  const st = db.stats[pid]
  if (!st) return
  const u = (st.users[user] ??= { a: 0, ac: false })
  u.a++
  if (verdict === 'AC' && !u.ac) {
    u.ac = true
    u.t = u.a
  }
  save()
}

export const allSubs = () => db.subs
export const subById = (id: number) => db.subs.find((s) => s.id === id)

// ---------------- 用户 ----------------

export function findUser(name: string): UserRec | undefined {
  return db.users[name]
}

export function createUser(name: string, pass: string): UserRec {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const rec: UserRec = {
    uid: ++db.uidSeq,
    name,
    pass: hash(pass),
    email: '',
    bio: '',
    school: '',
    reg: `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`,
    role: 'user',
    perms: [...DEFAULT_PERMS],
  }
  db.users[name] = rec
  save()
  return rec
}

export function userByToken(t: string): UserRec | undefined {
  const [payload, sig] = String(t).split('.')
  if (!payload || !sig) return undefined
  const expect = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  if (sig !== expect) return undefined
  try {
    const { n, e } = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { n: string; e: number }
    if (typeof n !== 'string' || typeof e !== 'number' || Date.now() > e) return undefined
    return db.users[n]
  } catch {
    return undefined
  }
}

export function updateUser(name: string, patch: Partial<Pick<UserRec, 'email' | 'bio' | 'school'>>) {
  const u = db.users[name]
  if (!u) return
  Object.assign(u, patch)
  save()
}

export function changePass(name: string, newPass: string) {
  const u = db.users[name]
  if (!u) return
  u.pass = hash(newPass)
  save()
}

/** 管理员修改用户角色 / 权限 */
export function setUserAdmin(name: string, patch: { role?: 'admin' | 'user'; perms?: string[] }) {
  const u = db.users[name]
  if (!u) return
  if (patch.role) u.role = patch.role
  if (patch.perms) u.perms = patch.perms.filter((p) => ALL_PERMS.includes(p))
  save()
}

export const allUsers = () => Object.values(db.users)

export function deleteUser(name: string) {
  delete db.users[name]
  save()
}

// ---------------- 清除假数据 ----------------
export function purgeUsers(keepName: string) {
  for (const name of Object.keys(db.users)) {
    if (name !== keepName) delete db.users[name]
  }
  save()
}

export function purgeSubs() {
  db.subs = []
  save()
}

// ---------------- 站点设置 ----------------
export const getSettings = () => db.settings
export function setSettings(patch: Partial<SiteSettings>) {
  Object.assign(db.settings, patch)
  save()
  return db.settings
}

// ---------------- 题目（元数据在 data/[pid]/problem.json） ----------------
export const allProblems = (): ProblemMeta[] =>
  listProblemIds()
    .map(readMeta)
    .filter((x): x is ProblemMeta => !!x)

export const problemByIdS = (id: string) => readMeta(id)

export function addProblem(m: ProblemMeta) {
  writeMeta(m.id, m)
}

export function updateProblem(id: string, patch: Partial<ProblemMeta>) {
  const m = readMeta(id)
  if (!m) return
  writeMeta(id, { ...m, ...patch, id }) // id 不可改
}

// ---------------- 讨论 ----------------
export const allThreads = () => [...db.discussions].sort((a, b) => b.ts - a.ts)
export const threadById = (id: number) => db.discussions.find((t) => t.id === id)

export function addThread(title: string, author: string, content: string, category: ThreadCategory = 'water'): Thread {
  const t: Thread = { id: ++db.threadSeq, title, author, ts: Date.now(), content, category, replies: [] }
  db.discussions.push(t)
  save()
  return t
}

export function addReply(tid: number, author: string, content: string) {
  const t = threadById(tid)
  if (!t) return undefined
  const r = { id: (t.replies.at(-1)?.id ?? 0) + 1, author, ts: Date.now(), content }
  t.replies.push(r)
  save()
  return t
}

export function deleteThread(tid: number) {
  db.discussions = db.discussions.filter((t) => t.id !== tid)
  save()
}

export function deleteReply(tid: number, rid: number) {
  const t = threadById(tid)
  if (!t) return
  t.replies = t.replies.filter((r) => r.id !== rid)
  save()
}

// ---------------- 比赛 ----------------
export const allContests = () => [...db.contests].sort((a, b) => b.start - a.start)
export const contestById = (id: string) => db.contests.find((c) => c.id === id)

export function addContest(c: Omit<Contest, 'id'>): Contest {
  const id = `C${String(db.contests.length + 1).padStart(3, '0')}${Date.now() % 97}`
  const rec: Contest = { ...c, id }
  db.contests.push(rec)
  save()
  return rec
}

export function deleteContest(id: string) {
  db.contests = db.contests.filter((c) => c.id !== id)
  save()
}

export const contestSubs = (cid: string) => db.subs.filter((s) => s.cid === cid)

/** 比赛结束 → 其「比赛」可见性题目自动转公开（惰性同步） */
export function syncContestVisibility() {
  const now = Date.now()
  let changed = false
  for (const c of db.contests) {
    if (now <= c.end) continue
    for (const pid of c.problems) {
      const p = readMeta(pid)
      if (p && p.visibility === 'contest') {
        p.visibility = 'public'
        writeMeta(pid, p)
        changed = true
      }
    }
  }
  if (changed) save()
}

const COUNTED: Verdict[] = ['AC', 'WA', 'TLE', 'CE'] // CANCELLED/JUDGING 不计入任何统计

/** 用户维度统计：全部从提交记录实时推导（重测/取消自动一致） */
export function userStats(name: string) {
  const mine = db.subs.filter((s) => s.user === name && COUNTED.includes(s.verdict))
  const solved = [...new Set(mine.filter((s) => s.verdict === 'AC').map((s) => s.pid))].sort()
  const dates = [...new Set(mine.map((s) => s.date))].sort().reverse()
  let streak = 0
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  for (;;) {
    const key = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
    if (dates.includes(key)) {
      streak++
      d.setDate(d.getDate() - 1)
    } else if (streak === 0 && isToday(d)) {
      d.setDate(d.getDate() - 1) // 今天还没提交不算断
      continue
    } else break
  }
  const submits = mine.length
  return {
    solved,
    submits,
    rating: 1200 + solved.length * 6 + Math.min(300, submits),
    streak,
  }
}

function isToday(d: Date) {
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

/** 题目维度的"活"统计（种子 + 实时提交，t 定义不变） */
export function liveProblemExtra(pid: string) {
  const byUser = new Map<string, Submission[]>()
  for (const s of db.subs) {
    if (s.pid !== pid || !COUNTED.includes(s.verdict)) continue
    const arr = byUser.get(s.user) ?? []
    arr.push(s)
    byUser.set(s.user, arr)
  }
  let ac = 0
  let sumT = 0
  let subCount = 0
  for (const list of byUser.values()) {
    const sorted = [...list].sort((a, b) => a.id - b.id)
    subCount += sorted.length
    const iAc = sorted.findIndex((s) => s.verdict === 'AC')
    if (iAc >= 0) {
      ac++
      sumT += iAc + 1
    } else {
      sumT += sorted.length
    }
  }
  return { ac, sumT, subCount }
}
