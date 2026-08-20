<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getSub, pollSub } from '../lib/api'
import type { SubDetail } from '../lib/api-types'
import { verdictChip } from '../lib/api-types'
import JudgementOverlay from '../components/JudgementOverlay.vue'

const route = useRoute()
const subId = Number(route.params.id)
const sub = ref<SubDetail | null>(null)
const showOverlay = ref(false)
let stopPolling: (() => void) | undefined

const judging = computed(() => sub.value?.verdict === 'JUDGING')

onMounted(async () => {
  try {
    sub.value = await getSub(subId)
  } catch {
    sub.value = null
    return
  }
  if (sub.value.verdict === 'JUDGING') {
    stopPolling = pollSub(subId, (d) => {
      sub.value = d
      if (d.verdict !== 'JUDGING') showOverlay.value = true
    })
  }
})
onUnmounted(() => stopPolling?.())

const tpIcon = { AC: 'fa-solid fa-check', WA: 'fa-solid fa-xmark', TLE: 'fa-regular fa-clock' }
const tpColor = { AC: 'text-signal-green', WA: 'text-signal-red', TLE: 'text-signal-amber' }
</script>

<template>
  <div v-if="!sub" class="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-ink-faint">
    // 404 — RUN NOT FOUND
  </div>

  <template v-else>
    <JudgementOverlay
      v-if="showOverlay && !judging"
      :verdict="sub.verdict as 'AC' | 'WA' | 'TLE' | 'CE'"
      :meta="`// RUN #${sub.id} · ${sub.pid} · ${sub.lang.toUpperCase()}`"
      @done="showOverlay = false"
    />

    <section class="flex flex-wrap items-end justify-between gap-4 pb-8 pt-14">
      <div>
        <div class="mb-3 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
          <router-link to="/submissions" class="text-accent-deep no-underline hover:underline">[ 提交记录 ]</router-link>
          <span class="mx-2 text-ink-faint">/</span>#{{ sub.id }}
        </div>
        <h1 class="flex flex-wrap items-center gap-4 text-[clamp(26px,3.4vw,42px)] font-black leading-tight tracking-[-0.015em]">
          RUN #{{ sub.id }}
          <span class="chip !text-[11px]" :class="verdictChip[sub.verdict].cls">
            <i v-if="judging" class="fa-solid fa-circle-notch fa-spin mr-1 text-[9px]" />
            {{ verdictChip[sub.verdict].zh }}
          </span>
        </h1>
        <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.14em] text-ink-soft">
          <router-link :to="`/problem/${sub.pid}`" class="text-accent-deep no-underline hover:underline">{{ sub.pid }}</router-link>
          <span>{{ sub.user }}</span>
          <span>{{ sub.lang }}</span>
          <span>{{ sub.date }} {{ sub.time }}</span>
        </div>
      </div>

      <div v-if="!judging && sub.detail" class="flex border border-ink bg-card">
        <div class="border-r border-line-soft px-5 py-3">
          <div class="text-[28px] font-black leading-none" :class="sub.detail.score === 100 ? 'text-signal-green' : sub.detail.score > 0 ? 'text-accent-deep' : 'text-signal-red'">
            {{ sub.detail.score }}
          </div>
          <div class="mt-1 font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">SCORE 分数</div>
        </div>
        <div class="border-r border-line-soft px-5 py-3">
          <div class="text-[28px] font-black leading-none">{{ sub.detail.ms }}<span class="text-[12px]"> ms</span></div>
          <div class="mt-1 font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">TIME 总耗时</div>
        </div>
        <div class="px-5 py-3">
          <div class="text-[28px] font-black leading-none">{{ sub.detail.passed }}<span class="text-[14px] text-ink-faint"> / {{ sub.detail.total }}</span></div>
          <div class="mt-1 font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">POINTS 测试点</div>
        </div>
      </div>
    </section>

    <section v-if="judging" class="card relative mb-16 border border-line bg-card px-6 py-14 text-center">
      <i class="fa-solid fa-circle-notch fa-spin text-[22px] text-accent-deep" />
      <div class="mt-4 font-mono text-[10px] tracking-[0.24em] text-ink-soft">JUDGING · 评测队列中</div>
      <div class="mt-2 font-mono text-[9px] tracking-[0.16em] text-ink-faint">// 出分后自动播放判定动画</div>
    </section>

    <section v-else-if="sub.detail?.ceLog" class="card relative mb-16 border border-line bg-card">
      <header class="border-b border-line-soft px-5 py-2.5 text-[13px] font-extrabold">
        <span class="font-mono font-normal text-signal-red">[!]</span> 编译失败
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">COMPILE ERROR</span>
      </header>
      <pre class="overflow-x-auto px-5 py-4 font-mono text-[11.5px] leading-6 text-signal-red">{{ sub.detail.ceLog }}</pre>
    </section>

    <section v-else-if="sub.detail" class="mb-16 flex flex-col gap-4">
      <div
        v-for="st in sub.detail.subtasks"
        :key="st.idx"
        class="card relative border border-line bg-card px-5 pb-4 pt-3.5"
      >
        <header class="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
          <span class="text-[13px] font-extrabold">
            <span class="font-mono font-normal text-accent-deep">[</span> Subtask {{ st.idx }}
            <span class="font-mono font-normal text-accent-deep">]</span>
            <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">{{ st.points.length }} POINTS</span>
          </span>
          <span
            class="chip"
            :class="st.score === st.full ? 'chip-ac' : st.score > 0 ? 'chip-tle' : 'chip-wa'"
          >{{ st.score }} / {{ st.full }}</span>
        </header>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div
            v-for="pt in st.points"
            :key="pt.idx"
            class="flex items-center justify-between border border-line-soft bg-paper px-2.5 py-2 font-mono text-[10px]"
          >
            <span class="text-ink-faint">#{{ pt.idx }}</span>
            <span class="flex items-center gap-1.5" :class="tpColor[pt.status]">
              <i :class="tpIcon[pt.status]" class="text-[9px]" />
              {{ pt.ms }}ms
            </span>
          </div>
        </div>
      </div>
    </section>
  </template>
</template>
