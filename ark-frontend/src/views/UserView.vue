<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { loadProblems, problemInCache, userApi, userSubs } from '../lib/api'
import type { UserProfile } from '../lib/api'
import type { SubRow } from '../lib/api-types'
import { verdictChip } from '../lib/api-types'

const route = useRoute()
const user = ref<UserProfile | null>(null)
const subs = ref<SubRow[]>([])
const notFound = ref(false)

const ratingChipCls = (base: number) =>
  base <= 2 ? 'chip-ac' : base === 3 ? 'chip-live' : base <= 5 ? 'chip-tle' : 'chip-wa'

onMounted(async () => {
  await loadProblems().catch(() => {})
  try {
    user.value = await userApi(String(route.params.name))
    subs.value = (await userSubs(String(route.params.name))).slice(0, 8)
  } catch {
    notFound.value = true
  }
})
</script>

<template>
  <div v-if="notFound" class="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-ink-faint">
    // 404 — USER NOT FOUND
  </div>

  <template v-else-if="user">
    <!-- 头部 -->
    <section class="pb-10 pt-14">
      <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
        <span class="font-bold text-accent-deep">[ 用户 ]</span>
        <span>USER.PROFILE · UID {{ user.uid }}</span>
      </div>
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 class="grad-text text-[clamp(40px,6vw,76px)] font-black leading-[1.05] tracking-[-0.015em]">
            {{ user.name }}
          </h1>
          <div class="mt-4 flex flex-wrap items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-ink-soft">
            <span class="border border-line px-2 py-0.5">UID {{ user.uid }}</span>
            <span class="border border-line px-2 py-0.5">注册于 {{ user.reg }}</span>
            <span v-if="user.school" class="border border-line px-2 py-0.5">{{ user.school }}</span>
          </div>
          <p v-if="user.bio" class="mt-4 max-w-[560px] text-[13px] leading-7 text-ink-soft">{{ user.bio }}</p>
        </div>
        <router-link v-if="true" :to="user.name === 'guest' ? '/login' : `/user/${user.name}`" class="hidden" />
      </div>
    </section>

    <!-- 数据带 -->
    <section class="mb-8 border border-ink bg-card">
      <header class="flex items-center justify-between border-b border-ink px-4 py-2">
        <span class="text-[12px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 生涯数据 <span class="font-mono font-normal text-accent-deep">]</span>
          <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">CAREER.STATS</span>
        </span>
        <span class="flex items-center gap-1.5 font-mono text-[8px] tracking-[0.14em] text-ink-faint">
          <span class="live-dot h-1 w-1 rounded-full bg-signal-green" />LIVE
        </span>
      </header>
      <div class="grid grid-cols-2 md:grid-cols-4">
        <div class="border-dashed border-line-soft px-4 pb-3 pt-2.5">
          <div class="flex items-baseline justify-between font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">
            <span><span class="mr-1 max-kilo:hidden">SOLVED</span>已解决</span><span>01</span>
          </div>
          <div class="mt-1 text-[26px] font-black leading-none">{{ user.solved.length }}</div>
          <div class="mt-2 h-[3px] w-full bg-line-soft"><div class="h-full bg-accent-deep" :style="{ width: Math.min(100, user.solved.length * 8) + '%' }" /></div>
        </div>
        <div class="border-dashed border-line-soft px-4 pb-3 pt-2.5 max-lg:border-l lg:border-l">
          <div class="flex items-baseline justify-between font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">
            <span><span class="mr-1 max-kilo:hidden">SUBMITS</span>提交</span><span>02</span>
          </div>
          <div class="mt-1 text-[26px] font-black leading-none">{{ user.submits }}</div>
          <div class="mt-2 h-[3px] w-full bg-line-soft"><div class="h-full bg-accent-deep" :style="{ width: Math.min(100, user.submits * 10) + '%' }" /></div>
        </div>
        <div class="border-dashed border-line-soft px-4 pb-3 pt-2.5 max-lg:border-t lg:border-t">
          <div class="flex items-baseline justify-between font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">
            <span><span class="mr-1 max-kilo:hidden">RATING</span>评分</span><span>03</span>
          </div>
          <div class="mt-1 text-[26px] font-black leading-none text-accent-deep">{{ user.rating }}</div>
          <div class="mt-2 h-[3px] w-full bg-line-soft"><div class="h-full bg-accent-deep" :style="{ width: Math.min(100, (user.rating - 1200) / 6) + '%' }" /></div>
        </div>
        <div class="border-dashed border-line-soft px-4 pb-3 pt-2.5 max-lg:border-l max-lg:border-t lg:border-l lg:border-t">
          <div class="flex items-baseline justify-between font-mono text-[8.5px] tracking-[0.16em] text-ink-faint">
            <span><span class="mr-1 max-kilo:hidden">STREAK</span>连续</span><span>04</span>
          </div>
          <div class="mt-1 text-[26px] font-black leading-none">{{ user.streak }}<span class="text-[12px] font-semibold"> 天</span></div>
          <div class="mt-2 h-[3px] w-full bg-line-soft"><div class="h-full bg-signal-green" :style="{ width: Math.min(100, user.streak * 12) + '%' }" /></div>
        </div>
      </div>
    </section>

    <div class="mb-16 grid gap-5 lg:grid-cols-[1fr_400px]">
      <!-- 已解决 -->
      <section class="card relative border border-line bg-card px-6 py-5">
        <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[14px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 已解决 <span class="font-mono font-normal text-accent-deep">]</span>
          <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">SOLVED · {{ user.solved.length }}</span>
        </h2>
        <div v-if="user.solved.length === 0" class="py-8 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">
          // 还没有通过的题目
        </div>
        <div v-else class="flex flex-wrap gap-2">
          <router-link
            v-for="pid in user.solved"
            :key="pid"
            :to="`/problem/${pid}`"
            class="flex items-center gap-2 border border-line bg-paper px-2.5 py-1.5 no-underline hover:border-accent-deep"
          >
            <span class="font-mono text-[10px] text-accent-deep">{{ pid }}</span>
            <span class="text-[11px] font-semibold text-ink">{{ problemInCache(pid)?.title ?? '' }}</span>
            <span v-if="problemInCache(pid)" class="chip" :class="ratingChipCls(problemInCache(pid)!.base)">
              {{ problemInCache(pid)!.rating.toFixed(1) }}
            </span>
          </router-link>
        </div>
      </section>

      <!-- 最近提交 -->
      <section class="card relative border border-line bg-card px-4 pb-3 pt-3.5">
        <header class="mb-2 flex items-center justify-between border-b border-line-soft pb-2">
          <span class="text-[12px] font-extrabold">
            <span class="font-mono font-normal text-accent-deep">[</span> 最近提交 <span class="font-mono font-normal text-accent-deep">]</span>
          </span>
          <router-link to="/submissions" class="mono-link">全部 →</router-link>
        </header>
        <div v-if="subs.length === 0" class="py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// NO SUBMISSION</div>
        <router-link
          v-for="s in subs"
          :key="s.id"
          :to="`/submission/${s.id}`"
          class="flex items-center justify-between border-b border-dashed border-line-soft py-2 font-mono text-[10.5px] no-underline last:border-b-0 hover:bg-accent/10"
        >
          <span class="text-ink-faint">#{{ s.id }}</span>
          <span class="text-accent-deep">{{ s.pid }}</span>
          <span class="chip" :class="verdictChip[s.verdict].cls">{{ verdictChip[s.verdict].zh }}</span>
          <span class="text-ink-faint">{{ s.time }}</span>
        </router-link>
      </section>
    </div>
  </template>
</template>
