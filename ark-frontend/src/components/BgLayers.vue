<script setup lang="ts">
// 全局背景层：细网格（fixed）+ 山峦波浪（absolute，随页面滚动周期重复）+ 屏幕四角 HUD
</script>

<template>
  <div class="bg-grid" />
  <div class="bg-waves" />

  <!-- 屏幕四角 -->
  <span class="hud-corner left-1.5 top-1.5" />
  <span class="hud-corner right-1.5 top-1.5 scale-x-[-1]" />
  <span class="hud-corner bottom-1.5 left-1.5 scale-y-[-1]" />
  <span class="hud-corner bottom-1.5 right-1.5 scale-[-1]" />

  <div class="fixed left-3.5 top-2.5 z-30 font-mono text-[9px] tracking-[0.16em] text-ink-faint pointer-events-none">
    ARK.SYS // TERMINAL-01
  </div>
  <div class="fixed right-3.5 top-2.5 z-30 font-mono text-[9px] tracking-[0.16em] text-ink-faint pointer-events-none">
    BUILD 2026.08.19
  </div>
</template>
