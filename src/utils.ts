/** Shared UI helpers */

export function difficultyClass(tag: string) {
  if (tag === '入门') return 'easy'
  if (tag === '困难') return 'hard'
  return 'medium'
}

export function statusClass(status: string) {
  const s = (status || '').toLowerCase()
  if (s === 'accepted') return 'st-ac'
  if (s === 'wrong answer') return 'st-wa'
  if (s === 'time limit exceeded') return 'st-tle'
  if (s === 'runtime error') return 'st-re'
  if (s === 'compile error') return 'st-ce'
  if (s === 'pending' || s === 'judging') return 'st-pending'
  return 'st-other'
}

export function makeAvatar(user?: { avatar?: string; nickname?: string; username?: string } | null) {
  if (user?.avatar) return user.avatar
  const ch = (user?.nickname || user?.username || '?').charAt(0).toUpperCase()
  const safe = ch
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">` +
    `<rect width="160" height="160" fill="#151a1e"/>` +
    `<rect x="5" y="5" width="150" height="150" fill="none" stroke="#354049" stroke-width="2"/>` +
    `<text x="80" y="112" font-family="monospace" font-size="76" font-weight="800" fill="#9dc1f1" text-anchor="middle">${safe}</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function formatTime(s?: string | null) {
  if (!s) return '—'
  // stored as "YYYY-MM-DD HH:mm:ss" UTC-ish
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function formatDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('zh-CN')
}

export function countdown(target: string) {
  const t = new Date(target.includes('T') ? target : target.replace(' ', 'T') + 'Z').getTime()
  const diff = t - Date.now()
  if (!Number.isFinite(t)) return '—'
  if (diff <= 0) return '00:00:00'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (h >= 48) return `${Math.floor(h / 24)}天 ${pad(h % 24)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export function contestStatusLabel(status: string) {
  if (status === 'running') return '进行中'
  if (status === 'upcoming') return '未开始'
  if (status === 'ended') return '已结束'
  return status
}

export function relativeTime(s?: string | null) {
  if (!s) return ''
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z').getTime()
  const diff = Date.now() - d
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`
  return formatDate(s)
}

/** Very light markdown-ish renderer for problem statements (no deps). */
export function renderText(src: string) {
  if (!src) return ''
  let s = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // $math$ → italic mono (display-only)
  s = s.replace(/\$([^$]+)\$/g, '<span class="math">$1</span>')
  // bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // paragraphs
  s = s
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
  return s
}
