<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHero from '../components/PageHero.vue'
import { loadProblems, problemCache } from '../lib/api'

const levels: Array<'全部' | number> = ['全部', 1, 2, 3, 4, 5, 6, 7, 8]
const level = ref<'全部' | number>('全部')
const q = ref('')
const loading = ref(true)

onMounted(async () => {
  await loadProblems().catch(() => {})
  loading.value = false
})

const list = computed(() =>
  problemCache.value.filter(
    (p) =>
      (level.value === '全部' || p.base === level.value) &&
      (q.value === '' ||
        p.title.includes(q.value) ||
        p.id.toLowerCase().includes(q.value.toLowerCase()) ||
        p.tags.some((t) => t.includes(q.value))),
  ),
)

const ratingChipCls = (base: number) =>
  base <= 2 ? 'chip-ac' : base === 3 ? 'chip-live' : base <= 5 ? 'chip-tle' : 'chip-wa'
</script>

<template>
  <PageHero kicker="题库" l1="Problems" l2="题库" />

  <div class="mb-6 flex flex-wrap items-center gap-3">
    <label class="flex items-center gap-2 border border-line bg-card px-3 py-2">
      <i class="fa-solid fa-magnifying-glass text-[11px] text-ink-faint" />
      <input
        v-model="q"
        placeholder="搜索 标题 / ID / 标签"
        class="w-44 bg-transparent font-mono text-[11px] tracking-[0.06em] text-ink outline-none placeholder:text-ink-faint"
      />
    </label>
    <button
      v-for="d in levels"
      :key="d"
      class="cursor-pointer border px-3 py-1.5 font-mono text-[10px] tracking-[0.1em]"
      :class="level === d ? 'border-ink bg-ink text-paper' : 'border-line bg-card text-ink-soft hover:border-ink hover:text-ink'"
      @click="level = d"
    >
      {{ d === '全部' ? '全部' : `Lv${d}` }}
    </button>
    <span class="ml-auto font-mono text-[9px] tracking-[0.16em] text-ink-faint">
      {{ list.length }} / {{ problemCache.length }} SHOWN
    </span>
  </div>

  <section class="card relative mb-16 border border-line bg-card">
    <header class="hidden grid-cols-[70px_1fr_80px_120px_70px] gap-3 border-b border-line-soft px-5 py-2.5 font-mono text-[9px] tracking-[0.18em] text-ink-faint md:grid">
      <span>ID</span><span>标题 / TITLE</span><span>评级</span><span class="text-right">AC / SUBMIT</span><span class="text-right">RATE</span>
    </header>
    <div v-if="loading" class="px-5 py-10 text-center font-mono text-[10px] tracking-[0.24em] text-ink-faint">
      <i class="fa-solid fa-circle-notch fa-spin mr-2" />LOADING PROBLEMS…
    </div>
    <template v-else>
      <router-link
        v-for="p in list"
        :key="p.id"
        :to="`/problem/${p.id}`"
        class="grid grid-cols-[70px_1fr_auto] items-center gap-3 border-b border-dashed border-line-soft px-5 py-3.5 no-underline last:border-b-0 hover:bg-accent/10 md:grid-cols-[70px_1fr_80px_120px_70px]"
      >
        <span class="font-mono text-[11px] text-accent-deep">{{ p.id }}</span>
        <span class="min-w-0">
          <span class="block truncate text-[13px] font-bold text-ink">{{ p.title }}</span>
          <span class="mt-0.5 block font-mono text-[9px] tracking-[0.1em] text-ink-faint">
            {{ p.tags.join(' · ') }}
          </span>
        </span>
        <span><span class="chip" :class="ratingChipCls(p.base)">{{ p.rating.toFixed(1) }}</span></span>
        <span class="hidden text-right font-mono text-[10px] text-ink-soft md:block">
          {{ p.ac }} / {{ p.submitted }}
        </span>
        <span class="hidden text-right font-mono text-[11px] font-bold text-ink md:block">{{ p.rate }}%</span>
      </router-link>
      <div v-if="list.length === 0" class="px-5 py-10 text-center font-mono text-[10px] tracking-[0.2em] text-ink-faint">
        // NO MATCH — 换个关键词
      </div>
    </template>
  </section>
</template>
