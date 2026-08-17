// Opaque session tokens. Only a SHA-256 digest of the token is stored,
// so a database leak never exposes usable credentials.
import { createHash, randomBytes } from 'node:crypto'
import { db } from './db.js'

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expiresAt,
  )
  return { token, expiresAt }
}

/** Resolve a token to its user, or null when missing/expired. */
export function getUserByToken(token) {
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.bio, u.role, u.created_at, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?`,
    )
    .get(hashToken(token))
  if (!row) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
    return null
  }
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    bio: row.bio,
    role: row.role,
    created_at: row.created_at,
  }
}

export function destroySession(token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}
