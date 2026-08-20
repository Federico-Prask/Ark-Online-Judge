<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageHero from '../components/PageHero.vue'
import { loadSubs } from '../lib/api'
import type { SubRow } from '../lib/api-types'
import { verdictChip } from '../lib/api-types'

const rows = ref<SubRow[]>([])
const filters = ['全部', '我的', '通过'] as const
const filter = ref<(typeof filters)[number]>('全部')
let timer: number | undefined

const refresh = async () => {
  rows.value = await loadSubs().catch(() => [] as SubRow[])
}

onMounted(async () => {
  await refresh()
  timer = window.setInterval(async () => {
    // 有在判的提交才轮询，省流量
    if (rows.value.some((s) => s.verdict === 'JUDGING')) await refresh()
  }, 1500)
})
onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})

const list = computed(() =>
  rows.value.filter((s) => {
    if (filter.value === '我的') return s.mine
    if (filter.value === '通过') return s.verdict === 'AC'
    return true
  }),
)
</script>

<template>
  <PageHero kicker="提交" l1="Submission" l2="提交记录" />

  <div class="mb-6 flex items-center gap-3">
    <button
      v-for="f in filters"
      :key="f"
      class="cursor-pointer border px-3 py-1.5 font-mono text-[10px] tracking-[0.1em]"
      :class="filter === f ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink-soft hover:border-ink hover:text-ink'"
      @click="filter = f"
    >
      {{ f }}
    </button>
    <span class="ml-auto flex items-center gap-2 font-mono text-[9px] tracking-[0.16em] text-ink-faint">
      <span class="live-dot h-1.5 w-1.5 rounded-full bg-signal-green" />
      LIVE FEED · {{ list.length }}
    </span>
  </div>

  <section class="card relative mb-16 border border-line bg-card">
    <header class="hidden grid-cols-[90px_80px_1fr_100px_110px_60px] gap-3 border-b border-line-soft px-5 py-2.5 font-mono text-[9px] tracking-[0.18em] text-ink-faint md:grid">
      <span>RUN ID</span><span>PROBLEM</span><span>USER</span><span>LANG</span><span>VERDICT</span><span class="text-right">TIME</span>
    </header>
    <div v-if="rows.length === 0" class="px-5 py-10 text-center font-mono text-[10px] tracking-[0.24em] text-ink-faint">
      // EMPTY — 去题库提交第一份代码
    </div>
    <router-link
      v-for="s in list"
      :key="s.id"
      :to="`/submission/${s.id}`"
      class="grid grid-cols-[80px_1fr_auto] items-center gap-3 border-b border-dashed border-line-soft px-5 py-3 no-underline last:border-b-0 hover:bg-accent/10 md:grid-cols-[90px_80px_1fr_100px_110px_60px]"
    >
      <span class="font-mono text-[10.5px] text-ink-faint">#{{ s.id }}</span>
      <span class="font-mono text-[11px] text-accent-deep">{{ s.pid }}</span>
      <span class="truncate text-[12.5px] font-semibold text-ink">
        {{ s.user }}<span v-if="s.mine" class="ml-1.5 font-mono text-[8px] tracking-[0.14em] text-accent-deep">（你）</span>
      </span>
      <span class="hidden font-mono text-[10.5px] text-ink-soft md:block">{{ s.lang }}</span>
      <span>
        <span class="chip" :class="verdictChip[s.verdict].cls">
          <i v-if="s.verdict === 'JUDGING'" class="fa-solid fa-circle-notch fa-spin mr-1 text-[8px]" />{{ verdictChip[s.verdict].zh }}
        </span>
      </span>
      <span class="hidden text-right font-mono text-[10px] text-ink-faint md:block">{{ s.time }}</span>
    </router-link>
  </section>
</template>
