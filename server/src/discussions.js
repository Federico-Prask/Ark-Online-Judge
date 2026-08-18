// Discussion board API.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth, requireAuth } from './middleware.js'

export const discussionsRouter = Router()

// GET /api/discussions
discussionsRouter.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const q = String(req.query.q || '').trim()

  const where = []
  const params = []
  if (q) {
    where.push('(d.title LIKE ? OR d.body LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (req.query.problem_id) {
    where.push('d.problem_id = ?')
    params.push(Number(req.query.problem_id))
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM discussions d ${whereSql}`)
    .get(...params).c

  const rows = db
    .prepare(
      `SELECT d.*, u.username, u.nickname, u.avatar, p.code AS problem_code
         FROM discussions d
         JOIN users u ON u.id = d.author_id
         LEFT JOIN problems p ON p.id = d.problem_id
         ${whereSql}
         ORDER BY d.pinned DESC, d.updated_at DESC
         LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)

  res.json({
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      author_id: r.author_id,
      author_username: r.username,
      author_nickname: r.nickname || r.username,
      author_avatar: r.avatar || '',
      problem_id: r.problem_id,
      problem_code: r.problem_code,
      pinned: !!r.pinned,
      replies: r.replies,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/discussions/:id
discussionsRouter.get('/:id', (req, res) => {
  const r = db
    .prepare(
      `SELECT d.*, u.username, u.nickname, u.avatar, p.code AS problem_code, p.title AS problem_title
         FROM discussions d
         JOIN users u ON u.id = d.author_id
         LEFT JOIN problems p ON p.id = d.problem_id
        WHERE d.id = ?`,
    )
    .get(Number(req.params.id))
  if (!r) return res.status(404).json({ error: '帖子不存在' })

  const replies = db
    .prepare(
      `SELECT rp.*, u.username, u.nickname, u.avatar
         FROM discussion_replies rp
         JOIN users u ON u.id = rp.author_id
        WHERE rp.discussion_id = ?
        ORDER BY rp.id ASC`,
    )
    .all(r.id)
    .map((x) => ({
      id: x.id,
      body: x.body,
      author_id: x.author_id,
      author_username: x.username,
      author_nickname: x.nickname || x.username,
      author_avatar: x.avatar || '',
      created_at: x.created_at,
    }))

  res.json({
    id: r.id,
    title: r.title,
    body: r.body,
    author_id: r.author_id,
    author_username: r.username,
    author_nickname: r.nickname || r.username,
    author_avatar: r.avatar || '',
    problem_id: r.problem_id,
    problem_code: r.problem_code,
    problem_title: r.problem_title,
    pinned: !!r.pinned,
    replies_count: r.replies,
    replies,
    created_at: r.created_at,
    updated_at: r.updated_at,
  })
})

// POST /api/discussions
discussionsRouter.post('/', requireAuth, (req, res) => {
  const b = req.body ?? {}
  const title = String(b.title || '').trim()
  const body = String(b.body || '').trim()
  if (!title || title.length > 120) return res.status(400).json({ error: '标题 1-120 字' })
  if (!body || body.length > 10000) return res.status(400).json({ error: '正文 1-10000 字' })

  let problemId = null
  if (b.problem_id) {
    const p = db.prepare('SELECT id FROM problems WHERE id = ?').get(Number(b.problem_id))
    if (!p) return res.status(404).json({ error: '关联题目不存在' })
    problemId = p.id
  }

  const info = db
    .prepare(
      `INSERT INTO discussions (title, body, author_id, problem_id)
       VALUES (?, ?, ?, ?)`,
    )
    .run(title, body, req.user.id, problemId)

  res.status(201).json({ id: Number(info.lastInsertRowid) })
})

// POST /api/discussions/:id/replies
discussionsRouter.post('/:id/replies', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const d = db.prepare('SELECT id FROM discussions WHERE id = ?').get(id)
  if (!d) return res.status(404).json({ error: '帖子不存在' })
  const body = String(req.body?.body || '').trim()
  if (!body || body.length > 5000) return res.status(400).json({ error: '回复 1-5000 字' })

  const info = db
    .prepare(
      `INSERT INTO discussion_replies (discussion_id, author_id, body) VALUES (?, ?, ?)`,
    )
    .run(id, req.user.id, body)
  db.prepare(
    `UPDATE discussions SET replies = replies + 1, updated_at = datetime('now') WHERE id = ?`,
  ).run(id)

  res.status(201).json({ id: Number(info.lastInsertRowid) })
})
