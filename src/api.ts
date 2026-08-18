// Thin API client for the ArkOJ backend (server/). All calls go through the
// vite dev proxy or the same origin in production, so no base URL is needed.
//
// Auth: prefer Authorization Bearer (token stored in localStorage) so sessions
// survive cross-origin preview hosts where httpOnly cookies may not stick.
// Cookie credentials are still sent as a secondary channel.

export interface User {
  id: number
  username: string
  nickname: string
  avatar: string
  bio: string
  role: string
  created_at: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface ProblemSummary {
  id: number
  code: string
  title: string
  difficulty: string
  time_limit: number
  memory_limit: number
  tags: string[]
  source: string
  accepted: number
  submitted: number
  ac_rate: number
  is_public: boolean
  created_at: string
  updated_at: string
  solved?: 'AC' | 'TRIED' | null
}

export interface ProblemDetail extends ProblemSummary {
  description: string
  input_format: string
  output_format: string
  samples: { input: string; output: string }[]
  hint: string
  author_id?: number
}

export interface Submission {
  id: number
  user_id: number
  username: string
  nickname: string
  problem_id: number
  problem_code: string
  problem_title: string
  language: string
  status: string
  time_ms: number | null
  memory_kb: number | null
  score: number
  detail: string
  contest_id: number | null
  created_at: string
  code?: string
}

export interface ProblemListSummary {
  id: number
  title: string
  description: string
  owner_id: number
  owner_username: string
  owner_nickname: string
  is_public: boolean
  problem_count: number
  created_at: string
  updated_at: string
}

export interface ProblemListDetail extends ProblemListSummary {
  problems: (ProblemSummary & { ord: number })[]
  solved_count: number
}

export interface ContestSummary {
  id: number
  title: string
  description: string
  rule: string
  start_at: string
  end_at: string
  is_public: boolean
  status: 'upcoming' | 'running' | 'ended'
  problem_count: number
  participant_count: number
  registered?: boolean
  created_at: string
}

export interface ContestDetail extends ContestSummary {
  problems: Array<{
    label: string
    score: number
    ord: number
    id?: number
    code?: string
    title?: string
    difficulty?: string
    solved?: 'AC' | 'TRIED' | null
  }>
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface UserProfile {
  id: number
  username: string
  nickname: string
  avatar: string
  bio: string
  role: string
  created_at: string
  stats: {
    solved: number
    submitted: number
    ac_submissions: number
    ac_rate: number
    rank: number
    difficulty: Record<string, number>
  }
  recent_solved: Array<{
    id: number
    code: string
    title: string
    difficulty: string
    first_ac_at: string
  }>
  recent_submissions: Array<{
    id: number
    status: string
    language: string
    time_ms: number | null
    created_at: string
    problem_code: string
    problem_title: string
  }>
  lists: Array<{ id: number; title: string; is_public: boolean; problem_count: number }>
  contests: Array<{ id: number; title: string; start_at: string; end_at: string; rule: string }>
}

export interface RankItem {
  rank: number
  id: number
  username: string
  nickname: string
  avatar: string
  bio: string
  role: string
  solved: number
  submitted: number
  ac_rate: number
  created_at: string
}

export interface Discussion {
  id: number
  title: string
  body: string
  author_id: number
  author_username: string
  author_nickname: string
  author_avatar: string
  problem_id: number | null
  problem_code?: string
  problem_title?: string
  pinned: boolean
  replies: number
  replies_count?: number
  created_at: string
  updated_at: string
}

export interface Overview {
  totals: { problems: number; users: number; submissions: number; contests: number }
  recommended: ProblemSummary[]
  next_contest: {
    id: number
    title: string
    start_at: string
    end_at: string
    rule: string
    participant_count: number
  } | null
  me: { solved: number; submitted: number; week_solved: number; week_goal: number } | null
}

const TOKEN_KEY = 'arkoj_token'

// In-memory fallback: preview iframes / strict privacy modes often block
// localStorage and third-party cookies. Login still returns a token in JSON —
// keep it in RAM so subsequent submits carry Authorization even when storage fails.
let memoryToken: string | null = null

export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    const t = localStorage.getItem(TOKEN_KEY)
    if (t) memoryToken = t
    return t
  } catch {
    return null
  }
}

export function setStoredToken(token: string | null) {
  memoryToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode / sandboxed iframe: memory token still works this session */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  const token = getStoredToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers,
  })
  const data = (await res.json().catch(() => null)) as (T & { error?: string; token?: string }) | null
  // Some auth responses also embed token — always capture it.
  if (data && typeof (data as { token?: string }).token === 'string') {
    setStoredToken((data as { token: string }).token)
  }
  if (!res.ok) {
    // Drop a stale token so the UI can re-auth cleanly.
    if (res.status === 401) setStoredToken(null)
    throw new Error((data && data.error) || `请求失败 (HTTP ${res.status})`)
  }
  return data as T
}

function qs(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function authCall(path: string, username: string, password: string) {
  const res = await request<AuthResponse>(path, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (res.token) setStoredToken(res.token)
  return res
}

export const api = {
  me: () => request<User>('/api/auth/me'),
  login: (username: string, password: string) => authCall('/api/auth/login', username, password),
  register: (username: string, password: string) =>
    authCall('/api/auth/register', username, password),
  logout: async () => {
    try {
      await request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
    } finally {
      setStoredToken(null)
    }
  },
  updateProfile: (payload: { nickname?: string; avatar?: string; bio?: string }) =>
    request<User>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  overview: () => request<Overview>('/api/stats/overview'),

  problems: (
    params: {
      q?: string
      difficulty?: string
      tag?: string
      page?: number
      pageSize?: number
    } = {},
  ) => request<Page<ProblemSummary>>(`/api/problems${qs(params)}`),
  problem: (idOrCode: string | number) =>
    request<ProblemDetail>(`/api/problems/${encodeURIComponent(String(idOrCode))}`),
  problemTags: () => request<{ tags: { name: string; count: number }[] }>('/api/problems/tags'),

  submissions: (
    params: {
      page?: number
      pageSize?: number
      user_id?: number
      username?: string
      problem?: string | number
      problem_id?: number
      status?: string
      contest_id?: number
    } = {},
  ) => request<Page<Submission>>(`/api/submissions${qs(params)}`),
  submission: (id: number) => request<Submission>(`/api/submissions/${id}`),
  submit: (payload: {
    problem_id?: number
    problem?: string | number
    language: string
    code: string
    contest_id?: number
  }) =>
    request<Submission>('/api/submissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  lists: (params: { q?: string; owner?: string; page?: number; pageSize?: number } = {}) =>
    request<Page<ProblemListSummary>>(`/api/lists${qs(params)}`),
  list: (id: number) => request<ProblemListDetail>(`/api/lists/${id}`),
  createList: (payload: {
    title: string
    description?: string
    is_public?: boolean
    problem_ids?: number[]
  }) =>
    request<ProblemListSummary>('/api/lists', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateList: (
    id: number,
    payload: {
      title?: string
      description?: string
      is_public?: boolean
      problem_ids?: number[]
    },
  ) =>
    request<ProblemListSummary>(`/api/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteList: (id: number) => request<{ ok: boolean }>(`/api/lists/${id}`, { method: 'DELETE' }),
  addToList: (id: number, problem_id: number) =>
    request<{ ok: boolean }>(`/api/lists/${id}/problems`, {
      method: 'POST',
      body: JSON.stringify({ problem_id }),
    }),
  removeFromList: (id: number, problemId: number) =>
    request<{ ok: boolean }>(`/api/lists/${id}/problems/${problemId}`, {
      method: 'DELETE',
    }),

  contests: (
    params: {
      q?: string
      status?: string
      page?: number
      pageSize?: number
    } = {},
  ) => request<Page<ContestSummary>>(`/api/contests${qs(params)}`),
  contest: (id: number) => request<ContestDetail>(`/api/contests/${id}`),
  registerContest: (id: number) =>
    request<{ ok: boolean; registered: boolean }>(`/api/contests/${id}/register`, {
      method: 'POST',
    }),
  unregisterContest: (id: number) =>
    request<{ ok: boolean; registered: boolean }>(`/api/contests/${id}/register`, {
      method: 'DELETE',
    }),
  contestRank: (id: number) =>
    request<{
      contest_id: number
      rule: string
      status: string
      problems: { label: string; problem_id: number }[]
      ranking: Array<{
        rank: number
        user_id: number
        username: string
        nickname: string
        avatar: string
        solved: number
        penalty: number
        score: number
        problems: Array<{
          label: string
          attempts: number
          ac: boolean
          ac_time: number | null
          score: number
          pending: boolean
        }>
      }>
    }>(`/api/contests/${id}/rank`),

  rank: (params: { page?: number; pageSize?: number } = {}) =>
    request<Page<RankItem>>(`/api/users/rank${qs(params)}`),
  user: (username: string) => request<UserProfile>(`/api/users/${encodeURIComponent(username)}`),

  discussions: (
    params: {
      q?: string
      problem_id?: number
      page?: number
      pageSize?: number
    } = {},
  ) => request<Page<Discussion>>(`/api/discussions${qs(params)}`),
  discussion: (id: number) =>
    request<
      Discussion & {
        replies: Array<{
          id: number
          body: string
          author_id: number
          author_username: string
          author_nickname: string
          author_avatar: string
          created_at: string
        }>
      }
    >(`/api/discussions/${id}`),
  createDiscussion: (payload: { title: string; body: string; problem_id?: number }) =>
    request<{ id: number }>('/api/discussions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  replyDiscussion: (id: number, body: string) =>
    request<{ id: number }>(`/api/discussions/${id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
}
