<script setup lang="ts">
import { computed } from 'vue'
import PanelCard from './PanelCard.vue'
import { problemCache, recentSubs } from '../lib/api'
import { verdictChip } from '../lib/api-types'

const lvOf = (pid: string) => problemCache.value.find((p) => p.id === pid)?.rating.toFixed(1) ?? '…'

const resume = [
  { pid: 'P1024', name: '向渊而行', chip: 'WA ×2', cls: 'chip-wa', act: '继续' },
  { pid: 'P1031', name: '信号中继', chip: 'TLE ×1', cls: 'chip-tle', act: '继续' },
  { pid: 'P1036', name: '边界协议', chip: '未提交', cls: 'chip-idle', act: '打开' },
]

const daily = computed(() => problemCache.value.find((p) => p.id === 'P1042'))
const subs = recentSubs
</script>

<template>
  <section class="grid grid-cols-1 gap-4.5 pb-16 md:grid-cols-2 kilo:grid-cols-3">
    <PanelCard title="继续挑战" en="RESUME" idx="01" icon="fa-solid fa-rotate-right">
      <div v-for="r in resume" :key="r.pid" class="dash-row flex items-center justify-between py-2.5 text-[13px] last:border-b-0">
        <span>
          <span class="mr-2 font-mono text-[11px] text-accent-deep">{{ r.pid }}</span>
          <span class="font-semibold">{{ r.name }}</span>
          <span class="ml-2 font-mono text-[9px] text-ink-faint">Lv {{ lvOf(r.pid) }}</span>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="chip" :class="r.cls">{{ r.chip }}</span>
          <router-link :to="`/problem/${r.pid}`" class="mono-link">{{ r.act }}</router-link>
        </span>
      </div>
      <template #foot>
        <span>距 130 AC 还差 <b class="text-ink">3</b> 题</span>
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
          {{ daily.statement[0] }}……
        </div>
        <router-link :to="`/problem/${daily.id}`" class="btn-accent self-start">立即挑战 <i class="fa-solid fa-arrow-right ml-1" /></router-link>
      </template>
      <div v-else class="py-8 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">// LOADING</div>
      <template #foot>
        <span>今日 612 人完成</span>
        <span>DAILY</span>
      </template>
    </PanelCard>

    <PanelCard title="赛事日程" en="CONTESTS" idx="03" icon="fa-solid fa-flag">
      <div class="dash-row py-2.5">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          <span class="live-dot h-[7px] w-[7px] rounded-full bg-signal-red" />
          周末新手赛 #12 <span class="chip chip-live">进行中</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tracking-[0.12em] text-ink-faint">你已参加 · 排名 #37 · 已解 3/5</div>
      </div>
      <div class="py-2.5">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          双周算法挑战赛 #08 <span class="chip chip-ac">已报名</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tracking-[0.12em] text-ink-faint">
          开始于 <span class="font-bold text-accent-ink">2天12时00分</span>
        </div>
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

    <PanelCard title="公告" en="NOTICE" idx="05" icon="fa-solid fa-bullhorn">
      <div class="dash-row flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">今天</span>
        <span><span class="font-mono text-signal-red">[!]</span> 评测集群扩容完成，峰值排队降至 3s</span>
      </div>
      <div class="dash-row flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">昨天</span>
        <span>新手入门路线已发布：P1001 → P1040</span>
      </div>
      <div class="flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">08-16</span>
        <span>双周赛 #08 报名开启（OI 赛制）</span>
      </div>
      <template #foot>
        <span><a href="#" class="mono-link">全部公告 →</a></span>
        <span>/34</span>
      </template>
    </PanelCard>

    <PanelCard title="排行榜" en="RANKING" idx="06" icon="fa-solid fa-ranking-star">
      <div class="dash-row flex items-center gap-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">01</span>
        <span class="flex-1 font-bold">Endministrator</span>
        <span class="font-mono text-[11px] text-accent-deep">2912</span>
      </div>
      <div class="dash-row flex items-center gap-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">02</span>
        <span class="flex-1 font-bold">北落师门</span>
        <span class="font-mono text-[11px] text-accent-deep">2847</span>
      </div>
      <div class="dash-row flex items-center gap-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">03</span>
        <span class="flex-1 font-bold">Originium_</span>
        <span class="font-mono text-[11px] text-accent-deep">2801</span>
      </div>
      <div class="mx-[-10px] mt-0.5 flex items-center gap-2.5 border border-accent bg-accent/20 px-2.5 py-2 text-[13px]">
        <span class="w-6.5 font-mono text-[11px] text-ink-faint">1024</span>
        <span class="flex-1 font-bold">admin（你）</span>
        <span class="font-mono text-[11px] text-accent-deep">1847 ▲24</span>
      </div>
      <template #foot>
        <span><a href="#" class="mono-link">完整榜单 →</a></span>
        <span>8,431 USERS</span>
      </template>
    </PanelCard>
  </section>
</template>
