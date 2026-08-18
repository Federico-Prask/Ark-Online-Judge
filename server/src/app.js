// Express app wiring: CORS, JSON body parsing, routes, static frontend, errors.
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { authRouter } from './auth.js'
import { problemsRouter } from './problems.js'
import { submissionsRouter } from './submissions.js'
import { listsRouter } from './lists.js'
import { contestsRouter } from './contests.js'
import { usersRouter } from './users.js'
import { discussionsRouter } from './discussions.js'
import { statsRouter } from './stats.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  // Allow common local + preview origins. ARKOJ_ORIGIN can pin a single origin.
  const pinned = process.env.ARKOJ_ORIGIN
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true) // curl / same-origin
        if (pinned) return cb(null, origin === pinned)
        if (
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          /\.e2b\.app$/.test(origin)
        ) {
          return cb(null, true)
        }
        return cb(null, false)
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  // --- API ---
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, service: 'arkoj-server', time: new Date().toISOString() })
  })
  app.use('/api/auth', authRouter)
  app.use('/api/problems', problemsRouter)
  app.use('/api/submissions', submissionsRouter)
  app.use('/api/lists', listsRouter)
  app.use('/api/contests', contestsRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/discussions', discussionsRouter)
  app.use('/api/stats', statsRouter)

  // --- Static frontend (production build, if present) ---
  const dist = path.join(__dirname, '..', '..', 'dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist))
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  // --- 404 for unknown API routes ---
  app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }))

  // --- Error handler ---
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[arkoj] error:', err)
    res.status(err.status || 500).json({ error: err.expose ? err.message : '服务器内部错误' })
  })

  return app
}
