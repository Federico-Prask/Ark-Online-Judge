// 语言目录（AtCoder 式：每语言列出编译器版本 + 完整编译参数）
export interface LangSpec {
  id: string
  family: 'cpp' | 'c' | 'py'
  std?: string
  compiler: string
  version: string
  baseFlags: string[]
}

export const LANG_CATALOG: LangSpec[] = [
  { id: 'C++23', family: 'cpp', std: 'c++23', compiler: 'g++', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C++20', family: 'cpp', std: 'c++20', compiler: 'g++', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C++17', family: 'cpp', std: 'c++17', compiler: 'g++', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C++14', family: 'cpp', std: 'c++14', compiler: 'g++', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C++11', family: 'cpp', std: 'c++11', compiler: 'g++', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C11', family: 'c', std: 'c11', compiler: 'gcc', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'C99', family: 'c', std: 'c99', compiler: 'gcc', version: '14.2.0', baseFlags: ['-Wall', '-Wextra', '-g', '-pipe', '-DONLINE_JUDGE', '-DARKOJ'] },
  { id: 'Python 3', family: 'py', compiler: 'python3', version: '3.13', baseFlags: [] },
]

export const OPTS = ['O0', 'O1', 'O2', 'O3', 'Ofast'] as const
export type Opt = (typeof OPTS)[number]
export const DEFAULT_OPT: Opt = 'O2'

export const specOf = (id: string) => LANG_CATALOG.find((l) => l.id === id)

export const optOf = (o?: string): Opt => (OPTS.includes(o as Opt) ? (o as Opt) : DEFAULT_OPT)

/** 完整编译参数（展示 + 实际编译同一份） */
export const compileArgs = (spec: LangSpec, opt: Opt): string[] =>
  spec.family === 'py' ? [] : [`-${opt}`, `-std=${spec.std}`, ...spec.baseFlags]

/** AtCoder 式语言信息行 */
export const langInfo = (spec: LangSpec, opt: Opt) =>
  spec.family === 'py'
    ? `${spec.compiler} ${spec.version} · 解释执行`
    : `${spec.compiler} ${spec.version} · ${compileArgs(spec, opt).join(' ')}`
