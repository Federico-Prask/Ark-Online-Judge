import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { problems } from './problems.js'

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

export type Verdict = 'AC' | 'WA' | 'TLE' | 'CE' | 'JUDGING'

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
  detail?: Detail
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
  subs: Submission[]
  stats: Record<string, ProblemStat>
  users: Record<string, UserRec>
  tokens: Record<string, string>
  uidSeq: number
  contests: Contest[]
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
  for (const p of problems) {
    const rnd = mulberry32(parseInt(p.id.slice(1), 10) * 104729 + 7)
    const users = Math.max(30, Math.round(p.submitted / 1.7))
    const acUsers = Math.min(p.ac, users)
    let sumT = 0
    for (let i = 0; i < users; i++) sumT += 1 + Math.floor(rnd() * 3)
    stats[p.id] = { seedAc: acUsers, seedSumT: sumT, users: {} }
  }
  return stats
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
  for (const s of base.subs) s.ts ??= 0
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
  if (!st) return 0
  let ac = st.seedAc
  let sumT = st.seedSumT
  for (const u of Object.values(st.users)) {
    if (u.ac) ac++
    sumT += u.t ?? u.a
  }
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

/** 用户维度统计：solved 列表 / 提交数 / rating / 连续天数 */
export function userStats(name: string) {
  const mine = db.subs.filter((s) => s.user === name)
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
    } else if (streak === 0 && dates.includes(key) === false && streak === 0 && isToday(d)) {
      // 今天还没提交不算断，往前看一天
      d.setDate(d.getDate() - 1)
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
