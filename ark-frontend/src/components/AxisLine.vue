<script setup lang="ts">
// 横贯状态线：标注在上、细线在下，互不重叠
// 单线 + 主题色段 + 一段 RGB 光谱点缀（保留的小彩蛋）
</script>

<template>
  <div class="relative mb-10 h-7">
    <!-- 标注行（上） -->
    <span class="absolute left-[180px] top-0 font-mono text-[9px] tracking-[0.14em] text-ink-faint">
      <span class="mr-1.5 text-accent-deep">+</span>MODULE.GRID
    </span>
    <span class="absolute right-1 top-0 font-mono text-[9px] tracking-[0.14em] text-ink-faint">
      <span class="mr-1.5 text-accent-deep">+</span>// ARKOJ.HOME
    </span>
    <!-- 线条（下）：左段为多色错位拼接条（线条词汇） -->
    <span class="absolute inset-x-0 top-[22px] h-px bg-line" />
    <span class="absolute left-0 top-[21.5px] h-0.5 w-[92px] bg-accent-deep" />
    <span class="absolute left-[98px] top-[24px] h-0.5 w-[26px] bg-accent" />
    <span class="absolute left-[130px] top-[21.5px] h-0.5 w-[10px] bg-ink" />
    <span
      class="absolute left-[46%] top-[21.5px] h-0.5 w-[26%]"
      style="background: linear-gradient(90deg, transparent, #5e8fd4 18%, #7ce0c3 38%, #f2d14d 55%, #e0433d 70%, #b48ce8 86%, transparent)"
    />
  </div>
</template>
