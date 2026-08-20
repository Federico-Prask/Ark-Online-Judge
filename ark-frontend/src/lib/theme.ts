import { ref } from 'vue'

/** 深色模式开关：class 策略（html.dark），令牌在 CSS 里整体翻转 */
export const isDark = ref(false)

const KEY = 'arkoj-theme'

function apply() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

export function initTheme() {
  const stored = localStorage.getItem(KEY)
  const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches
  isDark.value = stored ? stored === 'dark' : prefers
  apply()
}

export function toggleTheme() {
  isDark.value = !isDark.value
  localStorage.setItem(KEY, isDark.value ? 'dark' : 'light')
  apply()
}
