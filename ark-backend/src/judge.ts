import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Detail, SubtaskResult, Verdict } from './store.js'
import { compileArgs, optOf, specOf, type Opt } from './catalog.js'
import { hasChecker, hasInteractor, readInteractor, readTestsMeta, recognizeTests, testsDir } from './problemsfs.js'

// 说明：MVP 评测机与 OJ 服务同环境串行执行；
// 生产环境应替换为独立 rootfs + cgroup 隔离（参考 LibreOJ apps/judge）。
// 数据点来自 data/[pid]/tests/；checker.cpp（可带 testlib.h）存在时替代精确比对；
// interactor.cpp 存在时为交互题。

export interface JudgeOutcome {
  verdict: Verdict
  detail: Detail
}

function normalize(s: string): string {
  const lines = s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd())
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines.join('\n')
}

function compile(lang: string, opt: Opt, code: string, dir: string): string | null {
  const spec = specOf(lang)
  if (!spec) return `unsupported language: ${lang}`
  if (spec.family === 'py') {
    fs.writeFileSync(path.join(dir, 'main.py'), code)
    return null
  }
  const src = spec.family === 'c' ? 'Main.c' : 'Main.cpp'
  fs.writeFileSync(path.join(dir, src), code)
  try {
    execFileSync(spec.compiler, [...compileArgs(spec, opt), '-o', path.join(dir, 'main'), path.join(dir, src)], {
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return null
  } catch (e: unknown) {
    return String((e as { stderr?: Buffer | string }).stderr ?? 'compile error').slice(0, 4000)
  }
}

function compileNative(srcPath: string, outPath: string, includeDir: string): string | null {
  try {
    execFileSync('g++', ['-O2', '-std=c++17', '-DONLINE_JUDGE', `-I${includeDir}`, '-o', outPath, srcPath], {
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return null
  } catch (e: unknown) {
    return String((e as { stderr?: Buffer | string }).stderr ?? 'native compile error').slice(0, 2000)
  }
}

interface RunResult {
  tle: boolean
  ms: number
  output: string
  crashed: boolean
}

function spawnChild(cmd: string, args: string[], dir: string) {
  return spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd: dir })
}

function runPoint(lang: string, dir: string, input: string, tl: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const spec = specOf(lang)!
    const cmd = spec.family === 'py' ? 'python3' : path.join(dir, 'main')
    const args = spec.family === 'py' ? [path.join(dir, 'main.py')] : []
    const start = process.hrtime.bigint()
    const child = spawnChild(cmd, args, dir)
    let out = ''
    let killed = false
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', () => {})
    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGKILL')
    }, tl)
    child.on('error', () => {
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

function runChecker(checkerPath: string, inPath: string, userOutPath: string, ansPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const c = spawnChild(checkerPath, [inPath, userOutPath, ansPath], path.dirname(checkerPath))
    c.stdout.on('data', () => {})
    c.stderr.on('data', () => {})
    const timer = setTimeout(() => c.kill('SIGKILL'), 5000)
    c.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
    c.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0)
    })
  })
}

function runInteractive(lang: string, dir: string, input: string, interactorPath: string, resultFile: string, tl: number): Promise<RunResult> {
  return new Promise((resolve) => {
    const spec = specOf(lang)!
    const uCmd = spec.family === 'py' ? 'python3' : path.join(dir, 'main')
    const uArgs = spec.family === 'py' ? [path.join(dir, 'main.py')] : []
    const start = process.hrtime.bigint()
    const inter = spawnChild(interactorPath, [resultFile], path.dirname(interactorPath))
    const user = spawnChild(uCmd, uArgs, dir)
    let killed = false
    let userCrashed = false
    const timer = setTimeout(() => {
      killed = true
      inter.kill('SIGKILL')
      user.kill('SIGKILL')
    }, tl)

    inter.stdout.on('data', (d: Buffer) => {
      if (!user.stdin.writableEnded) user.stdin.write(d)
    })
    user.stdout.on('data', (d: Buffer) => {
      if (!inter.stdin.writableEnded) inter.stdin.write(d)
    })
    inter.stdin.on('error', () => {})
    user.stdin.on('error', () => {})
    user.stderr.on('data', () => {})
    inter.stderr.on('data', () => {})
    // 测试输入注入交互器 stdin（不能 end：选手猜测还要写入同一流；补换行作分隔符）
    inter.stdin.write(input.endsWith('\n') ? input : `${input}\n`)
    user.on('error', () => (userCrashed = true))
    inter.on('error', () => (userCrashed = true))

    let closed = 0
    const done = () => {
      if (++closed < 2) return
      clearTimeout(timer)
      const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
      resolve({ tle: killed || ms > tl, ms, output: '', crashed: userCrashed })
    }
    user.on('close', (code) => {
      if (code !== 0 && !killed) userCrashed = true
      inter.kill('SIGKILL')
      done()
    })
    inter.on('close', () => {
      user.kill('SIGKILL')
      done()
    })
  })
}

export interface JudgeProblem {
  id: string
  tl: number
  interactive?: boolean
  interactor?: string
}

/** 完整判题：磁盘测试点 → 编译 → 逐点（checker / 交互 / 精确比对）→ 按识别的 subtask 分组计分 */
export async function judge(problem: JudgeProblem, lang: string, code: string, opt?: string): Promise<JudgeOutcome> {
  const o = optOf(opt)
  const pid = problem.id
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arkj-'))
  try {
    if (code.trim().length === 0) return ce('source file is empty')
    const tm = readTestsMeta(pid) ?? recognizeTests(pid)
    if (tm.subtasks.length === 0 || tm.subtasks.every((s) => s.points.length === 0)) return ce('no test data on disk')
    const err = compile(lang, o, code, dir)
    if (err) return ce(err)

    // checker / interactor 编译
    const tdir = path.join(dir, 'ptests')
    fs.mkdirSync(tdir, { recursive: true })
    let checkerPath: string | null = null
    let interactorPath: string | null = null
    const problemDirTests = path.resolve(import.meta.dirname, '../data', pid, 'tests')
    if (hasChecker(pid)) {
      checkerPath = path.join(dir, 'checker')
      const ceErr = compileNative(path.join(problemDirTests, 'checker.cpp'), checkerPath, problemDirTests)
      if (ceErr) return ce(`[checker] ${ceErr}`)
    }
    const interactive = problem.interactive || hasInteractor(pid)
    if (interactive) {
      const isrc = readInteractor(pid) ?? problem.interactor
      if (!isrc) return ce('interactive problem missing interactor')
      fs.writeFileSync(path.join(dir, 'interactor.cpp'), isrc)
      interactorPath = path.join(dir, 'interactor')
      const ieErr = compileNative(path.join(dir, 'interactor.cpp'), interactorPath, dir)
      if (ieErr) return ce(`[interactor] ${ieErr}`)
    }

    const groups = tm.subtasks.filter((s) => s.points.length > 0)
    const full = Math.floor(100 / groups.length)

    const subtasks: SubtaskResult[] = []
    let totalMs = 0
    let passed = 0
    let total = 0
    let hasTLE = false
    let hasWA = false

    const tdirOnDisk = testsDir(pid)
    for (let gi = 0; gi < groups.length; gi++) {
      const points = []
      for (let i = 0; i < groups[gi].points.length; i++) {
        total++
        const e = groups[gi].points[i]
        const inPath = path.join(tdirOnDisk, `${e.f}.in`)
        const outPath = path.join(tdirOnDisk, fs.existsSync(path.join(tdirOnDisk, `${e.f}.ans`)) ? `${e.f}.ans` : `${e.f}.out`)
        let status: 'AC' | 'WA' | 'TLE' = 'AC'
        let ms = 0
        if (interactorPath) {
          const resultFile = path.join(dir, `result-${gi}-${i}.txt`)
          const r = await runInteractive(lang, dir, e.in, interactorPath, resultFile, problem.tl)
          ms = r.ms
          let ok = false
          try {
            ok = fs.readFileSync(resultFile, 'utf-8').trim() === '1'
          } catch {
            ok = false
          }
          if (r.tle) (status = 'TLE'), (hasTLE = true)
          else if (!ok || r.crashed) (status = 'WA'), (hasWA = true)
        } else {
          const r = await runPoint(lang, dir, e.in, problem.tl)
          ms = r.ms
          if (r.tle) {
            status = 'TLE'
            hasTLE = true
          } else if (r.crashed) {
            status = 'WA'
            hasWA = true
          } else if (checkerPath) {
            const userOut = path.join(dir, `userout-${gi}-${i}.txt`)
            fs.writeFileSync(userOut, r.output)
            const ok = await runChecker(checkerPath, inPath, userOut, outPath)
            if (!ok) (status = 'WA'), (hasWA = true)
          } else if (normalize(r.output) !== normalize(e.out)) {
            status = 'WA'
            hasWA = true
          }
        }
        if (status === 'AC') passed++
        totalMs += ms
        points.push({ idx: e.n, status, ms: Math.min(ms, problem.tl + 1) })
      }
      const ok = points.every((p) => p.status === 'AC')
      subtasks.push({ idx: groups[gi].idx, score: ok ? full : 0, full, points })
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
