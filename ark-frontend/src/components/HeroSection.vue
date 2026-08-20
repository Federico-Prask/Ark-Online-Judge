<script setup lang="ts">
import { computed } from 'vue'
import { loggedIn, me, greetZh } from '../lib/session'
import { useClock } from '../lib/clock'
import SideStats from './SideStats.vue'

const { time, date } = useClock()
const greet = computed(() => greetZh(new Date().getHours()) + '好')

// 主标题锁排：第一行略小，第二行更大并使用渐变文字
const L1_SIZE = 'text-[clamp(36px,5vw,64px)]'
const L2_SIZE = 'text-[clamp(50px,7.2vw,94px)]'
</script>

<template>
  <section class="grid items-stretch gap-12 py-20 md:grid-cols-[1fr_auto]">
    <!-- 左：问候主体 -->
    <div>
        <div class="mb-8 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
        <span class="font-bold text-accent-deep">[ 公开测试 ]</span>
        <span>{{ loggedIn ? `USER.PROFILE · SESSION ACTIVE · UID ${me?.uid}` : 'ARKOJ SYSTEM · WELCOME PROTOCOL' }}</span>
      </div>

      <template v-if="!loggedIn">
        <h1
          :class="L1_SIZE"
          class="font-black leading-[1.06] tracking-[-0.015em]"
          style="text-shadow: 1.5px 0 rgba(224, 67, 61, 0.12), -1.5px 0 rgba(94, 143, 212, 0.16)"
        >
          欢迎来到ArkOJ
        </h1>
        <div class="relative mt-1.5 inline-block">
          <div :class="L2_SIZE" class="grad-text font-black leading-[1.1] tracking-[-0.015em]">算法竞赛人</div>
          <!-- 切角词汇 c：错位漂浮三角形，跟随渐变方向置于右下 -->
          <span
            class="absolute -bottom-3 right-[-30px] h-4 w-4 bg-accent-deep opacity-90"
            style="clip-path: polygon(100% 0, 100% 100%, 0 100%)"
          />
        </div>
        <div class="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          Welcome, competitive programmer
        </div>
        <div class="mt-9 flex gap-3.5">
          <a href="#" class="btn-dark">开始做题 <i class="fa-solid fa-arrow-right ml-1.5" /></a>
          <a href="#" class="btn-base">注册账号</a>
        </div>
      </template>

      <template v-else>
        <h1
          :class="L1_SIZE"
          class="font-black leading-[1.06] tracking-[-0.015em]"
          style="text-shadow: 1.5px 0 rgba(224, 67, 61, 0.12), -1.5px 0 rgba(94, 143, 212, 0.16)"
        >
          {{ greet }}
        </h1>
        <div class="relative mt-1.5 inline-block">
          <div :class="L2_SIZE" class="grad-text font-black leading-[1.1] tracking-[-0.015em]">{{ me?.name }}</div>
          <span
            class="absolute -bottom-3 right-[-30px] h-4 w-4 bg-accent-deep opacity-90"
            style="clip-path: polygon(100% 0, 100% 100%, 0 100%)"
          />
        </div>
        <div class="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-ink-faint">
          // UID {{ me?.uid }} · RATING {{ me?.rating }}
        </div>
        <div class="mt-9 flex gap-3.5">
          <router-link to="/problems" class="btn-dark">继续做题 <i class="fa-solid fa-arrow-right ml-1.5" /></router-link>
          <router-link :to="`/user/${me?.name}`" class="btn-base"><i class="fa-regular fa-user mr-1.5" />个人主页</router-link>
        </div>
      </template>
    </div>

    <!-- 右：仅时钟，纵向贴顶 -->
    <div class="relative flex min-w-[250px] flex-col border-l border-line pl-9 kilo:min-w-[320px] max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-5">
      <div class="font-mono text-[9px] tracking-[0.2em] text-ink-faint">LOCAL.TIME</div>
      <div class="mt-1.5 font-mono text-[26px] font-semibold tracking-[0.05em]">
        {{ time }}<span class="cursor-blink ml-0.5 inline-block h-4 w-2 bg-accent-deep align-[-1px]" />
      </div>
      <div class="mb-8 font-mono text-[10px] tracking-[0.14em] text-ink-soft">{{ date }}</div>

      <SideStats />

      <span class="absolute -bottom-px -left-[3px] h-[5px] w-[5px] bg-accent-deep" />
    </div>
  </section>
</template>
