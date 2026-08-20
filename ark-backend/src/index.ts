import express from 'express'
import { problems, problemById } from './problems.js'
import { judge } from './judge.js'
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
  hash,
  issueToken,
  nextId,
  passRate,
  rating,
  registerAttempt,
  setUserAdmin,
  subById,
  updateUser,
  userByToken,
  userStats,
  type Contest,
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

const pubProblem = (p: (typeof problems)[number]) => ({
  id: p.id,
  title: p.title,
  base: p.base,
  tags: p.tags,
  tl: p.tl,
  samples: p.samples,
  statement: p.statement,
  input: p.input,
  output: p.output,
  ac: 0, // 见下：由统计得出
  submitted: 0,
  rate: Math.round(passRate(p.id) * 100),
  rating: rating(p.id, p.base),
  nTests: p.tests.length,
})

// AC/SUBMIT 展示值：种子基数 + 本站实际提交（列表用）
const liveCounts = () => {
  const acc: Record<string, { ac: number; sub: number }> = {}
  for (const s of allSubs()) {
    const c = (acc[s.pid] ??= { ac: 0, sub: 0 })
    c.sub++
    if (s.verdict === 'AC') c.ac++
  }
  return acc
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, langs: LANGS, ts: Date.now() })
})

app.get('/api/problems', (req, res) => {
  if (!enterOk(req, res)) return
  const counts = liveCounts()
  res.json(
    problems.map((p) => {
      const c = counts[p.id] ?? { ac: 0, sub: 0 }
      const seed = { ac: p.ac, sub: p.submitted }
      return { ...pubProblem(p), ac: seed.ac + c.ac, submitted: seed.sub + c.sub }
    }),
  )
})

app.get('/api/problems/:id', (req, res) => {
  const p = problemById(req.params.id)
  if (!p) return res.status(404).json({ error: 'not found' })
  const counts = liveCounts()[p.id] ?? { ac: 0, sub: 0 }
  res.json({ ...pubProblem(p), ac: p.ac + counts.ac, submitted: p.submitted + counts.sub })
})

app.get('/api/languages', (_req, res) => res.json(LANGS))

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
        const best = Math.max(...ps.map((s) => s.detail?.score ?? 0))
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
type Job = { sub: Submission; lang: string; code: string }
const queue: Job[] = []
let working = false

async function pump() {
  if (working) return
  working = true
  while (queue.length > 0) {
    const job = queue.shift()!
    const problem = problemById(job.sub.pid)
    if (!problem) continue
    // 小延迟模拟排队
    await new Promise((r) => setTimeout(r, 350))
    const outcome = await judge(problem, job.lang, job.code)
    job.sub.verdict = outcome.verdict
    job.sub.detail = outcome.detail
    registerAttempt(job.sub.pid, job.sub.user, outcome.verdict)
  }
  working = false
}

// ---------------- 认证 ----------------

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body ?? {}
  const name = String(username ?? '').trim()
  const pass = String(password ?? '')
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]{3,16}$/.test(name))
    return res.status(400).json({ error: '用户名需 3-16 位（字母/数字/下划线/中文）' })
  if (pass.length < 6) return res.status(400).json({ error: '密码至少 6 位' })
  if (findUser(name)) return res.status(409).json({ error: '用户名已被占用' })
  const u = createUser(name, pass)
  const token = issueToken(name)
  res.json({ token, user: pubUser(u, true) })
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
  const problem = problemById(String(pid ?? ''))
  if (!problem) return res.status(400).json({ error: 'problem not found' })
  if (!LANGS.includes(String(lang))) return res.status(400).json({ error: 'unsupported language' })
  if (typeof code !== 'string' || code.length > 64_000) return res.status(400).json({ error: 'invalid code' })
  const ts = now()
  const sub: Submission = {
    id: nextId(),
    pid: problem.id,
    user: authUser(req)?.name ?? 'guest',
    lang: String(lang),
    verdict: 'JUDGING',
    time: ts.time,
    date: ts.date,
    ts: Date.now(),
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
  queue.push({ sub, lang: String(lang), code })
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
  res.json({ ...s, mine: s.user === authUser(req)?.name })
})

const PORT = Number(process.env.PORT ?? 8787)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[ark-backend] listening on :${PORT} · langs: ${LANGS.join(', ')}`)
})
