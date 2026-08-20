<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PanelCard from './PanelCard.vue'
import { fetchSiteStats, problemCache, type SiteStats } from '../lib/api'
import { homeAnnounce, homeContests } from '../lib/feeds'

const about = computed(() => homeAnnounce.value.find((t) => t.title.includes('关于')) ?? null)

const stats = ref<SiteStats | null>(null)
onMounted(async () => {
  stats.value = await fetchSiteStats().catch(() => null)
})

const hotProblems = computed(() =>
  ['P1001', 'P1002', 'P1007', 'P1019']
    .map((id) => problemCache.value.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ pid: p.id, name: p.title, lv: p.rating.toFixed(1), ac: `${p.ac} AC` })),
)

const statusChip = (s: string) => (s === 'running' ? 'chip-live' : s === 'upcoming' ? 'chip-idle' : 'chip-ac')
const statusZh = (s: string) => (s === 'running' ? '进行中' : s === 'upcoming' ? '即将开始' : '已结束')
</script>

<template>
  <section class="grid grid-cols-1 gap-4.5 pb-16 md:grid-cols-2 kilo:grid-cols-3">
    <PanelCard title="快速开始" en="QUICK START" idx="01" icon="fa-solid fa-bolt">
      <div class="dash-row flex gap-3.5 py-2.5">
        <span class="min-w-8 font-mono text-[20px] font-bold leading-none text-accent">01</span>
        <div>
          <div class="text-[13px] font-bold">注册账号</div>
          <div class="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-ink-faint">// CREATE ACCOUNT</div>
        </div>
      </div>
      <div class="dash-row flex gap-3.5 py-2.5">
        <span class="min-w-8 font-mono text-[20px] font-bold leading-none text-accent">02</span>
        <div>
          <div class="text-[13px] font-bold">选择第一题</div>
          <div class="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-ink-faint">// PICK P1001</div>
        </div>
      </div>
      <div class="flex gap-3.5 py-2.5">
        <span class="min-w-8 font-mono text-[20px] font-bold leading-none text-accent">03</span>
        <div>
          <div class="text-[13px] font-bold">提交代码</div>
          <div class="mt-0.5 font-mono text-[9px] tracking-[0.1em] text-ink-faint">// GET VERDICT</div>
        </div>
      </div>
      <template #foot>
        <span><router-link to="/register" class="mono-link">立即开始 →</router-link></span>
        <span>30 SEC</span>
      </template>
    </PanelCard>

    <PanelCard title="热门题目" en="POPULAR" idx="02" icon="fa-solid fa-fire">
      <div v-for="p in hotProblems" :key="p.pid" class="dash-row flex items-center justify-between py-2.5 text-[13px] last:border-b-0">
        <span>
          <span class="mr-2 font-mono text-[11px] text-accent-deep">{{ p.pid }}</span>
          <span class="font-semibold">{{ p.name }}</span>
          <span class="ml-2 font-mono text-[9px] text-ink-faint">Lv {{ p.lv }}</span>
        </span>
        <span class="chip chip-ac">{{ p.ac }}</span>
      </div>
      <template #foot>
        <span><router-link to="/problems" class="mono-link">进入题库 →</router-link></span>
        <span>{{ problemCache.length }} TOTAL</span>
      </template>
    </PanelCard>

    <PanelCard title="近期赛事" en="CONTESTS" idx="03" icon="fa-solid fa-flag">
      <div v-if="homeContests.length === 0" class="py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// 暂无比赛</div>
      <div v-for="c in homeContests" :key="c.id" class="dash-row py-2.5 last:border-b-0">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          <span v-if="c.status === 'running'" class="live-dot h-[7px] w-[7px] rounded-full bg-signal-red" />
          <router-link :to="`/contest/${c.id}`" class="text-ink no-underline hover:text-accent-deep">{{ c.title }}</router-link>
          <span class="chip" :class="statusChip(c.status)">{{ statusZh(c.status) }}</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tracking-[0.12em] text-ink-faint">{{ c.mode }} · {{ c.problems.length || '?' }} 题</div>
      </div>
      <template #foot>
        <span><router-link to="/contests" class="mono-link">全部比赛 →</router-link></span>
        <span>SEASON IV</span>
      </template>
    </PanelCard>

    <PanelCard title="平台状态" en="STATUS" idx="04" icon="fa-solid fa-server">
      <div v-for="n in Math.max(1, stats?.nodes ?? 1)" :key="n" class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">JUDGE.NODE-{{ String(n).padStart(2, '0') }}</span>
        <span class="font-bold text-signal-green"><span class="mr-1.5 text-[8px]">●</span>ONLINE</span>
      </div>
      <div class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">QUEUE 队列</span>
        <span class="font-bold">0</span>
      </div>
      <div class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">USERS 用户</span>
        <span class="font-bold">{{ stats?.users ?? '·' }}</span>
      </div>
      <div class="flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">PROBLEMS 题库</span>
        <span class="font-bold">{{ stats?.problems ?? '·' }}</span>
      </div>
      <template #foot>
        <span>STATUS.OK</span>
        <span>{{ stats?.today ?? 0 }} TODAY</span>
      </template>
    </PanelCard>

    <PanelCard title="公告" en="ANNOUNCE" idx="05" icon="fa-solid fa-bullhorn">
      <div v-if="homeAnnounce.length === 0" class="py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">
        // 暂无公告
      </div>
      <router-link
        v-for="t in homeAnnounce"
        :key="t.id"
        :to="`/discuss/${t.id}`"
        class="dash-row flex gap-2.5 py-2.5 text-[12.5px] no-underline last:border-b-0 hover:text-[#C75C5C]"
      >
        <span class="mt-0.5 flex-none font-mono text-[10px]" style="color: #C75C5C">[!]</span>
        <span class="truncate text-ink-soft">{{ t.title }}</span>
      </router-link>
      <template #foot>
        <span><router-link to="/discuss" class="mono-link">进入讨论区 →</router-link></span>
        <span>{{ homeAnnounce.length }} ANNOUNCE</span>
      </template>
    </PanelCard>

    <PanelCard title="关于 ARKOJ" en="ABOUT" idx="06" icon="fa-regular fa-circle-question">
      <template v-if="about">
        <router-link :to="`/discuss/${about.id}`" class="no-underline">
          <p class="text-[13px] leading-8 text-ink-soft hover:text-ink">
            {{ about.content.split('\n')[0] }}
          </p>
          <p class="mt-2 text-[12px] leading-7 text-ink-faint">
            {{ about.content.split('\n').slice(1, 3).join(' ') }}
          </p>
        </router-link>
        <div class="mt-3">
          <router-link :to="`/discuss/${about.id}`" class="mono-link">阅读全文 →</router-link>
        </div>
      </template>
      <template v-else>
        <p class="text-[13px] leading-8 text-ink-soft">
          ArkOJ 是一个<b class="text-ink">为算法竞赛人而建</b>的在线评测平台。
        </p>
      </template>
      <template #foot>
        <span><router-link to="/discuss" class="mono-link">进入讨论区 →</router-link></span>
        <span>EST. 2026</span>
      </template>
    </PanelCard>
  </section>
</template>
