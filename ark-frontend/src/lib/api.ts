import { ref } from 'vue'
import type { ProblemPub, SubDetail, SubRow, Verdict } from './api-types'

const TOKEN_KEY = 'arkoj-token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  const t = getToken()
  if (t) headers['Authorization'] = `Bearer ${t}`
  if (init?.body) headers['Content-Type'] = 'application/json'
  const r = await fetch(`/api${path}`, { ...init, headers })
  const data = (await r.json().catch(() => ({}))) as T & { error?: string }
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `API ${r.status}`)
  return data
}

// ---------------- 认证 ----------------
export interface UserProfile {
  uid: number
  name: string
  reg: string
  bio: string
  school: string
  email?: string
  role: 'admin' | 'user'
  perms: string[]
  solved: string[]
  submits: number
  rating: number
  streak: number
}

export const loginApi = (username: string, password: string) =>
  req<{ token: string; user: UserProfile }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })

export const registerApi = (username: string, password: string, invite?: string) =>
  req<{ token: string; user: UserProfile }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, ...(invite ? { invite } : {}) }),
  })

export const meApi = () => req<UserProfile>('/me')
export const userApi = (name: string) => req<UserProfile>(`/users/${encodeURIComponent(name)}`)

// ---------------- 用户权限管理 ----------------
export const adminUsers = () => req<UserProfile[]>('/admin/users')
export const adminPatchUser = (name: string, body: { role?: 'admin' | 'user'; perms?: string[] }) =>
  req<UserProfile>(`/admin/users/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const adminDeleteUser = (name: string) =>
  req<{ ok: boolean }>(`/admin/users/${encodeURIComponent(name)}`, { method: 'DELETE' })

export const patchMe = (body: { bio?: string; email?: string; school?: string }) =>
  req<UserProfile>('/me', { method: 'PATCH', body: JSON.stringify(body) })

export const changePass = (oldPass: string, newPass: string) =>
  req<{ ok: boolean }>('/me/password', { method: 'POST', body: JSON.stringify({ oldPass, newPass }) })

// ---------------- 题目 ----------------
export const problemCache = ref<ProblemPub[]>([])

export async function loadProblems(force = false): Promise<ProblemPub[]> {
  if (!force && problemCache.value.length > 0) return problemCache.value
  problemCache.value = await req('/problems')
  return problemCache.value
}

export const problemInCache = (id: string) => problemCache.value.find((p) => p.id === id)
export const fetchProblem = (id: string) => req<ProblemPub>(`/problems/${id}`)

// ---------------- 提交 ----------------
export const recentSubs = ref<SubRow[]>([])
export const mySubsAll = ref<SubRow[]>([])

export async function loadSubs(): Promise<SubRow[]> {
  const rows = await req<SubRow[]>('/submissions?mine=1')
  mySubsAll.value = rows
  recentSubs.value = rows.slice(0, 4)
  return rows
}

export const userSubs = (name: string) => req<SubRow[]>(`/submissions?user=${encodeURIComponent(name)}`)

export const getSub = (id: number) => req<SubDetail>(`/submissions/${id}`)

export async function submitCode(pid: string, lang: string, code: string, opts?: { cid?: string; opt?: string }): Promise<{ id: number; verdict: Verdict }> {
  return req('/submissions', {
    method: 'POST',
    body: JSON.stringify({ pid, lang, code, ...opts }),
  })
}

export interface LangEntry {
  id: string
  family: 'cpp' | 'c' | 'py'
  info: string
}
export const fetchLangsCatalog = () =>
  req<{ langs: LangEntry[]; opts: string[] }>('/languages')

// ---------------- 管理：重测 / 取消 ----------------
export const rejudgeSub = (id: number) => req<{ ok: boolean }>(`/admin/submissions/${id}/rejudge`, { method: 'POST' })
export const cancelSub = (id: number) => req<{ ok: boolean }>(`/admin/submissions/${id}/cancel`, { method: 'POST' })

// ---------------- 题目管理 ----------------
export const adminCreateProblem = (body: Record<string, unknown>) =>
  req<{ id: string }>('/admin/problems', { method: 'POST', body: JSON.stringify(body) })
export const adminEditProblem = (id: string, body: Record<string, unknown>) =>
  req<{ ok: boolean }>(`/admin/problems/${id}`, { method: 'PATCH', body: JSON.stringify(body) })

export const fetchTestFiles = (id: string) => req<{ files: string[] }>(`/admin/problems/${id}/tests`)

export async function uploadTestsZip(id: string, file: File): Promise<{ added: string[] }> {
  const t = getToken()
  const r = await fetch(`/api/admin/problems/${id}/testszip`, {
    method: 'POST',
    body: file,
    headers: {
      'Content-Type': 'application/zip',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  })
  const data = (await r.json()) as { added?: string[]; error?: string }
  if (!r.ok) throw new Error(data.error ?? `API ${r.status}`)
  return data as { added: string[] }
}

// ---------------- 站点设置 ----------------
export interface SiteSettings {
  new_access: boolean
  inv_needed: boolean
  inv_code: string
}
export const fetchPublicSettings = () => req<{ new_access: boolean; inv_needed: boolean }>('/settings')
export const fetchAdminSettings = () => req<SiteSettings>('/admin/settings')
export const patchAdminSettings = (body: Partial<SiteSettings>) =>
  req<SiteSettings>('/admin/settings', { method: 'PATCH', body: JSON.stringify(body) })

// ---------------- 讨论 ----------------
export interface ThreadPub {
  id: number
  title: string
  author: string
  ts: number
  content: string
  category: 'announce' | 'help' | 'solution' | 'water'
  replyCount: number
  replies?: { id: number; author: string; ts: number; content: string }[]
}
export const fetchDiscussions = () => req<ThreadPub[]>('/discussions')
export const fetchThread = (id: number) => req<ThreadPub>(`/discussions/${id}`)
export const postThread = (title: string, content: string, category: string) =>
  req<ThreadPub>('/discussions', { method: 'POST', body: JSON.stringify({ title, content, category }) })
export const postReply = (id: number, content: string) =>
  req<ThreadPub>(`/discussions/${id}/replies`, { method: 'POST', body: JSON.stringify({ content }) })
export const deleteThreadApi = (id: number) => req<{ ok: boolean }>(`/discussions/${id}`, { method: 'DELETE' })
export const deleteReplyApi = (tid: number, rid: number) =>
  req<{ ok: boolean }>(`/discussions/${tid}/replies/${rid}`, { method: 'DELETE' })

// ---------------- 排行榜 ----------------
export interface RankEntry {
  name: string
  uid: number
  solved: string[]
  submits: number
  rating: number
  streak: number
}
export const fetchUserRank = () => req<RankEntry[]>('/rank')

export interface SiteStats {
  problems: number
  users: number
  today: number
  nodes: number
}
export const fetchSiteStats = () => req<SiteStats>('/stats')

// ---------------- 比赛 ----------------
export interface ContestPub {
  id: string
  title: string
  mode: 'ACM' | 'OI'
  start: number
  end: number
  problems: string[]
  freezeMin: number
  status: 'upcoming' | 'running' | 'ended'
}
export interface RankRow {
  user: string
  solved: number
  penalty: number
  total: number
  cells: Record<string, { st: 'AC' | 'TRY' | 'SCORE'; n: number }>
}

export const fetchContests = () => req<ContestPub[]>('/contests')
export const fetchContest = (id: string) => req<ContestPub>(`/contests/${id}`)
export const fetchRank = (id: string, full = false) =>
  req<{ mode: 'ACM' | 'OI'; frozen: boolean; rows: RankRow[] }>(`/contests/${id}/rank${full ? '?full=1' : ''}`)
export const createContest = (body: { title: string; mode: 'ACM' | 'OI'; start: number; end: number; problems: string[]; freezeMin?: number }) =>
  req<ContestPub>('/contests', { method: 'POST', body: JSON.stringify(body) })
export const deleteContestApi = (id: string) => req<{ ok: boolean }>(`/contests/${id}`, { method: 'DELETE' })

export const fetchLangs = () => req<string[]>('/languages')

/** 轮询直至出分 */
export function pollSub(id: number, cb: (d: SubDetail) => void, intervalMs = 700): () => void {
  let stopped = false
  const timer = window.setInterval(async () => {
    if (stopped) return
    try {
      const d = await getSub(id)
      cb(d)
      if (d.verdict !== 'JUDGING') {
        stopped = true
        window.clearInterval(timer)
      }
    } catch {
      /* 重试 */
    }
  }, intervalMs)
  return () => {
    stopped = true
    window.clearInterval(timer)
  }
}
