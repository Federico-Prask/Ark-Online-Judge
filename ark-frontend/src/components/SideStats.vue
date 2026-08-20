<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchSiteStats, type SiteStats } from '../lib/api'
import { loggedIn, me } from '../lib/session'

interface Row {
  idx: string
  v: string
  en: string
  zh: string
  delta?: string
  w: string
  num: string
  bar: string
}

// 游客侧：真实平台统计
const stats = ref<SiteStats | null>(null)
onMounted(async () => {
  stats.value = await fetchSiteStats().catch(() => null)
})

const rows = computed<Row[]>(() =>
  loggedIn.value && me.value
    ? [
        { idx: '01', v: String(me.value.solved.length), en: 'SOLVED', zh: '已解决', w: `${Math.min(100, me.value.solved.length * 8)}%`, num: 'text-ink', bar: 'bg-accent-deep' },
        { idx: '02', v: String(me.value.submits), en: 'SUBMITS', zh: '提交', w: `${Math.min(100, me.value.submits * 10)}%`, num: 'text-ink', bar: 'bg-accent-deep' },
        { idx: '03', v: String(me.value.rating), en: 'RATING', zh: '评分', w: `${Math.min(100, (me.value.rating - 1200) / 6)}%`, num: 'text-accent-deep', bar: 'bg-accent-deep' },
        { idx: '04', v: `${me.value.streak} 天`, en: 'STREAK', zh: '连续', w: `${Math.min(100, me.value.streak * 12)}%`, num: 'text-ink', bar: 'bg-signal-green' },
      ]
    : [
        { idx: '01', v: String(stats.value?.problems ?? '·'), en: 'PROBLEMS', zh: '题库', w: `${Math.min(100, (stats.value?.problems ?? 0) * 5)}%`, num: 'text-ink', bar: 'bg-accent-deep' },
        { idx: '02', v: String(stats.value?.users ?? '·'), en: 'USERS', zh: '用户', w: `${Math.min(100, (stats.value?.users ?? 0) * 10)}%`, num: 'text-ink', bar: 'bg-accent-deep' },
        { idx: '03', v: String(stats.value?.today ?? '·'), en: 'TODAY', zh: '提交', w: `${Math.min(100, (stats.value?.today ?? 0) * 8)}%`, num: 'text-accent-deep', bar: 'bg-accent-deep' },
        { idx: '04', v: String(stats.value?.nodes ?? '·'), en: 'NODES', zh: '在线', w: `${(stats.value?.nodes ?? 0) * 50}%`, num: 'text-signal-green', bar: 'bg-signal-green' },
      ],
)

// 恒定四宫格：奇数列左分隔、下排顶分隔（宽屏仅整体更宽）
const cellBorder = (i: number) => [
  i >= 2 ? 'border-t' : '',
  i % 2 === 1 ? 'border-l' : '',
].join(' ')
</script>

<template>
  <section class="mt-8 border border-ink bg-card">
    <header class="flex items-center justify-between border-b border-ink px-3.5 py-2">
      <span class="text-[11px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span>
        {{ loggedIn ? '我的数据' : '平台数据' }}
        <span class="font-mono font-normal text-accent-deep">]</span>
      </span>
      <span class="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.14em] text-ink-faint">
        <span class="live-dot h-1 w-1 rounded-full bg-signal-green" />
        LIVE
      </span>
    </header>

    <div class="grid grid-cols-2">
      <div
        v-for="(r, i) in rows"
        :key="r.idx"
        class="border-dashed border-line-soft px-3.5 pb-3 pt-2.5"
        :class="cellBorder(i)"
      >
        <div class="flex items-baseline justify-between">
          <span class="font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">
            <span class="mr-1 max-kilo:hidden">{{ r.en }}</span>{{ r.zh }}
          </span>
          <span class="font-mono text-[8.5px] text-ink-faint">{{ r.idx }}</span>
        </div>
        <div class="mt-1 text-[26px] font-black leading-none tracking-[-0.02em]" :class="r.num">
          {{ r.v }}<span v-if="r.delta" class="ml-1.5 text-[11px] font-bold text-accent-deep">{{ r.delta }}</span>
        </div>
        <div class="mt-2 h-[3px] w-full bg-line-soft">
          <div class="h-full" :class="r.bar" :style="{ width: r.w }" />
        </div>
      </div>
    </div>
  </section>
</template>
