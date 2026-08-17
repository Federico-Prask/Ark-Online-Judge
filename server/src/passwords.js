// Password hashing with Node's built-in scrypt (no native deps).
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LEN = 64

/**
 * Hash a plaintext password.
 * @returns {{ salt: string, hash: string }} hex-encoded pair
 */
export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEY_LEN)
  return { salt: salt.toString('hex'), hash: hash.toString('hex') }
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 * Constant-time comparison to avoid timing side channels.
 */
export function verifyPassword(password, stored) {
  const idx = stored.indexOf(':')
  if (idx <= 0) return false
  const salt = Buffer.from(stored.slice(0, idx), 'hex')
  const expected = Buffer.from(stored.slice(idx + 1), 'hex')
  if (salt.length === 0 || expected.length !== KEY_LEN) return false
  const actual = scryptSync(password, salt, KEY_LEN)
  return timingSafeEqual(expected, actual)
}
