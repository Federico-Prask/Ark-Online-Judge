// Problem bank API.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth, requireAuth, requireAdmin } from './middleware.js'

export const problemsRouter = Router()

const DIFFICULTIES = new Set(['入门', '进阶', '困难'])

function parseJson(val, fallback) {
  try {
    return JSON.parse(val ?? '')
  } catch {
    return fallback
  }
}

function mapProblem(row, { withContent = false, solvedMap = null } = {}) {
  if (!row) return null
  const base = {
    id: row.id,
    code: row.code,
    title: row.title,
    difficulty: row.difficulty,
    time_limit: row.time_limit,
    memory_limit: row.memory_limit,
    tags: parseJson(row.tags, []),
    source: row.source || '',
    accepted: row.accepted,
    submitted: row.submitted,
    ac_rate:
      row.submitted > 0 ? Math.round((row.accepted / row.submitted) * 1000) / 10 : 0,
    is_public: !!row.is_public,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
  if (solvedMap) {
    base.solved = solvedMap.get(row.id) || null // 'AC' | 'TRIED' | null
  }
  if (withContent) {
    base.description = row.description
    base.input_format = row.input_format
    base.output_format = row.output_format
    base.samples = parseJson(row.samples, [])
    base.hint = row.hint || ''
    base.author_id = row.author_id
  }
  return base
}

function userSolvedMap(userId) {
  const map = new Map()
  if (!userId) return map
  const rows = db
    .prepare(
      `SELECT problem_id,
              MAX(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) AS ac,
              COUNT(*) AS cnt
         FROM submissions
        WHERE user_id = ?
        GROUP BY problem_id`,
    )
    .all(userId)
  for (const r of rows) {
    map.set(r.problem_id, r.ac ? 'AC' : 'TRIED')
  }
  return map
}

// GET /api/problems
problemsRouter.get('/', optionalAuth, (req, res) => {
  const q = String(req.query.q || '').trim()
  const difficulty = String(req.query.difficulty || '').trim()
  const tag = String(req.query.tag || '').trim()
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize

  const where = ['is_public = 1']
  const params = []
  if (q) {
    where.push('(code LIKE ? OR title LIKE ? OR tags LIKE ?)')
    const like = `%${q}%`
    params.push(like, like, like)
  }
  if (difficulty && DIFFICULTIES.has(difficulty)) {
    where.push('difficulty = ?')
    params.push(difficulty)
  }
  if (tag) {
    where.push('tags LIKE ?')
    params.push(`%${tag}%`)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  const total = db.prepare(`SELECT COUNT(*) AS c FROM problems ${whereSql}`).get(...params).c
  const rows = db
    .prepare(
      `SELECT * FROM problems ${whereSql}
        ORDER BY code ASC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset)

  const solvedMap = userSolvedMap(req.user?.id)
  res.json({
    items: rows.map((r) => mapProblem(r, { solvedMap })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/problems/tags
problemsRouter.get('/tags', (_req, res) => {
  const rows = db.prepare('SELECT tags FROM problems WHERE is_public = 1').all()
  const set = new Map()
  for (const r of rows) {
    for (const t of parseJson(r.tags, [])) {
      set.set(t, (set.get(t) || 0) + 1)
    }
  }
  const tags = [...set.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  res.json({ tags })
})

// GET /api/problems/:idOrCode
problemsRouter.get('/:idOrCode', optionalAuth, (req, res) => {
  const key = req.params.idOrCode
  const row = /^\d+$/.test(key)
    ? db.prepare('SELECT * FROM problems WHERE id = ?').get(Number(key))
    : db.prepare('SELECT * FROM problems WHERE code = ?').get(key)
  if (!row || (!row.is_public && req.user?.role !== 'admin')) {
    return res.status(404).json({ error: '题目不存在' })
  }
  const solvedMap = userSolvedMap(req.user?.id)
  res.json(mapProblem(row, { withContent: true, solvedMap }))
})

// POST /api/problems  (admin)
problemsRouter.post('/', requireAuth, requireAdmin, (req, res) => {
  const b = req.body ?? {}
  const code = String(b.code || '').trim().toUpperCase()
  const title = String(b.title || '').trim()
  if (!/^[A-Z][A-Z0-9]{2,15}$/.test(code)) {
    return res.status(400).json({ error: '题号格式：字母开头，3-16 位大写字母/数字' })
  }
  if (!title || title.length > 100) {
    return res.status(400).json({ error: '标题必填，最长 100 字' })
  }
  const difficulty = DIFFICULTIES.has(b.difficulty) ? b.difficulty : '入门'
  const tags = Array.isArray(b.tags) ? b.tags.map(String).slice(0, 12) : []
  const samples = Array.isArray(b.samples) ? b.samples : []
  const tests = Array.isArray(b.tests) ? b.tests : samples

  try {
    const info = db
      .prepare(
        `INSERT INTO problems
           (code, title, description, input_format, output_format, samples, hint,
            difficulty, time_limit, memory_limit, tags, source, author_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        code,
        title,
        String(b.description || ''),
        String(b.input_format || ''),
        String(b.output_format || ''),
        JSON.stringify(samples),
        String(b.hint || ''),
        difficulty,
        Number(b.time_limit) || 1000,
        Number(b.memory_limit) || 256,
        JSON.stringify(tags),
        String(b.source || ''),
        req.user.id,
      )
    const pid = Number(info.lastInsertRowid)
    const insertTc = db.prepare(
      `INSERT INTO test_cases (problem_id, input, output, is_sample, score, ord)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    tests.forEach((t, i) => {
      insertTc.run(
        pid,
        String(t.input ?? ''),
        String(t.output ?? ''),
        t.is_sample || samples.some((s) => s.input === t.input) ? 1 : 0,
        i,
      )
    })
    // also ensure samples are present as test cases
    samples.forEach((s, i) => {
      const exists = db
        .prepare('SELECT id FROM test_cases WHERE problem_id = ? AND input = ? AND output = ?')
        .get(pid, String(s.input ?? ''), String(s.output ?? ''))
      if (!exists) {
        insertTc.run(pid, String(s.input ?? ''), String(s.output ?? ''), 1, 1000 + i)
      }
    })

    const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(pid)
    res.status(201).json(mapProblem(row, { withContent: true }))
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) {
      return res.status(409).json({ error: '题号已存在' })
    }
    throw e
  }
})

// PUT /api/problems/:id (admin)
problemsRouter.put('/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: '题目不存在' })

  const b = req.body ?? {}
  const title = b.title !== undefined ? String(b.title).trim() : row.title
  if (!title || title.length > 100) return res.status(400).json({ error: '标题无效' })

  const difficulty =
    b.difficulty !== undefined && DIFFICULTIES.has(b.difficulty) ? b.difficulty : row.difficulty
  const tags =
    b.tags !== undefined
      ? JSON.stringify(Array.isArray(b.tags) ? b.tags.map(String).slice(0, 12) : [])
      : row.tags
  const samples =
    b.samples !== undefined ? JSON.stringify(Array.isArray(b.samples) ? b.samples : []) : row.samples

  db.prepare(
    `UPDATE problems SET
       title = ?, description = ?, input_format = ?, output_format = ?,
       samples = ?, hint = ?, difficulty = ?, time_limit = ?, memory_limit = ?,
       tags = ?, source = ?, is_public = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    title,
    b.description !== undefined ? String(b.description) : row.description,
    b.input_format !== undefined ? String(b.input_format) : row.input_format,
    b.output_format !== undefined ? String(b.output_format) : row.output_format,
    samples,
    b.hint !== undefined ? String(b.hint) : row.hint,
    difficulty,
    b.time_limit !== undefined ? Number(b.time_limit) || 1000 : row.time_limit,
    b.memory_limit !== undefined ? Number(b.memory_limit) || 256 : row.memory_limit,
    tags,
    b.source !== undefined ? String(b.source) : row.source,
    b.is_public !== undefined ? (b.is_public ? 1 : 0) : row.is_public,
    id,
  )

  const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(id)
  res.json(mapProblem(updated, { withContent: true }))
})
