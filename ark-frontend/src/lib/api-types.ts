
// ---------------- 后端 API 类型 ----------------
export type Verdict = 'AC' | 'WA' | 'TLE' | 'CE' | 'JUDGING' | 'CANCELLED'

export interface ProblemPub {
  id: string
  title: string
  base: number
  tags: string[]
  tl: number
  ac: number
  submitted: number
  rate: number // 新公式通过率 %
  rating: number // 显示评级（一位小数）
  nTests: number
  desc: {
    background?: string
    description: string
    input?: string
    output?: string
    notes?: string
    samples: { in: string; out: string }[]
  }
  visibility?: 'hidden' | 'public' | 'contest'
  interactive?: boolean
  hasChecker?: boolean
}

export interface SubRow {
  id: number
  pid: string
  user: string
  lang: string
  verdict: Verdict
  time: string
  date: string
  mine: boolean
}

export interface TestPoint {
  idx: number
  status: 'AC' | 'WA' | 'TLE'
  ms: number
}
export interface SubtaskResult {
  idx: number
  score: number
  full: number
  points: TestPoint[]
}
export interface SubDetail extends SubRow {
  code?: string
  opt?: string
  cid?: string
  detail?: {
    score: number
    ms: number
    subtasks: SubtaskResult[]
    passed: number
    total: number
    ceLog?: string
  }
}

export const verdictChip: Record<Verdict, { cls: string; zh: string }> = {
  AC: { cls: 'chip-ac', zh: '通过' },
  WA: { cls: 'chip-wa', zh: '解答错误' },
  TLE: { cls: 'chip-tle', zh: '时间超限' },
  CE: { cls: 'chip-idle', zh: '编译错误' },
  JUDGING: { cls: 'chip-live', zh: '评测中' },
  CANCELLED: { cls: 'chip-idle', zh: '已取消' },
}
