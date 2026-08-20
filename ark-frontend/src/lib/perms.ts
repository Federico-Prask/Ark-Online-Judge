// 权限模型：普通用户默认（可移除） + 可授予的管理权限
export const DEFAULT_PERMS = ['enter', 'discuss'] as const
export const ADMIN_PERMS = ['admin_admin', 'contest', 'user_perms', 'problem'] as const
export const ALL_PERMS = [...DEFAULT_PERMS, ...ADMIN_PERMS] as const

export type PermKey = (typeof ALL_PERMS)[number]

export const PERM_META: Record<PermKey, { zh: string; group: 'default' | 'admin' }> = {
  enter: { zh: '进入 OJ', group: 'default' },
  discuss: { zh: '发表讨论', group: 'default' },
  admin_admin: { zh: '管理用户管理员权限', group: 'admin' },
  contest: { zh: '管理比赛', group: 'admin' },
  user_perms: { zh: '管理用户权限', group: 'admin' },
  problem: { zh: '管理题目', group: 'admin' },
}
