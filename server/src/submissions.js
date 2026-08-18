// Submission API + status polling.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth, requireAuth } from './middleware.js'
import { enqueueJudge } from './judge.js'

export const submissionsRouter = Router()

const LANGS = new Set(['javascript', 'cpp', 'python', 'java', 'c', 'go', 'rust'])

function mapSub(row, { withCode = false } = {}) {
  if (!row) return null
  const out = {
    id: row.id,
    user_id: row.user_id,
    username: row.username,
    nickname: row.nickname || row.username,
    problem_id: row.problem_id,
    problem_code: row.problem_code,
    problem_title: row.problem_title,
    language: row.language,
    status: row.status,
    time_ms: row.time_ms,
    memory_kb: row.memory_kb,
    score: row.score,
    detail: row.detail || '',
    contest_id: row.contest_id,
    created_at: row.created_at,
  }
  if (withCode) out.code = row.code
  return out
}

const SELECT = `
  SELECT s.*, u.username, u.nickname, p.code AS problem_code, p.title AS problem_title
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    JOIN problems p ON p.id = s.problem_id
`

// GET /api/submissions
submissionsRouter.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const where = []
  const params = []
  if (req.query.user_id) {
    where.push('s.user_id = ?')
    params.push(Number(req.query.user_id))
  }
  if (req.query.username) {
    where.push('u.username = ?')
    params.push(String(req.query.username))
  }
  if (req.query.problem_id) {
    where.push('s.problem_id = ?')
    params.push(Number(req.query.problem_id))
  }
  if (req.query.problem) {
    where.push('(p.code = ? OR p.id = ?)')
    params.push(String(req.query.problem), Number(req.query.problem) || -1)
  }
  if (req.query.status) {
    where.push('s.status = ?')
    params.push(String(req.query.status))
  }
  if (req.query.contest_id) {
    where.push('s.contest_id = ?')
    params.push(Number(req.query.contest_id))
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM submissions s
         JOIN users u ON u.id = s.user_id
         JOIN problems p ON p.id = s.problem_id
         ${whereSql}`,
    )
    .get(...params).c

  const rows = db
    .prepare(
      `${SELECT} ${whereSql}
        ORDER BY s.id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)

  res.json({
    items: rows.map((r) => mapSub(r)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/submissions/:id
submissionsRouter.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare(`${SELECT} WHERE s.id = ?`).get(Number(req.params.id))
  if (!row) return res.status(404).json({ error: '提交不存在' })

  const isOwner = req.user && req.user.id === row.user_id
  const isAdmin = req.user && req.user.role === 'admin'
  // Show code to owner/admin; others only see metadata
  res.json(mapSub(row, { withCode: !!(isOwner || isAdmin) }))
})

// POST /api/submissions
submissionsRouter.post('/', requireAuth, (req, res) => {
  const b = req.body ?? {}
  let problemId = Number(b.problem_id)
  if (!problemId && b.problem) {
    const p = /^\d+$/.test(String(b.problem))
      ? db.prepare('SELECT id FROM problems WHERE id = ?').get(Number(b.problem))
      : db.prepare('SELECT id FROM problems WHERE code = ?').get(String(b.problem))
    problemId = p?.id
  }
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId)
  if (!problem || !problem.is_public) {
    return res.status(404).json({ error: '题目不存在' })
  }

  const language = String(b.language || 'javascript').toLowerCase()
  if (!LANGS.has(language) && language !== 'js') {
    return res.status(400).json({
      error: `不支持的语言。可选：${[...LANGS].join(', ')}`,
    })
  }
  const code = String(b.code ?? '')
  if (!code.trim()) return res.status(400).json({ error: '代码不能为空' })
  if (code.length > 64 * 1024) return res.status(400).json({ error: '代码过长（最大 64KB）' })

  let contestId = null
  if (b.contest_id) {
    const c = db.prepare('SELECT * FROM contests WHERE id = ?').get(Number(b.contest_id))
    if (!c) return res.status(404).json({ error: '比赛不存在' })
    const now = Date.now()
    const start = new Date(c.start_at.replace(' ', 'T') + 'Z').getTime()
    const end = new Date(c.end_at.replace(' ', 'T') + 'Z').getTime()
    // allow local-time ISO without Z fallback
    const startMs = Number.isFinite(start) ? start : Date.parse(c.start_at)
    const endMs = Number.isFinite(end) ? end : Date.parse(c.end_at)
    if (now < startMs || now > endMs) {
      return res.status(403).json({ error: '比赛未在进行中，无法提交' })
    }
    const reg = db
      .prepare('SELECT 1 FROM contest_registrations WHERE contest_id = ? AND user_id = ?')
      .get(c.id, req.user.id)
    if (!reg) return res.status(403).json({ error: '请先报名比赛' })
    // problem must belong to contest
    const cp = db
      .prepare('SELECT 1 FROM contest_problems WHERE contest_id = ? AND problem_id = ?')
      .get(c.id, problem.id)
    if (!cp) return res.status(400).json({ error: '该题不属于此比赛' })
    contestId = c.id
  }

  const lang = language === 'js' ? 'javascript' : language
  const info = db
    .prepare(
      `INSERT INTO submissions (user_id, problem_id, language, code, status, contest_id)
       VALUES (?, ?, ?, ?, 'Pending', ?)`,
    )
    .run(req.user.id, problem.id, lang, code, contestId)

  const sid = Number(info.lastInsertRowid)
  enqueueJudge(sid)

  const row = db.prepare(`${SELECT} WHERE s.id = ?`).get(sid)
  res.status(201).json(mapSub(row, { withCode: true }))
})
