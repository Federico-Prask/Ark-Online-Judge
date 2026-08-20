export interface Sample {
  input: string
  output: string
}

/** 题目展示模型（后端 /api/problems 下发，tests 永不下发） */
export interface Problem {
  id: string
  title: string
  base: number
  tags: string[]
  ac: number
  submitted: number
  statement: string[]
  input: string
  output: string
  samples: Sample[]
}
