// 讨论区四分区（顺序即页面顺序）与主题色
export const CATS = [
  { key: 'announce', zh: '公告', color: '#C75C5C' },
  { key: 'help', zh: '求助', color: '#CCAE56' },
  { key: 'solution', zh: '题解', color: '#51D094' },
  { key: 'water', zh: '灌水', color: '#518BCF' },
] as const

export type CatKey = (typeof CATS)[number]['key']

export const catOf = (key: string) => CATS.find((c) => c.key === key) ?? CATS[3]
