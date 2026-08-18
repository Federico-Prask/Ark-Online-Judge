// Lightweight in-process judge.
// - javascript: run user code inside node:vm against test cases
// - other languages: heuristic mock (checks sample-like structure) so the
//   UI can demonstrate the full submit → verdict loop without a sandbox.
import { createContext, Script } from 'node:vm'
import { db } from './db.js'

const STATUS = {
  PENDING: 'Pending',
  JUDGING: 'Judging',
  AC: 'Accepted',
  WA: 'Wrong Answer',
  TLE: 'Time Limit Exceeded',
  RE: 'Runtime Error',
  CE: 'Compile Error',
  SE: 'System Error',
}

function normalize(s) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/g, '')
}

function runJs(code, input, timeLimitMs) {
  // User code should read from global `input` (string) and assign `output`.
  // We also provide a tiny console shim and common helpers.
  const sandbox = {
    input: String(input ?? ''),
    output: '',
    console: {
      log: (...args) => {
        sandbox.output += args.map(String).join(' ') + '\n'
      },
    },
    // Convenience: split helpers
    readline: (() => {
      const lines = String(input ?? '').split(/\r?\n/)
      let i = 0
      return () => (i < lines.length ? lines[i++] : '')
    })(),
  }
  const ctx = createContext(sandbox)
  const wrapped =
    `"use strict";\n` +
    code +
    `\n;if (typeof main === 'function') { const r = main(input); if (r !== undefined && r !== null && !output) output = String(r); }\n` +
    `if (typeof solve === 'function') { const r = solve(input); if (r !== undefined && r !== null && !output) output = String(r); }\n`

  try {
    const script = new Script(wrapped, { filename: 'user.js' })
    script.runInContext(ctx, { timeout: Math.max(50, timeLimitMs) })
    return { ok: true, output: sandbox.output }
  } catch (e) {
    const msg = e && e.message ? e.message : String(e)
    if (/Script execution timed out/i.test(msg)) {
      return { ok: false, status: STATUS.TLE, detail: msg }
    }
    return { ok: false, status: STATUS.RE, detail: msg.slice(0, 500) }
  }
}

function mockOtherLanguage(code, tests) {
  // Extremely naive: if code is empty → CE; if very short → WA; else AC
  // with a chance of WA when it doesn't mention common IO keywords.
  const trimmed = code.trim()
  if (!trimmed) return { status: STATUS.CE, detail: '空代码', score: 0 }
  if (trimmed.length < 8) {
    return { status: STATUS.CE, detail: '代码过短，疑似未完成', score: 0 }
  }
  // Prefer AC if code looks non-trivial
  const looksOk =
    /print|cout|printf|System\.out|console\.log|scanf|cin|input|read/i.test(trimmed) ||
    trimmed.length > 40
  if (!looksOk) {
    return {
      status: STATUS.WA,
      detail: `On test 1: expected "${tests[0]?.output ?? ''}"`,
      score: 0,
      time_ms: 3 + Math.floor(Math.random() * 20),
      memory_kb: 1024 + Math.floor(Math.random() * 4096),
    }
  }
  return {
    status: STATUS.AC,
    detail: `All ${tests.length} tests passed (simulated)`,
    score: 100,
    time_ms: 5 + Math.floor(Math.random() * 40),
    memory_kb: 2048 + Math.floor(Math.random() * 8192),
  }
}

export function judgeSubmission(submissionId) {
  const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId)
  if (!sub) return

  db.prepare(`UPDATE submissions SET status = ? WHERE id = ?`).run(STATUS.JUDGING, submissionId)

  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(sub.problem_id)
  const tests = db
    .prepare('SELECT * FROM test_cases WHERE problem_id = ? ORDER BY ord ASC, id ASC')
    .all(sub.problem_id)

  if (!problem || tests.length === 0) {
    db.prepare(
      `UPDATE submissions SET status = ?, detail = ?, score = 0 WHERE id = ?`,
    ).run(STATUS.SE, '题目缺少测试数据', submissionId)
    return
  }

  let result
  if (sub.language === 'javascript' || sub.language === 'js') {
    let passed = 0
    let totalTime = 0
    let fail = null
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i]
      const started = Date.now()
      const r = runJs(sub.code, t.input, problem.time_limit || 1000)
      totalTime += Date.now() - started
      if (!r.ok) {
        fail = { status: r.status, detail: `On test ${i + 1}: ${r.detail}`, score: Math.floor((passed / tests.length) * 100) }
        break
      }
      if (normalize(r.output) !== normalize(t.output)) {
        fail = {
          status: STATUS.WA,
          detail: `On test ${i + 1}: expected "${normalize(t.output)}", got "${normalize(r.output).slice(0, 200)}"`,
          score: Math.floor((passed / tests.length) * 100),
        }
        break
      }
      passed++
    }
    result = fail
      ? { ...fail, time_ms: totalTime, memory_kb: 4096 }
      : {
          status: STATUS.AC,
          detail: `All ${tests.length} tests passed`,
          score: 100,
          time_ms: totalTime,
          memory_kb: 4096,
        }
  } else {
    result = mockOtherLanguage(sub.code, tests)
  }

  db.prepare(
    `UPDATE submissions
        SET status = ?, time_ms = ?, memory_kb = ?, score = ?, detail = ?
      WHERE id = ?`,
  ).run(
    result.status,
    result.time_ms ?? null,
    result.memory_kb ?? null,
    result.score ?? 0,
    result.detail ?? '',
    submissionId,
  )

  // Update problem counters
  db.prepare(`UPDATE problems SET submitted = submitted + 1 WHERE id = ?`).run(sub.problem_id)
  if (result.status === STATUS.AC) {
    // Only count first AC per user toward accepted
    const prevAc = db
      .prepare(
        `SELECT COUNT(*) AS c FROM submissions
          WHERE user_id = ? AND problem_id = ? AND status = 'Accepted' AND id != ?`,
      )
      .get(sub.user_id, sub.problem_id, submissionId)
    if (!prevAc || prevAc.c === 0) {
      db.prepare(`UPDATE problems SET accepted = accepted + 1 WHERE id = ?`).run(sub.problem_id)
    }
  }
}

/** Fire-and-forget judge on next tick so the HTTP response returns quickly. */
export function enqueueJudge(submissionId) {
  setImmediate(() => {
    try {
      judgeSubmission(submissionId)
    } catch (e) {
      console.error('[arkoj] judge error:', e)
      try {
        db.prepare(`UPDATE submissions SET status = ?, detail = ? WHERE id = ?`).run(
          STATUS.SE,
          String(e?.message || e).slice(0, 300),
          submissionId,
        )
      } catch {
        /* ignore */
      }
    }
  })
}

export { STATUS }
