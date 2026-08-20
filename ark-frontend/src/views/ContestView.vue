<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchContest, fetchRank, problemInCache, loadProblems, type ContestPub, type RankRow } from '../lib/api'
import { me } from '../lib/session'

const route = useRoute()
const cid = String(route.params.id)
const contest = ref<ContestPub | null>(null)
const rank = ref<{ mode: 'ACM' | 'OI'; frozen: boolean; rows: RankRow[] } | null>(null)
const notFound = ref(false)
const now = ref(Date.now())
const fullView = ref(false)

const canManage = computed(() => !!me.value?.perms.includes('contest'))

let timer = 0
onMounted(async () => {
  void loadProblems()
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
  await refresh()
  // 进行中时每 5s 刷新排名
  const poll = window.setInterval(() => {
    if (contest.value?.status === 'running') void refresh()
  }, 5000)
  onUnmounted(() => window.clearInterval(poll))
})
onUnmounted(() => window.clearInterval(timer))

const refresh = async () => {
  try {
    contest.value = await fetchContest(cid)
    rank.value = await fetchRank(cid, fullView.value)
  } catch {
    notFound.value = true
  }
}
const toggleFull = async () => {
  fullView.value = !fullView.value
  if (contest.value) rank.value = await fetchRank(cid, fullView.value)
}

const fmt = (ts: number) => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const dur = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

const countdown = computed(() => {
  if (!contest.value) return ''
  if (contest.value.status === 'upcoming') return dur(contest.value.start - now.value)
  if (contest.value.status === 'running') return dur(contest.value.end - now.value)
  return ''
})
</script>

<template>
  <div v-if="notFound" class="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-ink-faint">
    // 404 — CONTEST NOT FOUND
  </div>

  <section v-else-if="contest" class="pb-24 pt-16">
    <!-- 头部 -->
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <router-link to="/contests" class="font-bold text-accent-deep no-underline hover:underline">[ 比赛 ]</router-link>
      <span>/ {{ contest.id }}</span>
    </div>
    <div class="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div>
        <h1 class="text-[clamp(28px,3.6vw,46px)] font-black leading-tight tracking-[-0.015em]">
          {{ contest.title }}
        </h1>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="chip" :class="contest.status === 'running' ? 'chip-live' : contest.status === 'upcoming' ? 'chip-idle' : 'chip-ac'">
            {{ contest.status === 'running' ? '进行中' : contest.status === 'upcoming' ? '即将开始' : '已结束' }}
          </span>
          <span class="chip chip-idle">{{ contest.mode }}</span>
          <span class="font-mono text-[9px] tracking-[0.14em] text-ink-faint">
            {{ fmt(contest.start) }} → {{ fmt(contest.end) }} · 封榜 {{ contest.freezeMin }}min
          </span>
        </div>
      </div>
      <div v-if="countdown" class="text-right">
        <div class="font-mono text-[9px] tracking-[0.2em] text-ink-faint">
          {{ contest.status === 'upcoming' ? 'STARTS IN' : 'REMAINS' }}
        </div>
        <div class="font-mono text-[30px] font-bold tracking-[0.06em] text-accent-deep">{{ countdown }}</div>
      </div>
    </div>

    <!-- 封榜提示 -->
    <div v-if="rank?.frozen" class="mb-5 flex items-center justify-between border border-signal-amber bg-signal-amber/8 px-4 py-2.5 font-mono text-[10px] text-signal-amber">
      <span>[!] 已封榜 —— 结束前 {{ contest.freezeMin }} 分钟的提交不计入公众排名</span>
      <button v-if="canManage" class="mono-link cursor-pointer border-none bg-transparent p-0" @click="toggleFull">
        {{ fullView ? '回到封榜视图' : '查看完整排名' }} →
      </button>
    </div>

    <!-- 赛题 -->
    <section class="card relative mb-8 border border-line bg-card px-6 py-5">
      <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[14px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span> 赛题 <span class="font-mono font-normal text-accent-deep">]</span>
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">PROBLEMS</span>
      </h2>
      <div v-if="contest.status === 'upcoming'" class="py-6 text-center font-mono text-[10px] tracking-[0.2em] text-ink-faint">
        // 开赛后揭晓赛题
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <router-link
          v-for="(pid, i) in contest.problems"
          :key="pid"
          :to="`/problem/${pid}?cid=${contest.id}`"
          class="flex items-center gap-2 border border-line bg-paper px-3 py-2 no-underline hover:border-accent-deep"
        >
          <span class="font-mono text-[10px] text-ink-faint">{{ String.fromCharCode(65 + i) }}</span>
          <span class="font-mono text-[11px] text-accent-deep">{{ pid }}</span>
          <span class="text-[12px] font-semibold text-ink">{{ problemInCache(pid)?.title ?? '' }}</span>
        </router-link>
      </div>
    </section>

    <!-- 排名 -->
    <section class="card relative border border-line bg-card">
      <header class="flex items-center justify-between border-b border-line-soft px-6 py-3">
        <span class="text-[14px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 排名 <span class="font-mono font-normal text-accent-deep">]</span>
          <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">RANK · {{ rank?.rows.length ?? 0 }}</span>
        </span>
        <span class="live-dot h-1.5 w-1.5 rounded-full bg-signal-green" />
      </header>
      <div v-if="!rank || rank.rows.length === 0" class="px-6 py-10 text-center font-mono text-[10px] tracking-[0.2em] text-ink-faint">
        // 暂无提交记录
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse font-mono text-[11px]">
          <thead>
            <tr class="border-b border-line-soft text-left text-[9px] tracking-[0.18em] text-ink-faint">
              <th class="px-4 py-2.5">#</th>
              <th class="px-4 py-2.5">USER</th>
              <th v-if="rank.mode === 'ACM'" class="px-4 py-2.5">SOLVED</th>
              <th v-if="rank.mode === 'ACM'" class="px-4 py-2.5">PENALTY</th>
              <th v-else class="px-4 py-2.5">TOTAL</th>
              <th v-for="pid in contest.problems" :key="pid" class="px-3 py-2.5 text-center">{{ pid }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rank.rows" :key="r.user" class="border-b border-dashed border-line-soft last:border-b-0" :class="r.user === me?.name && 'bg-accent/15'">
              <td class="px-4 py-2.5 text-ink-faint">{{ i + 1 }}</td>
              <td class="px-4 py-2.5 font-bold text-ink">
                <router-link :to="`/user/${r.user}`" class="no-underline hover:text-accent-deep">{{ r.user }}</router-link>
              </td>
              <template v-if="rank.mode === 'ACM'">
                <td class="px-4 py-2.5 font-bold text-signal-green">{{ r.solved }}</td>
                <td class="px-4 py-2.5 text-ink-soft">{{ r.penalty }}</td>
              </template>
              <td v-else class="px-4 py-2.5 font-bold text-accent-deep">{{ r.total }}</td>
              <td v-for="pid in contest.problems" :key="pid" class="px-3 py-2.5 text-center">
                <span v-if="!r.cells[pid]" class="text-ink-faint">·</span>
                <span v-else-if="r.cells[pid].st === 'AC'" class="font-bold text-signal-green">+{{ r.cells[pid].n }}</span>
                <span v-else-if="r.cells[pid].st === 'TRY'" class="text-signal-red">-{{ r.cells[pid].n }}</span>
                <span v-else class="text-accent-deep">{{ r.cells[pid].n }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>
