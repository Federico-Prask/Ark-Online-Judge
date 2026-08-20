<script setup lang="ts">
// 底部条码：Libre Barcode 128 字体，内容为 ArkOJ + 当天 YYMMDD
const p = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const code = `ArkOJ${String(now.getFullYear()).slice(2)}${p(now.getMonth() + 1)}${p(now.getDate())}`

const links = ['题库', '比赛', '提交', '排行', '讨论', '关于']
</script>

<template>
  <!-- <880 逐行堆叠；>=880 三栏（仅此组件使用 tab 断点） -->
  <footer
    class="flex flex-col gap-7 border-t border-line pt-6 pb-11 tab:flex-row tab:items-end tab:justify-between tab:gap-4"
  >
    <div class="font-mono text-[9px] leading-loose tracking-[0.18em] text-ink-faint">
      ARKOJ © 2026 · OPEN JUDGE SYSTEM<br />
      NODE SH-EAST-01 · BUILD v0.1.0 · FE9
    </div>
    <div
      class="font-mono text-[9px] leading-loose tracking-[0.18em] text-ink-faint tab:max-kilo:text-[8px] tab:max-kilo:tracking-[0.12em] tab:text-center"
    >
      <span v-for="l in links" :key="l" class="mx-1 inline-block whitespace-nowrap">[ {{ l }} ]</span>
      <br />
      // FOCUS ON THE PROBLEM.
    </div>
    <!-- 条码顶对齐、下部留白；编号嵌于留白右下角：右线与底线皆与条码外框齐平 -->
    <div class="relative inline-block self-start tab:self-auto">
      <div class="font-barcode text-[42px] leading-[0.9] text-ink">{{ code }}</div>
      <!-- 列布局（<880）左对齐条码左线；行布局（>=880）右对齐条码右线；底线始终合一 -->
      <div
        class="absolute bottom-0 left-0 font-mono text-[9px] tracking-[0.42em] text-ink-soft tab:left-auto tab:right-0"
      >
        {{ code.toUpperCase() }}
      </div>
    </div>
  </footer>
</template>
