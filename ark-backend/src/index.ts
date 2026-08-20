import express from 'express'
import { judge } from './judge.js'
import { DEFAULT_OPT, LANG_CATALOG, langInfo, optOf, specOf } from './catalog.js'
import {
  descPath,
  extOf,
  extractZip,
  SUBS_DIR,
  hasChecker,
  hasInteractor,
  listTestFiles,
  readDesc,
  readInteractor,
  recognizeTests,
  readTestsMeta,
  readResult,
  readSubSource,
  writeDesc,
  writeInteractor,
  writeResult,
  writeSubSource,
  type DescriptionJSON,
} from './problemsfs.js'
import {
  addContest,
  addSubmission,
  ALL_PERMS,
  allContests,
  allSubs,
  allUsers,
  changePass,
  contestById,
  contestSubs,
  createUser,
  deleteContest,
  deleteUser,
  findUser,
  addProblem,
  addReply,
  addThread,
  allProblems,
  allThreads,
  deleteReply,
  deleteThread,
  hash,
  issueToken,
  liveProblemExtra,
  nextId,
  passRate,
  problemByIdS,
  rating,
  getSettings,
  purgeSubs,
  purgeUsers,
  setSettings,
  setUserAdmin,
  syncContestVisibility,
  subById,
  threadById,
  updateProblem,
  updateUser,
  userByToken,
  userStats,
  type Contest,
  type ProblemMeta,
  type Submission,
} from './store.js'

const app = express()
app.use(express.json({ limit: '256kb' }))

// 持久化鉴权日志：跨进程重启可查，用于定位会话问题
import fs from 'node:fs'
import path from 'node:path'
const AUTH_LOG = path.resolve(import.meta.dirname, '../data/auth.log')
const alog = (line: string) => {
  try {
    fs.appendFileSync(AUTH_LOG, `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* ignore */
  }
}
app.use('/api', (req, res, next) => {
  const auth = String(req.headers.authorization ?? '')
  res.on('finish', () => {
    alog(`${req.method} ${req.path} -> ${res.statusCode} auth=${auth ? auth.slice(7, 19) : 'NONE'} ua=${String(req.headers['user-agent'] ?? '').slice(0, 40)}`)
  })
  next()
})

const LANGS = ['C++17', 'Python 3']

// Bearer token → 用户；未登录返回 undefined
const authUser = (req: express.Request) => {
  const h = req.headers.authorization ?? ''
  const t = h.startsWith('Bearer ') ? h.slice(7) : ''
  return t ? userByToken(t) : undefined
}

// 题目可见性：public 全员；hidden 仅题目管理员；contest 赛时仅比赛页(cid)或题目管理员
const canSeeProblem = (req: express.Request, p: ProblemMeta): boolean => {
  const meU = authUser(req)
  if (meU?.perms.includes('problem')) return true
  const vis = p.visibility ?? 'public'
  if (vis === 'public') return true
  if (vis === 'hidden') return false
  // contest：需要合法 cid（比赛已开始且包含该题）
  const cid = String(req.query.cid ?? req.body?.cid ?? '')
  if (!cid) return false
  const c = contestById(cid)
  return !!c && c.problems.includes(p.id) && Date.now() >= c.start
}

// 「进入 OJ」权限执行：已登录但被移除 enter → 403；游客不受影响
const enterOk = (req: express.Request, res: express.Response): boolean => {
  const u = authUser(req)
  if (u && !u.perms.includes('enter')) {
    res.status(403).json({ error: '你的进入 OJ 权限已被停用' })
    return false
  }
  return true
}

const pubUser = (u: NonNullable<ReturnType<typeof authUser>>, withEmail = false) => {
  const st = userStats(u.name)
  return {
    uid: u.uid,
    name: u.name,
    reg: u.reg,
    bio: u.bio,
    school: u.school,
    email: withEmail ? u.email : undefined,
    role: u.role,
    perms: u.perms,
    solved: st.solved,
    submits: st.submits,
    rating: st.rating,
    streak: st.streak,
  }
}

const now = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return { time: `${p(d.getHours())}:${p(d.getMinutes())}`, date: `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}` }
}

const pubProblem = (p: ProblemMeta) => {
  const extra = liveProblemExtra(p.id)
  const desc: DescriptionJSON =
    readDesc(p.id) ?? ({ description: '', samples: [] } as DescriptionJSON)
  const tm = readTestsMeta(p.id)
  return {
    id: p.id,
    title: p.title,
    base: p.base,
    tags: p.tags,
    tl: p.tl,
    desc,
    ac: (p.ac ?? 0) + extra.ac,
    submitted: (p.submitted ?? 0) + extra.subCount,
    rate: Math.round(passRate(p.id) * 100),
    rating: rating(p.id, p.base),
    nTests: tm?.subtasks.reduce((s, g) => s + g.points.length, 0) ?? 0,
    subtasks: tm?.subtasks.map((s) => ({ idx: s.idx, count: s.points.length })) ?? [],
    visibility: p.visibility ?? 'public',
    interactive: Boolean(p.interactive) || hasInteractor(p.id),
    hasChecker: hasChecker(p.id),
  }
}

// 题目迁移在 store.load() 内完成（db.json 不再存题目）

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, langs: LANGS, ts: Date.now() })
})

app.get('/api/problems', (req, res) => {
  if (!enterOk(req, res)) return
  syncContestVisibility() // 赛毕自动公开
  res.json(allProblems().filter((p) => canSeeProblem(req, p)).map((p) => pubProblem(p)))
})

app.get('/api/problems/:id', (req, res) => {
  if (!enterOk(req, res)) return
  const p = problemByIdS(req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  if (!canSeeProblem(req, p)) return res.status(403).json({ error: '该题当前不可见' })
  res.json(pubProblem(p))
})

// AtCoder 式语言目录：id + 族 + 完整编译参数展示
app.get('/api/languages', (_req, res) =>
  res.json({
    langs: LANG_CATALOG.map((l) => ({ id: l.id, family: l.family, info: langInfo(l, DEFAULT_OPT) })),
    opts: ['O0', 'O1', 'O2', 'O3', 'Ofast'],
  }),
)

// ---------------- 题目管理（problem 权限）：新建 / 编辑 ----------------

const parseProblemBody = (body: Record<string, unknown>) => {
  const title = String(body.title ?? '').trim()
  const base = Math.min(8, Math.max(1, Number(body.base) || 1))
  const tags = Array.isArray(body.tags) ? body.tags.map(String).slice(0, 8) : []
  const tl = Math.min(5000, Math.max(100, Number(body.tl) || 1000))
  const statement = String(body.statement ?? '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const input = String(body.input ?? '').trim()
  const output = String(body.output ?? '').trim()
  const samples = Array.isArray(body.samples) ? (body.samples as { input: string; output: string }[]) : []
  const tests = Array.isArray(body.tests) ? (body.tests as { in: string; out: string }[]) : []
  const interactive = Boolean(body.interactive)
  const interactor = String(body.interactor ?? '').trim()
  const vis = ['hidden', 'public', 'contest'].includes(String(body.visibility)) ? (String(body.visibility) as 'hidden' | 'public' | 'contest') : 'public'
  if (!title || statement.length === 0)
    return { error: '标题 / 描述 为必填（测试点通过压缩包上传）' }
  if (interactive && !interactor) return { error: '交互题必须提供交互器源码' }
  return { rec: { title, base, tags, tl, statement, input, output, samples, tests, interactive, interactor: interactive ? interactor : undefined, visibility: vis } }
}

app.post('/api/admin/problems', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
  const parsed = parseProblemBody(req.body ?? {})
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })
  const id = String((req.body as Record<string, unknown>).id ?? '').trim() || `P${1000 + allProblems().length + 1}`
  if (problemByIdS(id)) return res.status(409).json({ error: '题号已存在' })
  addProblem({
    id,
    title: parsed.rec.title,
    base: parsed.rec.base,
    tags: parsed.rec.tags,
    tl: parsed.rec.tl,
    ac: 0,
    submitted: 0,
    visibility: parsed.rec.visibility,
    interactive: parsed.rec.interactive,
  })
  // 题面落盘 description.json；测试点走 zip 上传后自动识别
  writeDesc(id, {
    background: String(req.body?.background ?? '') || undefined,
    description: parsed.rec.statement.join('\n\n'),
    input: parsed.rec.input,
    output: parsed.rec.output,
    notes: String(req.body?.notes ?? '') || undefined,
    samples: parsed.rec.samples.map((s) => ({ in: s.input, out: s.output })),
  })
  if (parsed.rec.interactive && parsed.rec.interactor) writeInteractor(id, parsed.rec.interactor)
  res.json({ id })
})

app.patch('/api/admin/problems/:id', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
  const p = problemByIdS(req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  const parsed = parseProblemBody({ ...p, ...(req.body ?? {}) })
  if ('error' in parsed) return res.status(400).json({ error: parsed.error })
  updateProblem(p.id, {
    title: parsed.rec.title,
    base: parsed.rec.base,
    tags: parsed.rec.tags,
    tl: parsed.rec.tl,
    visibility: parsed.rec.visibility,
    interactive: parsed.rec.interactive,
  })
  writeDesc(p.id, {
    background: String(req.body?.background ?? '') || undefined,
    description: parsed.rec.statement.join('\n\n'),
    input: parsed.rec.input,
    output: parsed.rec.output,
    notes: String(req.body?.notes ?? '') || undefined,
    samples: parsed.rec.samples.map((s) => ({ in: s.input, out: s.output })),
  })
  if (parsed.rec.interactive && parsed.rec.interactor) writeInteractor(p.id, parsed.rec.interactor)
  recognizeTests(p.id)
  res.json({ ok: true })
})

// 测试点压缩包上传 / 列表
app.post(
  '/api/admin/problems/:id/testszip',
  express.raw({ type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], limit: '30mb' }),
  (req, res) => {
    const meU = authUser(req)
    if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
    const p = problemByIdS(req.params.id)
    if (!p) return res.status(404).json({ error: 'not found' })
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: '请上传 zip' })
    try {
      const { added } = extractZip(p.id, req.body)
      const recognized = recognizeTests(p.id)
      res.json({ added, recognized })
    } catch {
      res.status(400).json({ error: 'zip 解析失败' })
    }
  },
)

app.get('/api/admin/problems/:id/tests', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
  res.json({ files: listTestFiles(req.params.id), recognized: recognizeTests(req.params.id) })
})

// ---------------- 站点设置 ----------------
app.get('/api/settings', (_req, res) => {
  const s = getSettings()
  res.json({ new_access: s.new_access, inv_needed: s.inv_needed })
})

app.get('/api/admin/settings', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('user_perms')) return res.status(403).json({ error: '无用户管理权限' })
  res.json(getSettings())
})

app.patch('/api/admin/settings', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('user_perms')) return res.status(403).json({ error: '无用户管理权限' })
  const b = req.body ?? {}
  res.json(
    setSettings({
      ...(typeof b.new_access === 'boolean' ? { new_access: b.new_access } : {}),
      ...(typeof b.inv_needed === 'boolean' ? { inv_needed: b.inv_needed } : {}),
      ...(typeof b.inv_code === 'string' ? { inv_code: b.inv_code.slice(0, 64) } : {}),
    }),
  )
})

// ---------------- 重测 / 取消成绩（problem 权限） ----------------

app.post('/api/admin/submissions/:id/rejudge', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
  const sub = subById(Number(req.params.id))
  if (!sub) return res.status(404).json({ error: 'not found' })
  const src = readSubSource(sub.id)
  if (!src) return res.status(400).json({ error: '源码未保存，无法重测' })
  if (sub.verdict === 'JUDGING') return res.status(400).json({ error: '正在评测中' })
  sub.verdict = 'JUDGING'
  queue.push({ sub, lang: sub.lang, code: src.code, opt: sub.opt })
  void pump()
  res.json({ ok: true })
})

app.post('/api/admin/submissions/:id/cancel', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('problem')) return res.status(403).json({ error: '无题目管理权限' })
  const sub = subById(Number(req.params.id))
  if (!sub) return res.status(404).json({ error: 'not found' })
  sub.verdict = 'CANCELLED' // 统计全部实时推导，取消即自动失效
  res.json({ ok: true })
})

// ---------------- 真实平台统计 ----------------
app.get('/api/stats', (_req, res) => {
  const now = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const today = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`
  res.json({
    problems: allProblems().length,
    users: allUsers().length,
    today: allSubs().filter((s) => s.date === today && s.verdict !== 'JUDGING' && s.verdict !== 'CANCELLED').length,
    nodes: 1,
  })
})

// ---------------- 管理员：清除假数据（仅 admin） ----------------
app.post('/api/admin/purge', (req, res) => {
  const meU = authUser(req)
  if (meU?.role !== 'admin') return res.status(403).json({ error: '仅 admin 可执行' })
  const { users, submissions } = req.body ?? {}
  if (users) purgeUsers(meU.name)
  if (submissions) {
    purgeSubs()
    fs.rmSync(SUBS_DIR, { recursive: true, force: true })
  }
  res.json({ ok: true })
})

app.get('/api/discussions', (_req, res) => {
  res.json(allThreads().map((t) => ({ ...t, replies: undefined, replyCount: t.replies.length })))
})

app.get('/api/discussions/:id', (req, res) => {
  const t = threadById(Number(req.params.id))
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(t)
})

app.post('/api/discussions', (req, res) => {
  const meU = authUser(req)
  if (!meU) return res.status(401).json({ error: '请先登录' })
  if (!meU.perms.includes('discuss')) return res.status(403).json({ error: '发表讨论权限已被停用' })
  const title = String(req.body?.title ?? '').trim().slice(0, 80)
  const content = String(req.body?.content ?? '').trim().slice(0, 4000)
  if (!title || !content) return res.status(400).json({ error: '标题与内容必填' })
  const cat = (['announce', 'help', 'solution', 'water'] as const).includes(String(req.body?.category) as never)
    ? (String(req.body?.category) as 'announce' | 'help' | 'solution' | 'water')
    : 'water'
  if (cat === 'announce' && meU.role !== 'admin')
    return res.status(403).json({ error: '仅管理员可发布公告' })
  res.json(addThread(title, meU.name, content, cat))
})

app.post('/api/discussions/:id/replies', (req, res) => {
  const meU = authUser(req)
  if (!meU) return res.status(401).json({ error: '请先登录' })
  if (!meU.perms.includes('discuss')) return res.status(403).json({ error: '发表讨论权限已被停用' })
  const content = String(req.body?.content ?? '').trim().slice(0, 2000)
  if (!content) return res.status(400).json({ error: '内容必填' })
  const t = addReply(Number(req.params.id), meU.name, content)
  if (!t) return res.status(404).json({ error: 'not found' })
  res.json(t)
})

// 删帖：作者本人或 admin 角色
const canMod = (req: express.Request, author: string) => {
  const meU = authUser(req)
  return !!meU && (meU.name === author || meU.role === 'admin')
}

app.delete('/api/discussions/:id', (req, res) => {
  const t = threadById(Number(req.params.id))
  if (!t) return res.status(404).json({ error: 'not found' })
  if (!canMod(req, t.author)) return res.status(403).json({ error: '无权限' })
  deleteThread(t.id)
  res.json({ ok: true })
})

app.delete('/api/discussions/:id/replies/:rid', (req, res) => {
  const t = threadById(Number(req.params.id))
  const r = t?.replies.find((x) => x.id === Number(req.params.rid))
  if (!t || !r) return res.status(404).json({ error: 'not found' })
  if (!canMod(req, r.author)) return res.status(403).json({ error: '无权限' })
  deleteReply(t.id, r.id)
  res.json({ ok: true })
})

// ---------------- 排行榜 ----------------

app.get('/api/rank', (_req, res) => {
  const rows = allUsers()
    .map((u) => {
      const st = userStats(u.name)
      return { name: u.name, uid: u.uid, ...st }
    })
    .filter((r) => r.submits > 0 || r.solved.length > 0)
    .sort((a, b) => b.rating - a.rating || b.solved.length - a.solved.length)
  res.json(rows)
})

// ---------------- 比赛 ----------------

const contestStatus = (c: Contest) => {
  const t = Date.now()
  return t < c.start ? 'upcoming' : t <= c.end ? 'running' : 'ended'
}

interface RankRow {
  user: string
  solved: number
  penalty: number
  total: number
  cells: Record<string, { st: 'AC' | 'TRY' | 'SCORE'; n: number }>
}

/** ACM：过题数↓ 罚时↑（罚时 = 首次AC耗时 + 20min×失败次数）；OI：最高分总和↓ */
function computeRank(c: Contest, cutoff: number): RankRow[] {
  const subs = contestSubs(c.id).filter((s) => s.ts > 0 && s.ts >= c.start && s.ts <= cutoff)
  const byUser = new Map<string, Submission[]>()
  for (const s of subs) {
    if (s.verdict === 'JUDGING') continue
    const arr = byUser.get(s.user) ?? []
    arr.push(s)
    byUser.set(s.user, arr)
  }
  const rows: RankRow[] = []
  for (const [user, list] of byUser) {
    const cells: RankRow['cells'] = {}
    let solved = 0
    let penalty = 0
    let total = 0
    for (const pid of c.problems) {
      const ps = list.filter((s) => s.pid === pid).sort((a, b) => a.ts - b.ts)
      if (ps.length === 0) continue
      if (c.mode === 'ACM') {
        const ac = ps.find((s) => s.verdict === 'AC')
        if (ac) {
          const tries = ps.filter((s) => s.ts <= ac.ts && s.verdict !== 'AC').length
          solved++
          penalty += Math.floor((ac.ts - c.start) / 60000) + tries * 20
          cells[pid] = { st: 'AC', n: tries + 1 }
        } else {
          cells[pid] = { st: 'TRY', n: ps.length }
        }
      } else {
        const best = Math.max(...ps.map((s) => s.detail?.score ?? readResult<{ detail?: { score?: number } }>(s.id)?.detail?.score ?? 0))
        total += best
        cells[pid] = { st: 'SCORE', n: best }
      }
    }
    rows.push({ user, solved, penalty, total, cells })
  }
  rows.sort((a, b) =>
    c.mode === 'ACM' ? b.solved - a.solved || a.penalty - b.penalty : b.total - a.total,
  )
  return rows
}

app.get('/api/contests', (_req, res) => {
  syncContestVisibility()
  res.json(allContests().map((c) => ({ ...c, status: contestStatus(c) })))
})

app.get('/api/contests/:id', (req, res) => {
  const c = contestById(req.params.id)
  if (!c) return res.status(404).json({ error: 'not found' })
  const st = contestStatus(c)
  // 未开赛不泄露题列表
  res.json({ ...c, status: st, problems: st === 'upcoming' ? [] : c.problems })
})

app.get('/api/contests/:id/rank', (req, res) => {
  const c = contestById(req.params.id)
  if (!c) return res.status(404).json({ error: 'not found' })
  const me = authUser(req)
  const canFull = !!me?.perms.includes('contest')
  const freezeAt = c.end - c.freezeMin * 60000
  const inFreeze = contestStatus(c) === 'running' && Date.now() > freezeAt
  const showFull = canFull && req.query.full === '1'
  const cutoff = inFreeze && !showFull ? freezeAt : Date.now() + 1
  res.json({ mode: c.mode, frozen: inFreeze && !showFull, rows: computeRank(c, cutoff) })
})

app.post('/api/contests', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('contest')) return res.status(403).json({ error: '无比赛管理权限' })
  const { title, mode, start, end, problems, freezeMin } = req.body ?? {}
  if (!title || !['ACM', 'OI'].includes(mode)) return res.status(400).json({ error: '参数错误' })
  const s = Number(start)
  const e = Number(end)
  if (!(e > s)) return res.status(400).json({ error: '结束时间需晚于开始时间' })
  if (!Array.isArray(problems) || problems.length === 0) return res.status(400).json({ error: '赛题不能为空' })
  const c = addContest({
    title: String(title).slice(0, 60),
    mode,
    start: s,
    end: e,
    problems: problems.map(String),
    freezeMin: Number(freezeMin) || 30,
  })
  res.json(c)
})

app.delete('/api/contests/:id', (req, res) => {
  const meU = authUser(req)
  if (!meU?.perms.includes('contest')) return res.status(403).json({ error: '无比赛管理权限' })
  if (!contestById(req.params.id)) return res.status(404).json({ error: 'not found' })
  deleteContest(req.params.id)
  res.json({ ok: true })
})

// ---------------- 提交 + 串行判题队列 ----------------
type Job = { sub: Submission; lang: string; code: string; opt?: string }
const queue: Job[] = []
let working = false

async function pump() {
  if (working) return
  working = true
  while (queue.length > 0) {
    const job = queue.shift()!
    const problem = problemByIdS(job.sub.pid)
    if (!problem) continue
    // 小延迟模拟排队
    await new Promise((r) => setTimeout(r, 350))
    const code = job.code ?? readSubSource(job.sub.id)?.code ?? ''
    const outcome = await judge(problem, job.lang, code, job.opt)
    job.sub.verdict = outcome.verdict
    writeResult(job.sub.id, outcome) // 结果落盘 submissions/[id]/result.json
    // 统计全部由提交记录实时推导，无需增量登记
  }
  working = false
}

// ---------------- 认证 ----------------

app.post('/api/auth/register', (req, res) => {
  const { username, password, invite } = req.body ?? {}
  const name = String(username ?? '').trim()
  const pass = String(password ?? '')
  const st = getSettings()
  if (st.inv_needed && String(invite ?? '') !== st.inv_code)
    return res.status(400).json({ error: '邀请码不正确' })
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(name))
    return res.status(400).json({ error: '用户名需 3-16 位（字母/数字/下划线/中文）' })
  if (pass.length < 6) return res.status(400).json({ error: '密码至少 6 位' })
  if (findUser(name)) return res.status(409).json({ error: '用户名已被占用' })
  createUser(name, pass)
  // 站点设置：新用户默认能否进入 OJ
  if (!st.new_access) setUserAdmin(name, { perms: findUser(name)!.perms.filter((p) => p !== 'enter') })
  const token = issueToken(name)
  res.json({ token, user: pubUser(findUser(name)!, true) })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {}
  const u = findUser(String(username ?? '').trim())
  if (!u || u.pass !== hash(String(password ?? '')))
    return res.status(401).json({ error: '用户名或密码错误' })
  const token = issueToken(u.name)
  res.json({ token, user: pubUser(u, true) })
})

app.get('/api/me', (req, res) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'not logged in' })
  res.json(pubUser(u, true))
})

app.patch('/api/me', (req, res) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'not logged in' })
  const { bio, email, school } = req.body ?? {}
  updateUser(u.name, {
    bio: String(bio ?? u.bio).slice(0, 200),
    email: String(email ?? u.email).slice(0, 80),
    school: String(school ?? u.school).slice(0, 60),
  })
  res.json(pubUser(findUser(u.name)!, true))
})

app.post('/api/me/password', (req, res) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'not logged in' })
  const { oldPass, newPass } = req.body ?? {}
  if (u.pass !== hash(String(oldPass ?? ''))) return res.status(400).json({ error: '原密码错误' })
  if (String(newPass ?? '').length < 6) return res.status(400).json({ error: '新密码至少 6 位' })
  changePass(u.name, String(newPass))
  res.json({ ok: true })
})

app.get('/api/users/:name', (req, res) => {
  const u = findUser(req.params.name)
  if (!u) return res.status(404).json({ error: 'user not found' })
  res.json(pubUser(u))
})

// ---------------- 用户权限管理（需要 user_perms；授予管理员权限需 admin_admin） ----------------

app.get('/api/admin/users', (req, res) => {
  const me = authUser(req)
  if (!me?.perms.includes('user_perms')) return res.status(403).json({ error: '无用户管理权限' })
  res.json(
    allUsers()
      .sort((a, b) => a.uid - b.uid)
      .map((u) => pubUser(u, true)),
  )
})

app.patch('/api/admin/users/:name', (req, res) => {
  const me = authUser(req)
  if (!me?.perms.includes('user_perms')) return res.status(403).json({ error: '无用户管理权限' })
  const target = findUser(req.params.name)
  if (!target) return res.status(404).json({ error: 'user not found' })
  if (target.name === me.name) return res.status(403).json({ error: '不能修改自己的权限' })
  const { role, perms } = req.body ?? {}

  // 涉及角色或 admin_admin 的变更，需要调用者持有 admin_admin
  const touchesAdmin =
    (role !== undefined && role !== target.role) ||
    (Array.isArray(perms) && perms.includes('admin_admin') !== target.perms.includes('admin_admin'))
  if (touchesAdmin && !me.perms.includes('admin_admin'))
    return res.status(403).json({ error: '无管理用户管理员权限' })

  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'invalid role' })
  }
  if (perms !== undefined) {
    if (!Array.isArray(perms) || perms.some((p: string) => !ALL_PERMS.includes(p)))
      return res.status(400).json({ error: 'invalid perms' })
  }
  setUserAdmin(target.name, { role, perms })
  res.json(pubUser(findUser(target.name)!, true))
})

// 删除用户：需 user_perms；删除持有 admin 角色/权限者需 admin_admin；不能删自己
app.delete('/api/admin/users/:name', (req, res) => {
  const me = authUser(req)
  if (!me?.perms.includes('user_perms')) return res.status(403).json({ error: '无用户管理权限' })
  const target = findUser(req.params.name)
  if (!target) return res.status(404).json({ error: 'user not found' })
  if (target.name === me.name) return res.status(403).json({ error: '不能删除自己' })
  const isPrivileged = target.role === 'admin' || target.perms.includes('admin_admin')
  if (isPrivileged && !me.perms.includes('admin_admin'))
    return res.status(403).json({ error: '无管理用户管理员权限' })
  deleteUser(target.name)
  res.json({ ok: true })
})

app.post('/api/submissions', (req, res) => {
  if (!enterOk(req, res)) return
  const { pid, lang, code } = req.body ?? {}
  const problem = problemByIdS(String(pid ?? ''))
  if (!problem) return res.status(400).json({ error: 'problem not found' })
  if (!specOf(String(lang))) return res.status(400).json({ error: 'unsupported language' })
  if (typeof code !== 'string' || code.length > 64_000) return res.status(400).json({ error: 'invalid code' })
  if (!canSeeProblem(req, problem)) return res.status(403).json({ error: '该题当前不可见，请从比赛页进入' })
  const opt = optOf(req.body?.opt ? String(req.body.opt) : undefined)
  const ts = now()
  const family = specOf(String(lang))!.family
  const sub: Submission = {
    id: nextId(),
    pid: problem.id,
    user: authUser(req)?.name ?? 'guest',
    lang: String(lang),
    verdict: 'JUDGING',
    time: ts.time,
    date: ts.date,
    ts: Date.now(),
    opt,
  }
  // 比赛提交：校验比赛存在、进行中、题目在赛题集合内
  const cid = req.body?.cid ? String(req.body.cid) : undefined
  if (cid) {
    const c = contestById(cid)
    const t = Date.now()
    if (!c || t < c.start || t > c.end) return res.status(400).json({ error: '比赛未在进行中' })
    if (!c.problems.includes(problem.id)) return res.status(400).json({ error: '该题不在比赛中' })
    sub.cid = cid
  }
  addSubmission(sub)
  writeSubSource(sub.id, family, String(code)) // 源码落盘 submissions/[id]/Main.<ext>
  queue.push({ sub, lang: String(lang), code: String(code), opt })
  void pump()
  res.json({ id: sub.id, verdict: sub.verdict })
})

app.get('/api/submissions', (req, res) => {
  if (!enterOk(req, res)) return
  const me = authUser(req)
  const byUser = req.query.user ? String(req.query.user) : null
  const mine = req.query.mine === '1'
  const rows = allSubs()
    .filter((s) => (byUser ? s.user === byUser : mine ? s.user === (me?.name ?? '__none__') : true))
    .map(({ id, pid, user, lang, verdict, time, date }) => ({ id, pid, user, lang, verdict, time, date, mine: user === me?.name }))
  res.json(rows)
})

app.get('/api/submissions/:id', (req, res) => {
  const s = subById(Number(req.params.id))
  if (!s) return res.status(404).json({ error: 'not found' })
  const src = readSubSource(s.id)
  const result = readResult<{ verdict?: string; detail?: Submission['detail'] }>(s.id)
  res.json({ ...s, code: src?.code, detail: result?.detail ?? s.detail })
})

const PORT = Number(process.env.PORT ?? 8787)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ark-backend] listening on :${PORT} · langs: ${LANGS.join(', ')}`)
})
