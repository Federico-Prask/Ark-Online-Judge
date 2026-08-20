import fs from 'node:fs'
import path from 'node:path'
import AdmZip from 'adm-zip'

// 存储规范：
//   data/[pid]/description.json            题面（背景/描述/格式/说明/样例）
//   data/[pid]/tests/                      NN.in + NN.ans|.out，可选 checker.cpp / testlib.h / interactor.cpp
//   data/[pid]/additionals/                附件
//   submissions/[id]/Main.<ext> + result.json

export const DATA_DIR = path.resolve(import.meta.dirname, '../data')
export const SUBS_DIR = path.resolve(import.meta.dirname, '../submissions')

export const problemDir = (pid: string) => path.join(DATA_DIR, pid)
export const testsDir = (pid: string) => path.join(problemDir(pid), 'tests')
export const additionalsDir = (pid: string) => path.join(problemDir(pid), 'additionals')
export const descPath = (pid: string) => path.join(problemDir(pid), 'description.json')

export interface DescriptionJSON {
  background?: string
  description: string
  input?: string
  output?: string
  notes?: string
  samples: { in: string; out: string }[]
}

/** 题目元数据（db.json 不再存题目） */
export interface ProblemMeta {
  id: string
  title: string
  base: number
  tags: string[]
  tl: number
  ac: number
  submitted: number
  visibility?: 'hidden' | 'public' | 'contest'
  interactive?: boolean
}

export const metaPath = (pid: string) => path.join(problemDir(pid), 'problem.json')

export function readMeta(pid: string): ProblemMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath(pid), 'utf-8')) as ProblemMeta
  } catch {
    return null
  }
}

export function writeMeta(pid: string, m: ProblemMeta) {
  ensureProblemDirs(pid)
  fs.writeFileSync(metaPath(pid), JSON.stringify(m, null, 2))
}

export function listProblemIds(): string[] {
  try {
    return fs
      .readdirSync(DATA_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(DATA_DIR, d.name, 'problem.json')))
      .map((d) => d.name)
      .sort()
  } catch {
    return []
  }
}

/** 测试点识别结果：subtask 分组（两种命名：N.in 与 S_N.in） */
export interface TestsMeta {
  subtasks: { idx: number; points: { n: number; f: string; in: string; out: string }[] }[]
}
export const testsMetaPath = (pid: string) => path.join(problemDir(pid), 'tests.json')

export function readTestsMeta(pid: string): TestsMeta | null {
  try {
    return JSON.parse(fs.readFileSync(testsMetaPath(pid), 'utf-8')) as TestsMeta
  } catch {
    return null
  }
}

/** 扫描 tests/ 并按命名识别分组，落盘 tests.json */
export function recognizeTests(pid: string): TestsMeta {
  const files = listTestFiles(pid)
  const groups = new Map<number, { n: number; f: string }[]>()
  for (const f of files) {
    let sub = 0
    let n = 0
    const mB = f.match(/^(.*?)(\d+)_(\d+)\.in$/)
    const mA = f.match(/^(\d+)\.in$/)
    if (mB && mB[1] !== '') {
      sub = Number(mB[2])
      n = Number(mB[3])
    } else if (mA) {
      sub = 1
      n = Number(mA[1])
    } else if (mB) {
      sub = Number(mB[2])
      n = Number(mB[3])
    } else continue
    const base = f.slice(0, -3)
    if (![`${base}.ans`, `${base}.out`].some((c) => files.includes(c))) continue
    const arr = groups.get(sub) ?? []
    arr.push({ n, f: base })
    groups.set(sub, arr)
  }
  const subtasks = [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, pts]) => ({
      idx,
      points: pts.sort((a, b) => a.n - b.n).map((p) => ({
        n: p.n,
        f: p.f,
        in: fs.readFileSync(path.join(testsDir(pid), `${p.f}.in`), 'utf-8'),
        out: fs.readFileSync(path.join(testsDir(pid), files.includes(`${p.f}.ans`) ? `${p.f}.ans` : `${p.f}.out`), 'utf-8'),
      })),
    }))
  const meta: TestsMeta = { subtasks }
  ensureProblemDirs(pid)
  fs.writeFileSync(testsMetaPath(pid), JSON.stringify(meta, null, 2))
  return meta
}

const mkdir = (p: string) => fs.mkdirSync(p, { recursive: true })

export function ensureProblemDirs(pid: string) {
  mkdir(testsDir(pid))
  mkdir(additionalsDir(pid))
}

export function readDesc(pid: string): DescriptionJSON | null {
  try {
    return JSON.parse(fs.readFileSync(descPath(pid), 'utf-8')) as DescriptionJSON
  } catch {
    return null
  }
}

export function writeDesc(pid: string, d: DescriptionJSON) {
  ensureProblemDirs(pid)
  fs.writeFileSync(descPath(pid), JSON.stringify(d, null, 2))
}

export function listTestFiles(pid: string): string[] {
  try {
    return fs.readdirSync(testsDir(pid)).sort()
  } catch {
    return []
  }
}

/** 读取测试点对：NN.in 配 NN.ans 或 NN.out */
export function readPairs(pid: string): { in: string; out: string }[] {
  return readPairEntries(pid).map((e) => ({
    in: fs.readFileSync(e.inPath, 'utf-8'),
    out: fs.readFileSync(e.outPath, 'utf-8'),
  }))
}

/** 测试点文件路径对（checker 需要路径） */
export function readPairEntries(pid: string): { n: number; inPath: string; outPath: string }[] {
  const files = listTestFiles(pid)
  const ins = files
    .filter((f) => /^\d+\.in$/.test(f))
    .sort((a, b) => Number(a.match(/^\d+/)![0]) - Number(b.match(/^\d+/)![0]))
  const entries: { n: number; inPath: string; outPath: string }[] = []
  for (const f of ins) {
    const n = Number(f.match(/^\d+/)![0])
    const ans = [`${n}.ans`, `${n}.out`].find((c) => files.includes(c))
    if (!ans) continue
    entries.push({ n, inPath: path.join(testsDir(pid), f), outPath: path.join(testsDir(pid), ans) })
  }
  return entries
}

export const hasChecker = (pid: string) => listTestFiles(pid).includes('checker.cpp')
export const hasInteractor = (pid: string) => listTestFiles(pid).includes('interactor.cpp')

export function readInteractor(pid: string): string | null {
  try {
    return fs.readFileSync(path.join(testsDir(pid), 'interactor.cpp'), 'utf-8')
  } catch {
    return null
  }
}

export function writeInteractor(pid: string, src: string) {
  ensureProblemDirs(pid)
  fs.writeFileSync(path.join(testsDir(pid), 'interactor.cpp'), src)
}

/** 内联测试点落盘：1.in/1.ans … */
export function writeTestsInline(pid: string, tests: { in: string; out: string }[]) {
  ensureProblemDirs(pid)
  tests.forEach((t, i) => {
    fs.writeFileSync(path.join(testsDir(pid), `${i + 1}.in`), t.in)
    fs.writeFileSync(path.join(testsDir(pid), `${i + 1}.ans`), t.out)
  })
}

/** 上传压缩包解压：.in/.out/.ans/.cpp/.h → tests/，其余 → additionals/ */
export function extractZip(pid: string, buf: Buffer): { added: string[] } {
  ensureProblemDirs(pid)
  const zip = new AdmZip(buf)
  const added: string[] = []
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue
    const name = path.basename(e.entryName)
    if (!/^[\w.-]+$/.test(name)) continue
    const testish = /^\d+\.(in|out|ans)$/.test(name) || ['checker.cpp', 'testlib.h', 'interactor.cpp'].includes(name)
    const dest = testish ? testsDir(pid) : additionalsDir(pid)
    fs.writeFileSync(path.join(dest, name), e.getData())
    added.push(name)
  }
  return { added }
}

// ---------------- submissions 拆分存储 ----------------

export const subDir = (id: number) => path.join(SUBS_DIR, String(id))

export const extOf = (family: 'cpp' | 'c' | 'py') => (family === 'py' ? 'py' : family === 'c' ? 'c' : 'cpp')

export function writeSubSource(id: number, family: 'cpp' | 'c' | 'py', code: string) {
  mkdir(subDir(id))
  fs.writeFileSync(path.join(subDir(id), `Main.${extOf(family)}`), code)
}

export function readSubSource(id: number): { code: string; family: 'cpp' | 'c' | 'py' } | null {
  for (const family of ['cpp', 'c', 'py'] as const) {
    const p = path.join(subDir(id), `Main.${extOf(family)}`)
    try {
      return { code: fs.readFileSync(p, 'utf-8'), family }
    } catch {
      /* next */
    }
  }
  return null
}

export function writeResult(id: number, result: unknown) {
  mkdir(subDir(id))
  fs.writeFileSync(path.join(subDir(id), 'result.json'), JSON.stringify(result, null, 2))
}

export function readResult<T>(id: number): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(subDir(id), 'result.json'), 'utf-8')) as T
  } catch {
    return null
  }
}
