import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Problem } from './problems.js'
import type { Detail, SubtaskResult, Verdict } from './store.js'

// 说明：MVP 评测机与 OJ 服务同环境串行执行；
// 生产环境应替换为独立 rootfs + cgroup 隔离（参考 LibreOJ apps/judge）。

export interface JudgeOutcome {
  verdict: Verdict
  detail: Detail
}

function normalize(s: string): string {
  const lines = s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

/** 编译；失败返回错误日志（CE） */
function compile(lang: string, code: string, dir: string): string | null {
  if (lang === 'Python 3') {
    fs.writeFileSync(path.join(dir, 'main.py'), code)
    return null
  }
  fs.writeFileSync(path.join(dir, 'Main.cpp'), code)
  try {
    execFileSync(
      'g++',
      ['-O2', '-std=c++17', '-o', path.join(dir, 'main'), path.join(dir, 'Main.cpp')],
      { timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return null
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer | string }
    return String(err.stderr ?? 'compile error').slice(0, 4000)
  }
}

interface RunResult {
  tle: boolean
  ms: number
  output: string
  crashed: boolean
}

/** 运行单个测试点：stdin 喂入、超时 SIGKILL */
function runPoint(lang: string, dir: string, input: string, tl: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const cmd = lang === 'Python 3' ? 'python3' : path.join(dir, 'main')
    const args = lang === 'Python 3' ? [path.join(dir, 'main.py')] : []
    const start = process.hrtime.bigint()
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: dir })
    let out = ''
    let killed = false
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString()
    })
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, tl)
    child.on('error', (e) => {
      clearTimeout(timer)
      resolve({ tle: false, ms: 0, output: '', crashed: true })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
      resolve({ tle: killed || ms > tl, ms, output: out, crashed: !killed && code !== 0 })
    })
    child.stdin.on('error', () => {})
    child.stdin.write(input)
    child.stdin.end()
  })
}

/** 完整判题：编译 → 逐点运行 → 分组计分（两 Subtask） */
export async function judge(problem: Problem, lang: string, code: string): Promise<JudgeOutcome> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arkj-'))
  try {
    if (code.trim().length === 0) return ce('source file is empty')
    const err = compile(lang, code, dir)
    if (err) return ce(err)

    const tests = problem.tests
    const half = Math.ceil(tests.length / 2)
    const groups = [tests.slice(0, half), tests.slice(half)].filter((g) => g.length > 0)
    const full = Math.floor(100 / groups.length)

    const subtasks: SubtaskResult[] = []
    let totalMs = 0
    let passed = 0
    let total = 0
    let hasTLE = false
    let hasWA = false

    for (let gi = 0; gi < groups.length; gi++) {
      const points = []
      for (let i = 0; i < groups[gi].length; i++) {
        total++
        const t = groups[gi][i]
        const r = await runPoint(lang, dir, t.in, problem.tl)
        totalMs += r.ms
        let status: 'AC' | 'WA' | 'TLE' = 'AC'
        if (r.tle) {
          status = 'TLE'
          hasTLE = true
        } else if (r.crashed || normalize(r.output) !== normalize(t.out)) {
          status = 'WA'
          hasWA = true
        }
        if (status === 'AC') passed++
        points.push({ idx: i + 1, status, ms: Math.min(r.ms, problem.tl + 1) })
      }
      const ok = points.every((p) => p.status === 'AC')
      subtasks.push({ idx: gi + 1, score: ok ? full : 0, full, points })
    }

    const verdict: Verdict = hasTLE ? 'TLE' : hasWA ? 'WA' : 'AC'
    return {
      verdict,
      detail: {
        score: subtasks.reduce((s, x) => s + x.score, 0),
        ms: totalMs,
        subtasks,
        passed,
        total,
      },
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function ce(log: string): JudgeOutcome {
  return { verdict: 'CE', detail: { score: 0, ms: 0, subtasks: [], passed: 0, total: 0, ceLog: log } }
}
