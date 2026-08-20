import { onMounted, onUnmounted, ref } from 'vue'

export function useClock() {
  const time = ref('--:--:--')
  const date = ref('')
  let timer: number | undefined

  const tick = () => {
    const now = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    time.value = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    date.value = `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())} · ${days[now.getDay()]}`
  }

  onMounted(() => {
    tick()
    timer = window.setInterval(tick, 1000)
  })
  onUnmounted(() => {
    if (timer) window.clearInterval(timer)
  })

  return { time, date }
}
