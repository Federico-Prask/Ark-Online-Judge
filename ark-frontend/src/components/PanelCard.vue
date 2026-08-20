<script setup lang="ts">
defineProps<{ title: string; en: string; idx: string; icon?: string }>()
</script>

<template>
  <section class="card relative flex min-h-[220px] flex-col border border-line bg-card px-5 pb-3.5 pt-4">
    <header class="mb-3 flex items-baseline justify-between border-b border-line-soft pb-2.5">
      <div class="flex items-baseline gap-2">
        <span class="text-[14px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span>
          {{ title }}
          <span class="font-mono font-normal text-accent-deep">]</span>
        </span>
        <i v-if="icon" :class="icon" class="text-[10px] text-accent-deep" />
        <span class="font-mono text-[8px] tracking-[0.22em] text-ink-faint">{{ en }}</span>
      </div>
      <span class="font-mono text-[9px] tracking-[0.2em] text-ink-faint">{{ idx }}</span>
    </header>

    <slot />

    <footer class="mt-auto flex justify-between pt-3 font-mono text-[9px] tracking-[0.14em] text-ink-faint">
      <slot name="foot" />
    </footer>
  </section>
</template>
