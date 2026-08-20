<script setup lang="ts">
import { computed } from 'vue'
import PanelCard from './PanelCard.vue'
import { mySubsAll, problemCache, recentSubs } from '../lib/api'
import type { SubRow } from '../lib/api-types'
import { verdictChip } from '../lib/api-types'
import { homeAnnounce, homeContests, homeRank } from '../lib/feeds'
import { me } from '../lib/session'

const lvOf = (pid: string) => problemCache.value.find((p) => p.id === pid)?.rating.toFixed(1) ?? '…'

// 真实推导：提交过但未 AC 的题（按最近提交排序）
const resume = computed(() => {
  const byPid = new Map<string, SubRow[]>()
  for (const s of mySubsAll.value) {
    const arr = byPid.get(s.pid) ?? []
    arr.push(s)
    byPid.set(s.pid, arr)
  }
  const rows: { pid: string; name: string; chip: string; cls: string; lv: string }[] = []
  for (const [pid, list] of byPid) {
    if (list.some((s) => s.verdict === 'AC')) continue
    const v = verdictChip[list[0].verdict]
    rows.push({
      pid,
      name: problemCache.value.find((p) => p.id === pid)?.title ?? pid,
      chip: v.zh,
      cls: v.cls,
      lv: lvOf(pid),
    })
  }
  return rows.slice(0, 3)
})

const daily = computed(() => problemCache.value.find((p) => p.id === 'P1042'))
const subs = recentSubs

const statusChip = (s: string) => (s === 'running' ? 'chip-live' : s === 'upcoming' ? 'chip-idle' : 'chip-ac')
const statusZh = (s: string) => (s === 'running' ? '进行中' : s === 'upcoming' ? '即将开始' : '已结束')
</script>

<template>
  <section class="grid grid-cols-1 gap-4.5 pb-16 md:grid-cols-2 kilo:grid-cols-3">
    <PanelCard title="继续挑战" en="RESUME" idx="01" icon="fa-solid fa-rotate-right">
      <div v-if="resume.length === 0" class="py-6 text-center">
        <div class="font-mono text-[9px] tracking-[0.2em] text-ink-faint">// 暂无未完成的挑战</div>
        <router-link to="/problems" class="mono-link mt-3 inline-block">去挑第一道题 →</router-link>
      </div>
      <div v-for="r in resume" :key="r.pid" class="dash-row flex items-center justify-between py-2.5 text-[13px] last:border-b-0">
        <span>
          <span class="mr-2 font-mono text-[11px] text-accent-deep">{{ r.pid }}</span>
          <span class="font-semibold">{{ r.name }}</span>
          <span class="ml-2 font-mono text-[9px] text-ink-faint">Lv {{ r.lv }}</span>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="chip" :class="r.cls">{{ r.chip }}</span>
          <router-link :to="`/problem/${r.pid}`" class="mono-link">继续</router-link>
        </span>
      </div>
      <template #foot>
        <span>SOLVED {{ me?.solved.length ?? 0 }}</span>
        <span>RESUME</span>
      </template>
    </PanelCard>

    <PanelCard title="每日一题" en="DAILY" idx="02" icon="fa-regular fa-star">
      <template v-if="daily">
        <div class="font-mono text-[10px] tracking-[0.16em] text-accent-deep">{{ daily.id }} // 今日</div>
        <div class="mb-2 mt-1.5 text-[22px] font-black">{{ daily.title }}</div>
        <div class="mb-4 flex flex-wrap items-center gap-1.5">
          <span class="chip chip-tle">Lv {{ daily.rating.toFixed(1) }}</span>
          <span v-for="t in daily.tags" :key="t" class="border border-line px-[7px] py-0.5 font-mono text-[9px] text-ink-soft">{{ t }}</span>
        </div>
        <div class="mb-4 text-[12px] leading-relaxed text-ink-soft">
          {{ daily.desc.description.split("\n")[0] }}……
        </div>
        <router-link :to="`/problem/${daily.id}`" class="btn-accent self-start">立即挑战 <i class="fa-solid fa-arrow-right ml-1" /></router-link>
      </template>
      <div v-else class="py-8 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// LOADING</div>
      <template #foot>
        <span>AC {{ daily?.ac ?? 0 }}</span>
        <span>DAILY</span>
      </template>
    </PanelCard>

    <PanelCard title="赛事日程" en="CONTESTS" idx="03" icon="fa-solid fa-flag">
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

    <PanelCard title="最近提交" en="SUBMISSIONS" idx="04" icon="fa-solid fa-code">
      <div v-if="subs.length === 0" class="py-8 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// NO SUBMISSION</div>
      <table v-else class="w-full border-collapse font-mono text-[11px]">
        <tr v-for="s in subs" :key="s.id" class="dash-row last:border-b-0">
          <td class="py-2 pr-1.5">#{{ s.id }}</td>
          <td class="py-2 pr-1.5">{{ s.pid }}</td>
          <td class="py-2 pr-1.5">{{ s.lang }}</td>
          <td class="py-2 pr-1.5"><span class="chip" :class="verdictChip[s.verdict].cls">{{ verdictChip[s.verdict].zh }}</span></td>
          <td class="py-2 text-right text-[10px] text-ink-faint">{{ s.time }}</td>
        </tr>
      </table>
      <template #foot>
        <span><router-link to="/submissions" class="mono-link">全部提交 →</router-link></span>
        <span>LIVE</span>
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

    <PanelCard title="排行榜" en="RANKING" idx="06" icon="fa-solid fa-ranking-star">
      <div v-if="homeRank.length === 0" class="py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// 暂无数据</div>
      <div v-for="(r, i) in homeRank" :key="r.name" class="dash-row flex items-center gap-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">{{ String(i + 1).padStart(2, '0') }}</span>
        <router-link :to="`/user/${r.name}`" class="flex-1 font-bold text-ink no-underline hover:text-accent-deep">{{ r.name }}</router-link>
        <span class="font-mono text-[11px] text-accent-deep">{{ r.rating }}</span>
      </div>
      <div v-if="me" class="mx-[-10px] mt-0.5 flex items-center gap-2.5 border border-accent bg-accent/20 px-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">··</span>
        <router-link :to="`/user/${me.name}`" class="flex-1 font-bold text-ink no-underline">{{ me.name }}（你）</router-link>
        <span class="font-mono text-[11px] text-accent-deep">{{ me.rating }}</span>
      </div>
      <template #foot>
        <span><router-link to="/rank" class="mono-link">完整榜单 →</router-link></span>
        <span>LIVE</span>
      </template>
    </PanelCard>
  </section>
</template>
