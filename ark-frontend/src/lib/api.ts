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

export const registerApi = (username: string, password: string) =>
  req<{ token: string; user: UserProfile }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
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

export async function loadSubs(): Promise<SubRow[]> {
  const rows = await req<SubRow[]>('/submissions')
  recentSubs.value = rows.filter((s) => s.mine).slice(0, 4)
  return rows
}

export const userSubs = (name: string) => req<SubRow[]>(`/submissions?user=${encodeURIComponent(name)}`)

export const getSub = (id: number) => req<SubDetail>(`/submissions/${id}`)

export async function submitCode(pid: string, lang: string, code: string, cid?: string): Promise<{ id: number; verdict: Verdict }> {
  return req('/submissions', {
    method: 'POST',
    body: JSON.stringify({ pid, lang, code, ...(cid ? { cid } : {}) }),
  })
}

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
