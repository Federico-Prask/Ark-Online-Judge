// SQLite storage via Node's built-in `node:sqlite` module (Node >= 22.5).
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from './passwords.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.ARKOJ_DATA_DIR || path.join(__dirname, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const DB_PATH = path.join(DATA_DIR, 'arkoj.db')
export const db = new DatabaseSync(DB_PATH)

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`)

// Migrate older databases: add profile columns when missing.
function ensureColumn(table, column, ddl) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
    console.log(`[arkoj] migrated users: added column ${column}`)
  }
}
ensureColumn('users', 'nickname', 'nickname TEXT')
ensureColumn('users', 'avatar', 'avatar TEXT')
ensureColumn('users', 'bio', 'bio TEXT')

// Seed an admin account on first boot so the system is immediately usable.
function seedAdmin() {
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin')
  if (exists) return
  const { salt, hash } = hashPassword(process.env.ARKOJ_ADMIN_PASSWORD || 'admin123')
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(
    'admin',
    `${salt}:${hash}`,
    'admin',
  )
  console.log('[arkoj] seeded admin account: admin / admin123 (change it after first login)')
}
seedAdmin()
