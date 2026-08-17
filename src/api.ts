// Thin API client for the ArkOJ backend (server/). All calls go through the
// vite dev proxy or the same origin in production, so no base URL is needed.
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const init: RequestInit = { credentials: 'include', ...options }
  if (init.body) {
    init.headers = {
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string>),
    }
  }
  const res = await fetch(path, init)
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) {
    throw new Error((data && data.error) || `请求失败 (HTTP ${res.status})`)
  }
  return data as T
}

export const api = {
  me: () => request<User>('/api/auth/me'),
  login: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (payload: { nickname?: string; avatar?: string; bio?: string }) =>
    request<User>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
}
