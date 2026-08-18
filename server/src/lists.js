// Problem lists (题单) API.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth, requireAuth } from './middleware.js'

export const listsRouter = Router()

function mapList(row, extra = {}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    owner_id: row.owner_id,
    owner_username: row.username,
    owner_nickname: row.nickname || row.username,
    is_public: !!row.is_public,
    problem_count: row.problem_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...extra,
  }
}

// GET /api/lists
listsRouter.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const q = String(req.query.q || '').trim()

  const where = ['(l.is_public = 1 OR l.owner_id = ?)']
  const params = [req.user?.id || -1]
  if (q) {
    where.push('(l.title LIKE ? OR l.description LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (req.query.owner) {
    where.push('u.username = ?')
    params.push(String(req.query.owner))
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM problem_lists l
         JOIN users u ON u.id = l.owner_id
         ${whereSql}`,
    )
    .get(...params).c

  const rows = db
    .prepare(
      `SELECT l.*, u.username, u.nickname,
              (SELECT COUNT(*) FROM problem_list_items i WHERE i.list_id = l.id) AS problem_count
         FROM problem_lists l
         JOIN users u ON u.id = l.owner_id
         ${whereSql}
         ORDER BY l.updated_at DESC
         LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)

  res.json({
    items: rows.map((r) => mapList(r)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/lists/:id
listsRouter.get('/:id', optionalAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT l.*, u.username, u.nickname,
              (SELECT COUNT(*) FROM problem_list_items i WHERE i.list_id = l.id) AS problem_count
         FROM problem_lists l
         JOIN users u ON u.id = l.owner_id
        WHERE l.id = ?`,
    )
    .get(Number(req.params.id))
  if (!row) return res.status(404).json({ error: '题单不存在' })
  if (!row.is_public && req.user?.id !== row.owner_id && req.user?.role !== 'admin') {
    return res.status(403).json({ error: '无权查看该题单' })
  }

  const items = db
    .prepare(
      `SELECT p.id, p.code, p.title, p.difficulty, p.accepted, p.submitted, p.tags, i.ord
         FROM problem_list_items i
         JOIN problems p ON p.id = i.problem_id
        WHERE i.list_id = ?
        ORDER BY i.ord ASC, p.code ASC`,
    )
    .all(row.id)
    .map((p) => ({
      ...p,
      tags: (() => {
        try {
          return JSON.parse(p.tags)
        } catch {
          return []
        }
      })(),
      ac_rate: p.submitted > 0 ? Math.round((p.accepted / p.submitted) * 1000) / 10 : 0,
    }))

  // progress for current user
  let solved = 0
  if (req.user) {
    const acSet = new Set(
      db
        .prepare(
          `SELECT DISTINCT problem_id FROM submissions
            WHERE user_id = ? AND status = 'Accepted'`,
        )
        .all(req.user.id)
        .map((r) => r.problem_id),
    )
    for (const it of items) {
      it.solved = acSet.has(it.id) ? 'AC' : null
      if (it.solved === 'AC') solved++
    }
  }

  res.json(
    mapList(row, {
      problems: items,
      solved_count: solved,
    }),
  )
})

// POST /api/lists
listsRouter.post('/', requireAuth, (req, res) => {
  const b = req.body ?? {}
  const title = String(b.title || '').trim()
  if (!title || title.length > 80) {
    return res.status(400).json({ error: '标题必填，最长 80 字' })
  }
  const description = String(b.description || '').slice(0, 2000)
  const isPublic = b.is_public === false || b.is_public === 0 ? 0 : 1

  const info = db
    .prepare(
      `INSERT INTO problem_lists (title, description, owner_id, is_public)
       VALUES (?, ?, ?, ?)`,
    )
    .run(title, description, req.user.id, isPublic)
  const id = Number(info.lastInsertRowid)

  const problemIds = Array.isArray(b.problem_ids) ? b.problem_ids : []
  const add = db.prepare(
    'INSERT OR IGNORE INTO problem_list_items (list_id, problem_id, ord) VALUES (?, ?, ?)',
  )
  problemIds.forEach((pid, i) => {
    const p = db.prepare('SELECT id FROM problems WHERE id = ?').get(Number(pid))
    if (p) add.run(id, p.id, i)
  })

  const row = db
    .prepare(
      `SELECT l.*, u.username, u.nickname, 0 AS problem_count
         FROM problem_lists l JOIN users u ON u.id = l.owner_id WHERE l.id = ?`,
    )
    .get(id)
  row.problem_count = db
    .prepare('SELECT COUNT(*) AS c FROM problem_list_items WHERE list_id = ?')
    .get(id).c
  res.status(201).json(mapList(row))
})

// PUT /api/lists/:id
listsRouter.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '题单不存在' })
  if (row.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权修改' })
  }

  const b = req.body ?? {}
  const title = b.title !== undefined ? String(b.title).trim() : row.title
  if (!title || title.length > 80) return res.status(400).json({ error: '标题无效' })

  db.prepare(
    `UPDATE problem_lists SET title = ?, description = ?, is_public = ?, updated_at = datetime('now')
      WHERE id = ?`,
  ).run(
    title,
    b.description !== undefined ? String(b.description).slice(0, 2000) : row.description,
    b.is_public !== undefined ? (b.is_public ? 1 : 0) : row.is_public,
    id,
  )

  if (Array.isArray(b.problem_ids)) {
    db.prepare('DELETE FROM problem_list_items WHERE list_id = ?').run(id)
    const add = db.prepare(
      'INSERT OR IGNORE INTO problem_list_items (list_id, problem_id, ord) VALUES (?, ?, ?)',
    )
    b.problem_ids.forEach((pid, i) => {
      const p = db.prepare('SELECT id FROM problems WHERE id = ?').get(Number(pid))
      if (p) add.run(id, p.id, i)
    })
  }

  // return detail
  req.params.id = String(id)
  // fall through by re-fetching
  const updated = db
    .prepare(
      `SELECT l.*, u.username, u.nickname,
              (SELECT COUNT(*) FROM problem_list_items i WHERE i.list_id = l.id) AS problem_count
         FROM problem_lists l JOIN users u ON u.id = l.owner_id WHERE l.id = ?`,
    )
    .get(id)
  res.json(mapList(updated))
})

// DELETE /api/lists/:id
listsRouter.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '题单不存在' })
  if (row.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权删除' })
  }
  db.prepare('DELETE FROM problem_lists WHERE id = ?').run(id)
  res.json({ ok: true })
})

// POST /api/lists/:id/problems  { problem_id }
listsRouter.post('/:id/problems', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '题单不存在' })
  if (row.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权修改' })
  }
  const pid = Number(req.body?.problem_id)
  const p = db.prepare('SELECT id FROM problems WHERE id = ?').get(pid)
  if (!p) return res.status(404).json({ error: '题目不存在' })
  const maxOrd = db
    .prepare('SELECT COALESCE(MAX(ord), -1) AS m FROM problem_list_items WHERE list_id = ?')
    .get(id).m
  db.prepare(
    'INSERT OR IGNORE INTO problem_list_items (list_id, problem_id, ord) VALUES (?, ?, ?)',
  ).run(id, pid, maxOrd + 1)
  db.prepare(`UPDATE problem_lists SET updated_at = datetime('now') WHERE id = ?`).run(id)
  res.json({ ok: true })
})

// DELETE /api/lists/:id/problems/:problemId
listsRouter.delete('/:id/problems/:problemId', requireAuth, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '题单不存在' })
  if (row.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权修改' })
  }
  db.prepare('DELETE FROM problem_list_items WHERE list_id = ? AND problem_id = ?').run(
    id,
    Number(req.params.problemId),
  )
  db.prepare(`UPDATE problem_lists SET updated_at = datetime('now') WHERE id = ?`).run(id)
  res.json({ ok: true })
})
