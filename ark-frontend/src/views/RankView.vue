<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchUserRank, type RankEntry } from '../lib/api'
import { me } from '../lib/session'

const rows = ref<RankEntry[]>([])
onMounted(async () => {
  rows.value = await fetchUserRank().catch(() => [])
})
</script>

<template>
  <section class="pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ 排行 ]</span>
      <span>RANKING · {{ rows.length }}</span>
    </div>
    <h1 class="mb-8 text-[clamp(28px,3.6vw,44px)] font-black tracking-[-0.015em]">
      全栈<span class="grad-text">排行</span>
    </h1>

    <section class="card relative border border-line bg-card">
      <header class="hidden grid-cols-[60px_1fr_100px_100px_100px_90px] gap-3 border-b border-line-soft px-5 py-2.5 font-mono text-[9px] tracking-[0.18em] text-ink-faint md:grid">
        <span>#</span><span>USER</span><span class="text-right">SOLVED</span><span class="text-right">SUBMITS</span><span class="text-right">STREAK</span><span class="text-right">RATING</span>
      </header>
      <div v-if="rows.length === 0" class="px-5 py-10 text-center font-mono text-[10px] tracking-[0.2em] text-ink-faint">
        // 暂无数据 —— 去提交第一份代码
      </div>
      <div
        v-for="(r, i) in rows"
        :key="r.name"
        class="grid grid-cols-[60px_1fr_100px] items-center gap-3 border-b border-dashed border-line-soft px-5 py-3 last:border-b-0 md:grid-cols-[60px_1fr_100px_100px_100px_90px]"
        :class="r.name === me?.name && 'bg-accent/15'"
      >
        <span class="font-mono text-[11px] text-ink-faint">{{ String(i + 1).padStart(2, '0') }}</span>
        <router-link :to="`/user/${r.name}`" class="text-[13px] font-bold text-ink no-underline hover:text-accent-deep">
          {{ r.name }}
        </router-link>
        <span class="text-right font-mono text-[12px] font-bold text-signal-green">{{ r.solved.length }}</span>
        <span class="hidden text-right font-mono text-[11px] text-ink-soft md:block">{{ r.submits }}</span>
        <span class="hidden text-right font-mono text-[11px] text-ink-soft md:block">{{ r.streak }} 天</span>
        <span class="hidden text-right font-mono text-[12px] font-bold text-accent-deep md:block">{{ r.rating }}</span>
      </div>
    </section>
  </section>
</template>
