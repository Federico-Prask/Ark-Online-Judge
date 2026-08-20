<script setup lang="ts">
import { computed } from 'vue'
import PanelCard from './PanelCard.vue'
import { problemCache } from '../lib/api'

const hotProblems = computed(() =>
  ['P1001', 'P1002', 'P1007', 'P1019']
    .map((id) => problemCache.value.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ pid: p.id, name: p.title, lv: p.rating.toFixed(1), ac: `${p.ac} AC` })),
)
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
        <span><a href="#" class="mono-link">立即开始 →</a></span>
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
        <span><a href="#" class="mono-link">进入题库 →</a></span>
        <span>1,204 TOTAL</span>
      </template>
    </PanelCard>

    <PanelCard title="近期赛事" en="CONTESTS" idx="03" icon="fa-solid fa-flag">
      <div class="dash-row py-2.5">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          <span class="live-dot h-[7px] w-[7px] rounded-full bg-signal-red" />
          周末新手赛 #12 <span class="chip chip-live">进行中</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tracking-[0.12em] text-ink-faint">ACM · 5 题 · 剩余 01:23:44</div>
      </div>
      <div class="py-2.5">
        <div class="flex items-center gap-2 text-[13px] font-bold">
          双周算法挑战赛 #08 <span class="chip chip-idle">即将开始</span>
        </div>
        <div class="mt-1 font-mono text-[9px] tracking-[0.12em] text-ink-faint">
          OI · 开始于 <span class="font-bold text-accent-ink">2天12时00分</span>
        </div>
      </div>
      <template #foot>
        <span><a href="#" class="mono-link">全部比赛 →</a></span>
        <span>SEASON IV</span>
      </template>
    </PanelCard>

    <PanelCard title="平台状态" en="STATUS" idx="04" icon="fa-solid fa-server">
      <div class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">JUDGE.NODE-01</span>
        <span class="font-bold text-signal-green"><span class="mr-1.5 text-[8px]">●</span>ONLINE</span>
      </div>
      <div class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">JUDGE.NODE-02</span>
        <span class="font-bold text-signal-green"><span class="mr-1.5 text-[8px]">●</span>ONLINE</span>
      </div>
      <div class="dash-row flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">QUEUE 队列</span>
        <span class="font-bold">0</span>
      </div>
      <div class="flex justify-between py-1.5 font-mono text-[11px]">
        <span class="tracking-[0.1em] text-ink-faint">UPTIME</span>
        <span class="font-bold">99.98%</span>
      </div>
      <template #foot>
        <span>STATUS.OK</span>
        <span>3,847 TODAY</span>
      </template>
    </PanelCard>

    <PanelCard title="讨论精选" en="DISCUSS" idx="05" icon="fa-regular fa-comments">
      <div class="dash-row flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">14:02</span>
        <span>题解｜P1007 轨道测绘的三种做法</span>
      </div>
      <div class="dash-row flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">11:47</span>
        <span>求问 P1019 为什么卡常？附代码</span>
      </div>
      <div class="flex gap-2.5 py-2.5 text-[12.5px]">
        <span class="mt-0.5 flex-none font-mono text-[10px] text-ink-faint">昨天</span>
        <span>新手赛 #12 赛后总结 &amp; 补题清单</span>
      </div>
      <template #foot>
        <span><a href="#" class="mono-link">进入讨论 →</a></span>
        <span>247 REPLIES</span>
      </template>
    </PanelCard>

    <PanelCard title="关于 ARKOJ" en="ABOUT" idx="06" icon="fa-regular fa-circle-question">
      <p class="text-[13px] leading-8 text-ink-soft">
        ArkOJ 是一个<b class="text-ink">为算法竞赛人而建</b>的在线评测平台。克制的界面、快速的评测、干净的题面——把一切注意力留给题目本身。
      </p>
      <div class="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.2em] text-ink-faint">
        // FOCUS ON THE PROBLEM.<br />// NOTHING ELSE.
      </div>
      <template #foot>
        <span><a href="#" class="mono-link">了解更多 →</a></span>
        <span>EST. 2026</span>
      </template>
    </PanelCard>
  </section>
</template>
