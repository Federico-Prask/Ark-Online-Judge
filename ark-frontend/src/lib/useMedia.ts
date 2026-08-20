import { onMounted, onUnmounted, ref } from 'vue'

/** 响应式媒体查询：返回 matches，随页宽实时变化 */
export function useMedia(query: string) {
  const matches = ref(false)
  let mql: MediaQueryList | undefined
  const onChange = (e: MediaQueryListEvent) => {
    matches.value = e.matches
  }
  onMounted(() => {
    mql = window.matchMedia(query)
    matches.value = mql.matches
    mql.addEventListener('change', onChange)
  })
  onUnmounted(() => {
    mql?.removeEventListener('change', onChange)
  })
  return matches
}

/** <768px：图标按钮需要固定成正方形的宽度区间 */
export const useNarrow = () => useMedia('(max-width: 767px)')
