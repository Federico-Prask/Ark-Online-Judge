// Home / dashboard aggregate stats.
import { Router } from 'express'
import { db } from './db.js'
import { optionalAuth } from './middleware.js'

export const statsRouter = Router()

statsRouter.get('/overview', optionalAuth, (req, res) => {
  const problems = db.prepare('SELECT COUNT(*) AS c FROM problems WHERE is_public = 1').get().c
  const users = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  const submissions = db.prepare('SELECT COUNT(*) AS c FROM submissions').get().c
  const contests = db.prepare('SELECT COUNT(*) AS c FROM contests WHERE is_public = 1').get().c

  const recentProblems = db
    .prepare(
      `SELECT id, code, title, difficulty, accepted, submitted, tags
         FROM problems WHERE is_public = 1
         ORDER BY id DESC LIMIT 6`,
    )
    .all()
    .map((p) => ({
      ...p,
      tags: safeJson(p.tags, []),
      ac_rate: p.submitted > 0 ? Math.round((p.accepted / p.submitted) * 1000) / 10 : 0,
    }))

  // recommended: mix of unsolved + popular
  let recommended = recentProblems
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
    recommended = db
      .prepare(
        `SELECT id, code, title, difficulty, accepted, submitted, tags
           FROM problems WHERE is_public = 1
           ORDER BY accepted DESC LIMIT 20`,
      )
      .all()
      .filter((p) => !acSet.has(p.id))
      .slice(0, 6)
      .map((p) => ({
        ...p,
        tags: safeJson(p.tags, []),
        ac_rate: p.submitted > 0 ? Math.round((p.accepted / p.submitted) * 1000) / 10 : 0,
      }))
    if (recommended.length < 3) recommended = recentProblems
  }

  const nextContest = db
    .prepare(
      `SELECT id, title, start_at, end_at, rule,
              (SELECT COUNT(*) FROM contest_registrations r WHERE r.contest_id = contests.id) AS participant_count
         FROM contests
        WHERE is_public = 1 AND end_at > datetime('now')
        ORDER BY start_at ASC
        LIMIT 1`,
    )
    .get()

  let me = null
  if (req.user) {
    const solved = db
      .prepare(
        `SELECT COUNT(DISTINCT problem_id) AS c FROM submissions
          WHERE user_id = ? AND status = 'Accepted'`,
      )
      .get(req.user.id).c
    const submitted = db
      .prepare('SELECT COUNT(*) AS c FROM submissions WHERE user_id = ?')
      .get(req.user.id).c
    // weekly solved (last 7 days)
    const weekSolved = db
      .prepare(
        `SELECT COUNT(DISTINCT problem_id) AS c FROM submissions
          WHERE user_id = ? AND status = 'Accepted'
            AND created_at >= datetime('now', '-7 days')`,
      )
      .get(req.user.id).c
    me = {
      solved,
      submitted,
      week_solved: weekSolved,
      week_goal: 20,
    }
  }

  res.json({
    totals: { problems, users, submissions, contests },
    recommended,
    next_contest: nextContest || null,
    me,
  })
})

function safeJson(v, fb) {
  try {
    return JSON.parse(v)
  } catch {
    return fb
  }
}
