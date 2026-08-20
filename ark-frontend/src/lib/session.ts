import { computed, ref } from 'vue'
import { clearToken, getToken, loginApi, meApi, registerApi, setToken, type UserProfile } from './api'

/** 真实会话：token(localStorage) + /api/me */
export const me = ref<UserProfile | null>(null)
export const loggedIn = computed(() => !!me.value)

export async function restoreSession() {
  try {
    me.value = await meApi()
  } catch {
    // 401 且本地有残留 token：清掉，避免幽灵会话
    if (getToken()) clearToken()
    me.value = null
  }
}

export async function login(username: string, password: string) {
  const r = await loginApi(username, password)
  setToken(r.token)
  me.value = r.user
}

export async function register(username: string, password: string) {
  const r = await registerApi(username, password)
  setToken(r.token)
  me.value = r.user
}

export function logout() {
  clearToken()
  me.value = null
}

/** 依据本地时间返回中文时段问候 */
export function greetZh(h: number): string {
  if (h < 5) return '深夜'
  if (h < 9) return '早上'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  if (h < 23) return '晚上'
  return '深夜'
}
