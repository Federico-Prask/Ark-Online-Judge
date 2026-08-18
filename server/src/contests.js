// Contests API: list / detail / register / rankboard.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth, requireAuth, requireAdmin } from './middleware.js'

export const contestsRouter = Router()

function parseTs(s) {
  if (!s) return NaN
  // Accept "YYYY-MM-DD HH:mm:ss" (UTC-ish stored) and full ISO.
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (Number.isFinite(t)) return t
  return Date.parse(s)
}

function contestStatus(row, now = Date.now()) {
  const start = parseTs(row.start_at)
  const end = parseTs(row.end_at)
  if (now < start) return 'upcoming'
  if (now > end) return 'ended'
  return 'running'
}

function mapContest(row, extra = {}) {
  const status = contestStatus(row)
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    rule: row.rule || 'ACM',
    start_at: row.start_at,
    end_at: row.end_at,
    is_public: !!row.is_public,
    created_by: row.created_by,
    created_at: row.created_at,
    status,
    problem_count: row.problem_count ?? 0,
    participant_count: row.participant_count ?? 0,
    ...extra,
  }
}

// GET /api/contests
contestsRouter.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20))
  const offset = (page - 1) * pageSize
  const statusFilter = String(req.query.status || '').trim() // upcoming|running|ended
  const q = String(req.query.q || '').trim()

  const where = ['is_public = 1']
  const params = []
  if (q) {
    where.push('(title LIKE ? OR description LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  const whereSql = `WHERE ${where.join(' AND ')}`

  let rows = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM contest_problems cp WHERE cp.contest_id = c.id) AS problem_count,
              (SELECT COUNT(*) FROM contest_registrations r WHERE r.contest_id = c.id) AS participant_count
         FROM contests c
         ${whereSql}
         ORDER BY c.start_at DESC`,
    )
    .all(...params)
    .map((r) => mapContest(r))

  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter)

  const total = rows.length
  const items = rows.slice(offset, offset + pageSize)

  // mark registration for current user
  if (req.user) {
    const regs = new Set(
      db
        .prepare('SELECT contest_id FROM contest_registrations WHERE user_id = ?')
        .all(req.user.id)
        .map((r) => r.contest_id),
    )
    for (const it of items) it.registered = regs.has(it.id)
  }

  res.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/contests/:id
contestsRouter.get('/:id', optionalAuth, (req, res) => {
  const row = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM contest_problems cp WHERE cp.contest_id = c.id) AS problem_count,
              (SELECT COUNT(*) FROM contest_registrations r WHERE r.contest_id = c.id) AS participant_count
         FROM contests c WHERE c.id = ?`,
    )
    .get(Number(req.params.id))
  if (!row || (!row.is_public && req.user?.role !== 'admin')) {
    return res.status(404).json({ error: '比赛不存在' })
  }

  const status = contestStatus(row)
  let registered = false
  if (req.user) {
    registered = !!db
      .prepare('SELECT 1 FROM contest_registrations WHERE contest_id = ? AND user_id = ?')
      .get(row.id, req.user.id)
  }

  // Problems visible when running/ended, or always for admin/registered during contest
  let problems = []
  const canSeeProblems =
    status !== 'upcoming' || req.user?.role === 'admin' || registered
  if (canSeeProblems && status !== 'upcoming') {
    problems = db
      .prepare(
        `SELECT cp.label, cp.score, cp.ord, p.id, p.code, p.title, p.difficulty,
                p.accepted, p.submitted
           FROM contest_problems cp
           JOIN problems p ON p.id = cp.problem_id
          WHERE cp.contest_id = ?
          ORDER BY cp.ord ASC`,
      )
      .all(row.id)

    if (req.user) {
      const acSet = new Set(
        db
          .prepare(
            `SELECT DISTINCT problem_id FROM submissions
              WHERE user_id = ? AND contest_id = ? AND status = 'Accepted'`,
          )
          .all(req.user.id, row.id)
          .map((r) => r.problem_id),
      )
      const tried = new Set(
        db
          .prepare(
            `SELECT DISTINCT problem_id FROM submissions
              WHERE user_id = ? AND contest_id = ?`,
          )
          .all(req.user.id, row.id)
          .map((r) => r.problem_id),
      )
      for (const p of problems) {
        p.solved = acSet.has(p.id) ? 'AC' : tried.has(p.id) ? 'TRIED' : null
      }
    }
  } else if (status === 'upcoming') {
    // only labels/count before start
    problems = db
      .prepare(
        `SELECT cp.label, cp.score, cp.ord FROM contest_problems cp
          WHERE cp.contest_id = ? ORDER BY cp.ord ASC`,
      )
      .all(row.id)
  }

  res.json(
    mapContest(row, {
      registered,
      problems,
    }),
  )
})

// POST /api/contests/:id/register
contestsRouter.post('/:id/register', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM contests WHERE id = ?').get(Number(req.params.id))
  if (!row || !row.is_public) return res.status(404).json({ error: '比赛不存在' })
  const status = contestStatus(row)
  if (status === 'ended') return res.status(403).json({ error: '比赛已结束，无法报名' })

  db.prepare(
    'INSERT OR IGNORE INTO contest_registrations (contest_id, user_id) VALUES (?, ?)',
  ).run(row.id, req.user.id)
  res.json({ ok: true, registered: true })
})

// DELETE /api/contests/:id/register
contestsRouter.delete('/:id/register', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM contests WHERE id = ?').get(Number(req.params.id))
  if (!row) return res.status(404).json({ error: '比赛不存在' })
  if (contestStatus(row) === 'running') {
    return res.status(403).json({ error: '比赛进行中，无法取消报名' })
  }
  db.prepare('DELETE FROM contest_registrations WHERE contest_id = ? AND user_id = ?').run(
    row.id,
    req.user.id,
  )
  res.json({ ok: true, registered: false })
})

// GET /api/contests/:id/rank
contestsRouter.get('/:id/rank', optionalAuth, (req, res) => {
  const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(Number(req.params.id))
  if (!contest) return res.status(404).json({ error: '比赛不存在' })

  const problems = db
    .prepare(
      `SELECT cp.problem_id, cp.label, cp.ord
         FROM contest_problems cp WHERE cp.contest_id = ? ORDER BY cp.ord ASC`,
    )
    .all(contest.id)

  const regs = db
    .prepare(
      `SELECT r.user_id, u.username, u.nickname, u.avatar
         FROM contest_registrations r
         JOIN users u ON u.id = r.user_id
        WHERE r.contest_id = ?`,
    )
    .all(contest.id)

  const subs = db
    .prepare(
      `SELECT user_id, problem_id, status, created_at, score
         FROM submissions
        WHERE contest_id = ?
        ORDER BY id ASC`,
    )
    .all(contest.id)

  const startMs = parseTs(contest.start_at)
  const isOI = (contest.rule || 'ACM').toUpperCase() === 'OI'

  // Build per-user stats
  const board = regs.map((u) => {
    const cell = {}
    for (const p of problems) {
      cell[p.problem_id] = {
        label: p.label,
        attempts: 0,
        ac: false,
        ac_time: null, // minutes from start
        score: 0,
        pending: false,
      }
    }
    return {
      user_id: u.user_id,
      username: u.username,
      nickname: u.nickname || u.username,
      avatar: u.avatar || '',
      solved: 0,
      penalty: 0,
      score: 0,
      cells: cell,
    }
  })
  const byUser = new Map(board.map((b) => [b.user_id, b]))

  for (const s of subs) {
    const u = byUser.get(s.user_id)
    if (!u || !u.cells[s.problem_id]) continue
    const c = u.cells[s.problem_id]
    if (s.status === 'Pending' || s.status === 'Judging') {
      c.pending = true
      continue
    }
    if (c.ac && !isOI) continue // ACM: freeze after first AC
    c.attempts++
    if (isOI) {
      // last score wins
      c.score = s.score || 0
      if (s.status === 'Accepted') c.ac = true
    } else if (s.status === 'Accepted') {
      c.ac = true
      const t = parseTs(s.created_at)
      c.ac_time = Math.max(0, Math.floor((t - startMs) / 60000))
    }
  }

  for (const u of board) {
    let solved = 0
    let penalty = 0
    let score = 0
    for (const p of problems) {
      const c = u.cells[p.problem_id]
      if (isOI) {
        score += c.score
        if (c.ac) solved++
      } else if (c.ac) {
        solved++
        penalty += c.ac_time + Math.max(0, c.attempts - 1) * 20
      }
    }
    u.solved = solved
    u.penalty = penalty
    u.score = isOI ? score : solved
  }

  board.sort((a, b) => {
    if (isOI) {
      if (b.score !== a.score) return b.score - a.score
      return a.penalty - b.penalty
    }
    if (b.solved !== a.solved) return b.solved - a.solved
    return a.penalty - b.penalty
  })

  // rank numbers (dense)
  let rank = 0
  let lastKey = null
  for (let i = 0; i < board.length; i++) {
    const key = isOI ? `${board[i].score}` : `${board[i].solved}-${board[i].penalty}`
    if (key !== lastKey) {
      rank = i + 1
      lastKey = key
    }
    board[i].rank = rank
    // flatten cells to array ordered by problems
    board[i].problems = problems.map((p) => ({
      label: p.label,
      ...board[i].cells[p.problem_id],
    }))
    delete board[i].cells
  }

  res.json({
    contest_id: contest.id,
    rule: contest.rule,
    status: contestStatus(contest),
    problems: problems.map((p) => ({ label: p.label, problem_id: p.problem_id })),
    ranking: board,
  })
})

// POST /api/contests  (admin)
contestsRouter.post('/', requireAuth, requireAdmin, (req, res) => {
  const b = req.body ?? {}
  const title = String(b.title || '').trim()
  if (!title || title.length > 100) return res.status(400).json({ error: '标题必填' })
  const start_at = String(b.start_at || '').trim()
  const end_at = String(b.end_at || '').trim()
  if (!start_at || !end_at) return res.status(400).json({ error: '需要 start_at / end_at' })
  if (parseTs(end_at) <= parseTs(start_at)) {
    return res.status(400).json({ error: '结束时间必须晚于开始时间' })
  }
  const rule = String(b.rule || 'ACM').toUpperCase() === 'OI' ? 'OI' : 'ACM'

  const info = db
    .prepare(
      `INSERT INTO contests (title, description, rule, start_at, end_at, is_public, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      String(b.description || ''),
      rule,
      start_at,
      end_at,
      b.is_public === false || b.is_public === 0 ? 0 : 1,
      req.user.id,
    )
  const id = Number(info.lastInsertRowid)

  if (Array.isArray(b.problems)) {
    const add = db.prepare(
      `INSERT OR IGNORE INTO contest_problems (contest_id, problem_id, label, score, ord)
       VALUES (?, ?, ?, ?, ?)`,
    )
    b.problems.forEach((p, i) => {
      const pid = Number(p.problem_id || p.id)
      const exists = db.prepare('SELECT id FROM problems WHERE id = ?').get(pid)
      if (!exists) return
      add.run(
        id,
        pid,
        String(p.label || String.fromCharCode(65 + i)),
        Number(p.score) || 100,
        i,
      )
    })
  }

  const row = db.prepare('SELECT * FROM contests WHERE id = ?').get(id)
  res.status(201).json(mapContest(row))
})
