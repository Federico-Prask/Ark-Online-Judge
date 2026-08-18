// Auth routes: register / login / logout / me, plus cookie helpers.
import { Router } from 'express'
import { db } from './db.js'
import { hashPassword, verifyPassword } from './passwords.js'
import { createSession, destroySession, SESSION_TTL_MS } from './sessions.js'
import { COOKIE_NAME, getToken, requireAuth, publicUser } from './middleware.js'

export { COOKIE_NAME }

const USERNAME_RE = /^[A-Za-z0-9_]{3,32}$/
const MIN_PASSWORD_LEN = 6

function attachSession(res, token) {
  // Single Set-Cookie header (avoid duplicates from append + res.cookie).
  const secure = process.env.NODE_ENV === 'production'
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000)
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

export { requireAuth, publicUser, getToken }

export const authRouter = Router()

// GET /api/auth/me — current session user
authRouter.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user))
})

// PUT /api/auth/profile — edit own profile (nickname / avatar / bio)
authRouter.put('/profile', requireAuth, (req, res) => {
  const body = req.body ?? {}
  const updates = {}

  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim()
    if (!nickname || nickname.length > 32) {
      return res.status(400).json({ error: '昵称需为 1-32 个字符' })
    }
    updates.nickname = nickname
  }
  if (body.avatar !== undefined) {
    const avatar = String(body.avatar).trim()
    if (avatar.length > 500) {
      return res.status(400).json({ error: '头像地址过长（最多 500 字符）' })
    }
    updates.avatar = avatar || null
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim()
    if (bio.length > 200) {
      return res.status(400).json({ error: '简介过长（最多 200 字符）' })
    }
    updates.bio = bio || null
  }

  const keys = Object.keys(updates)
  if (keys.length === 0) {
    return res.status(400).json({ error: '没有可更新的字段' })
  }

  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  db.prepare(`UPDATE users SET ${setSql} WHERE id = ?`).run(
    ...keys.map((k) => updates[k]),
    req.user.id,
  )

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json(publicUser(row))
})

// POST /api/auth/register — create account, auto-login
authRouter.post('/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: '用户名需为 3-32 位字母、数字或下划线' })
  }
  if (password.length < MIN_PASSWORD_LEN) {
    return res.status(400).json({ error: `密码至少需要 ${MIN_PASSWORD_LEN} 位` })
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) return res.status(409).json({ error: '用户名已被占用' })

  const { salt, hash } = hashPassword(password)
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, `${salt}:${hash}`, 'user')
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid))
  const { token } = createSession(row.id)
  attachSession(res, token)
  res.status(201).json({ token, user: publicUser(row) })
})

// POST /api/auth/login — exchange credentials for a session
authRouter.post('/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  const { token } = createSession(row.id)
  attachSession(res, token)
  res.json({ token, user: publicUser(row) })
})

// POST /api/auth/logout — revoke the current session
authRouter.post('/logout', (req, res) => {
  const token = getToken(req)
  if (token) destroySession(token)
  res.clearCookie(COOKIE_NAME, { path: '/' })
  res.json({ ok: true })
})
