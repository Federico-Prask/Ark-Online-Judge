<script setup lang="ts">
defineProps<{ kicker: string; l1: string; l2: string }>()
</script>

<template>
  <section class="pb-10 pt-16">
    <div class="mb-7 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ {{ kicker }} ]</span>
      <span>ARKOJ.MODULE</span>
    </div>
    <h1
      class="text-[clamp(30px,4vw,52px)] font-black leading-[1.06] tracking-[-0.015em]"
      style="text-shadow: 1.5px 0 rgba(224, 67, 61, 0.12), -1.5px 0 rgba(94, 143, 212, 0.16)"
    >
      {{ l1 }}
    </h1>
    <div class="relative mt-1 inline-block">
      <div class="grad-text text-[clamp(38px,5.4vw,70px)] font-black leading-[1.1] tracking-[-0.015em]">{{ l2 }}</div>
      <span
        class="absolute -bottom-3 right-[-28px] h-3.5 w-3.5 bg-accent-deep opacity-90"
        style="clip-path: polygon(100% 0, 100% 100%, 0 100%)"
      />
    </div>
  </section>
</template>
