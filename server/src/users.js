// Public user profiles + ranking.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth } from './middleware.js'

export const usersRouter = Router()

function avatarOf(u) {
  return u.avatar || ''
}

// GET /api/users/rank
usersRouter.get('/rank', (_req, res) => {
  const page = Math.max(1, Number(_req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(_req.query.pageSize) || 50))
  const offset = (page - 1) * pageSize

  // Ranking by distinct AC count, then by total submissions (fewer is better), then by id.
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.nickname, u.avatar, u.bio, u.role, u.created_at,
              COALESCE(ac.solved, 0) AS solved,
              COALESCE(sub.submitted, 0) AS submitted
         FROM users u
         LEFT JOIN (
           SELECT user_id, COUNT(DISTINCT problem_id) AS solved
             FROM submissions WHERE status = 'Accepted'
            GROUP BY user_id
         ) ac ON ac.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS submitted
             FROM submissions GROUP BY user_id
         ) sub ON sub.user_id = u.id
        ORDER BY solved DESC, submitted ASC, u.id ASC
        LIMIT ? OFFSET ?`,
    )
    .all(pageSize, offset)

  const total = db.prepare('SELECT COUNT(*) AS c FROM users').get().c

  res.json({
    items: rows.map((r, i) => ({
      rank: offset + i + 1,
      id: r.id,
      username: r.username,
      nickname: r.nickname || r.username,
      avatar: avatarOf(r),
      bio: r.bio || '',
      role: r.role,
      solved: r.solved,
      submitted: r.submitted,
      ac_rate: r.submitted > 0 ? Math.round((r.solved / r.submitted) * 1000) / 10 : 0,
      created_at: r.created_at,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})

// GET /api/users/:username
usersRouter.get('/:username', optionalAuth, (req, res) => {
  const username = String(req.params.username)
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!u) return res.status(404).json({ error: '用户不存在' })

  const solved = db
    .prepare(
      `SELECT COUNT(DISTINCT problem_id) AS c FROM submissions
        WHERE user_id = ? AND status = 'Accepted'`,
    )
    .get(u.id).c
  const submitted = db
    .prepare('SELECT COUNT(*) AS c FROM submissions WHERE user_id = ?')
    .get(u.id).c
  const acCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM submissions WHERE user_id = ? AND status = 'Accepted'`,
    )
    .get(u.id).c

  // rank position
  const better = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT user_id, COUNT(DISTINCT problem_id) AS solved
           FROM submissions WHERE status = 'Accepted'
          GROUP BY user_id
          HAVING solved > ?
       )`,
    )
    .get(solved).c
  const rank = better + 1

  // recent ACs
  const recentSolved = db
    .prepare(
      `SELECT p.id, p.code, p.title, p.difficulty, MIN(s.created_at) AS first_ac_at
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.user_id = ? AND s.status = 'Accepted'
        GROUP BY p.id
        ORDER BY first_ac_at DESC
        LIMIT 12`,
    )
    .all(u.id)

  // recent submissions
  const recentSubs = db
    .prepare(
      `SELECT s.id, s.status, s.language, s.time_ms, s.created_at,
              p.code AS problem_code, p.title AS problem_title
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.user_id = ?
        ORDER BY s.id DESC
        LIMIT 10`,
    )
    .all(u.id)

  // difficulty breakdown
  const byDiff = db
    .prepare(
      `SELECT p.difficulty, COUNT(DISTINCT s.problem_id) AS c
         FROM submissions s
         JOIN problems p ON p.id = s.problem_id
        WHERE s.user_id = ? AND s.status = 'Accepted'
        GROUP BY p.difficulty`,
    )
    .all(u.id)
  const difficulty = { 入门: 0, 进阶: 0, 困难: 0 }
  for (const r of byDiff) difficulty[r.difficulty] = r.c

  // lists owned
  const lists = db
    .prepare(
      `SELECT l.id, l.title, l.is_public,
              (SELECT COUNT(*) FROM problem_list_items i WHERE i.list_id = l.id) AS problem_count
         FROM problem_lists l
        WHERE l.owner_id = ? AND (l.is_public = 1 OR l.owner_id = ?)
        ORDER BY l.updated_at DESC
        LIMIT 8`,
    )
    .all(u.id, req.user?.id || -1)

  // contest participations
  const contests = db
    .prepare(
      `SELECT c.id, c.title, c.start_at, c.end_at, c.rule
         FROM contest_registrations r
         JOIN contests c ON c.id = r.contest_id
        WHERE r.user_id = ?
        ORDER BY c.start_at DESC
        LIMIT 8`,
    )
    .all(u.id)

  res.json({
    id: u.id,
    username: u.username,
    nickname: u.nickname || u.username,
    avatar: avatarOf(u),
    bio: u.bio || '',
    role: u.role,
    created_at: u.created_at,
    stats: {
      solved,
      submitted,
      ac_submissions: acCount,
      ac_rate: submitted > 0 ? Math.round((acCount / submitted) * 1000) / 10 : 0,
      rank,
      difficulty,
    },
    recent_solved: recentSolved,
    recent_submissions: recentSubs,
    lists,
    contests,
  })
})
