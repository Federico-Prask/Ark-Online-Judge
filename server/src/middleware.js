// Shared auth helpers used by every router.
import { getUserByToken } from './sessions.js'

export const COOKIE_NAME = 'arkoj_session'

function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i > 0) {
      try {
        out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        /* ignore */
      }
    }
  }
  return out
}

export function getToken(req) {
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || null
}

/** Require a valid session. Sets req.user / req.token. */
export function requireAuth(req, res, next) {
  const token = getToken(req)
  const user = getUserByToken(token)
  if (!user) return res.status(401).json({ error: '未登录或登录已过期' })
  req.user = user
  req.token = token
  next()
}

/** Attach user when present, but never 401. */
export function optionalAuth(req, res, next) {
  const token = getToken(req)
  const user = getUserByToken(token)
  if (user) {
    req.user = user
    req.token = token
  }
  next()
}

/** Require admin role (must run after requireAuth). */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' })
  }
  next()
}

export function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname || u.username,
    avatar: u.avatar || '',
    bio: u.bio || '',
    role: u.role,
    created_at: u.created_at,
  }
}
