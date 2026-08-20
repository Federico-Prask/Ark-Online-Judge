<script setup lang="ts">
import { onMounted } from 'vue'
import type { Verdict } from '../lib/api-types'

const props = defineProps<{
  verdict: Exclude<Verdict, 'JUDGING'>
  meta: string
}>()
const emit = defineEmits<{ (e: 'done'): void }>()

const TEXT: Record<string, string> = {
  AC: 'ACCEPTED',
  WA: 'WRONG ANSWER',
  TLE: 'TIME LIMIT EXCEEDED',
  CE: 'COMPILE ERROR',
}
const COLOR: Record<string, string> = {
  AC: 'var(--color-signal-green)',
  WA: 'var(--color-signal-red)',
  TLE: 'var(--color-signal-amber)',
  CE: 'var(--color-ink-soft)',
}
const text = TEXT[props.verdict]
const color = COLOR[props.verdict]
const long = text.length > 10
// 逐字节奏：长文案自动收紧 stagger，保证驻留期内播完
const stagger = Math.min(0.07, 1.1 / text.length)

onMounted(() => {
  // 兜底：reduced-motion 下 band 无动画，用定时器关闭
  window.setTimeout(() => emit('done'), 3200)
})
</script>

<template>
  <!-- 优化点：CSS 动画替代 SMIL；band 进场-驻留-滑出三段式；
       主题自适应；判定文案/颜色随 verdict；可点击跳过；reduced-motion 降级 -->
  <div class="judge-overlay" @click="emit('done')">
    <!-- band 自己的滑出动画结束才移除遮罩，绝不提前消失 -->
    <div class="judge-band" :class="{ 'is-long': long }" @animationend.self="emit('done')">
      <span class="band-line top" /><span class="band-line bottom" />
      <span class="band-hazard" />

      <span class="ghost" :style="{ color: 'var(--color-ink)' }">{{ text }}</span>
      <span class="colored" :style="{ color }" aria-hidden="true">
        <span
          v-for="(c, i) in text.split('')"
          :key="i"
          class="ch"
          :style="{ animationDelay: `${0.85 + i * stagger}s` }"
        >{{ c === ' ' ? ' ' : c }}</span>
      </span>

      <span class="band-meta">{{ meta }}</span>
    </div>
    <span class="skip-hint">// CLICK TO SKIP</span>
  </div>
</template>

<style>
.judge-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-paper) 90%, transparent);
  backdrop-filter: blur(2px);
  animation: ov-in 0.3s ease;
  cursor: pointer;
}
.judge-band {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(1000px, 90vw);
  height: 156px;
  background: var(--color-accent);
  clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 26px 100%, 0 calc(100% - 26px));
  animation: band-move 2.8s forwards;
}
.dark .judge-band { background: #223850; }
.band-line { position: absolute; left: 0; right: 0; height: 1.5px; background: var(--color-ink); }
.band-line.top { top: 10px; }
.band-line.bottom { bottom: 10px; }
.band-hazard {
  position: absolute;
  left: 26px;
  top: 10px;
  bottom: 10px;
  width: 10px;
  background: repeating-linear-gradient(-45deg, var(--color-ink) 0 6px, transparent 6px 12px);
  opacity: 0.7;
}
.ghost,
.colored {
  font-family: 'Aldrich', var(--font-sans);
  font-size: clamp(44px, 7vw, 104px);
  letter-spacing: 0.02em;
  line-height: 1;
  white-space: nowrap;
}
.is-long .ghost,
.is-long .colored { font-size: clamp(28px, 4.6vw, 68px); }
.ghost { animation: ghost-blink 0.9s ease-in-out forwards; }
.colored { position: absolute; }
.ch {
  opacity: 0;
  transform: translateY(8px);
  filter: blur(4px);
  animation: char-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.band-meta {
  position: absolute;
  right: 34px;
  bottom: 16px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--color-ink);
  opacity: 0.75;
}
.skip-hint {
  position: absolute;
  bottom: 26px;
  right: 30px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.2em;
  color: var(--color-ink-faint);
}

@keyframes ov-in { from { opacity: 0; } to { opacity: 1; } }
/* 进场 expo-out（快入缓停 + 轻微纵向舒展），退场 expo-in（加速滑出）；总时长 2.8s */
@keyframes band-move {
  0% {
    transform: translateX(-112%) scaleY(0.86);
    animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
  }
  18% { transform: translateX(0) scaleY(1); }
  78% {
    transform: translateX(0) scaleY(1);
    animation-timing-function: cubic-bezier(0.55, 0, 0.85, 0.36);
  }
  100% { transform: translateX(112%) scaleY(0.92); }
}
/* 鬼影：平滑的电气闪烁，而非硬切 */
@keyframes ghost-blink {
  0% { opacity: 1; } 14% { opacity: 0.35; } 22% { opacity: 1; }
  38% { opacity: 0.3; } 50% { opacity: 1; }
  88% { opacity: 1; } 100% { opacity: 0; }
}
/* 逐字：位移 + 模糊弹出，中段一次柔和回闪 */
@keyframes char-in {
  0% { opacity: 0; transform: translateY(8px); filter: blur(4px); }
  55% { opacity: 1; transform: translateY(0); filter: blur(0); }
  70% { opacity: 0.45; }
  100% { opacity: 1; transform: none; filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  .judge-band { animation: none; }
  .ghost { animation: none; opacity: 0; }
  .ch { animation: none; opacity: 1; }
}
</style>
