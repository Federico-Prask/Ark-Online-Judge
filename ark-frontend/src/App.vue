<script setup lang="ts">
import { computed } from 'vue'
import BgLayers from './components/BgLayers.vue'
import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'
import { me } from './lib/session'

// 「进入 OJ」权限被停用的已登录用户 → 全站拦截页
const blocked = computed(() => !!me.value && !me.value.perms.includes('enter'))
</script>

<template>
  <div class="relative">
    <BgLayers />
    <div class="relative z-[2] mx-auto max-w-[1180px] px-5 md:px-9">
      <AppHeader />

      <section v-if="blocked" class="py-24 text-center">
        <div class="font-mono text-[10px] tracking-[0.24em] text-signal-red">// ACCESS.DENIED</div>
        <h1 class="mt-4 text-[clamp(30px,4vw,52px)] font-black tracking-[-0.015em]">
          你的<span class="grad-text">进入 OJ</span> 权限已停用
        </h1>
        <p class="mt-5 font-mono text-[10px] leading-relaxed tracking-[0.16em] text-ink-faint">
          当前账号不具备「进入 OJ」权限，题库 / 提交 / 记录均不可访问。<br />
          如需恢复，请联系管理员。
        </p>
      </section>

      <router-view v-else />
      <AppFooter />
    </div>
  </div>
</template>
