<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchProblem, fetchLangs, loadSubs, submitCode } from '../lib/api'
import type { ProblemPub, SubRow } from '../lib/api-types'
import { verdictChip } from '../lib/api-types'

const route = useRoute()
const router = useRouter()
const cid = route.query.cid ? String(route.query.cid) : undefined

const problem = ref<ProblemPub | null>(null)
const langs = ref<string[]>([])
const mySubs = ref<SubRow[]>([])
const submitting = ref(false)

const lang = ref('C++17')
const code = ref('#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n')

const ratingChipCls = (base: number) =>
  base <= 2 ? 'chip-ac' : base === 3 ? 'chip-live' : base <= 5 ? 'chip-tle' : 'chip-wa'

onMounted(async () => {
  try {
    problem.value = await fetchProblem(String(route.params.id))
  } catch {
    problem.value = null
  }
  try {
    langs.value = await fetchLangs()
    if (langs.value.length > 0) lang.value = langs.value[0]
  } catch {
    langs.value = ['C++17', 'Python 3']
  }
  const all = await loadSubs().catch(() => [] as SubRow[])
  mySubs.value = all.filter((s) => s.mine && s.pid === route.params.id).slice(0, 6)
})

const onSubmit = async () => {
  if (!problem.value || submitting.value) return
  submitting.value = true
  try {
    const r = await submitCode(problem.value.id, lang.value, code.value, cid)
    router.push(`/submission/${r.id}`)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div v-if="!problem" class="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-ink-faint">
    // 404 — PROBLEM NOT FOUND
  </div>

  <template v-else>
    <section class="flex flex-wrap items-end justify-between gap-4 pb-8 pt-14">
      <div>
        <div class="mb-3 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
          <router-link to="/problems" class="text-accent-deep no-underline hover:underline">[ 题库 ]</router-link>
          <span class="mx-2 text-ink-faint">/</span>{{ problem.id }}
        </div>
        <h1 class="text-[clamp(28px,3.6vw,46px)] font-black leading-tight tracking-[-0.015em]">
          {{ problem.title }}
        </h1>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <router-link v-if="cid" :to="`/contest/${cid}`" class="chip chip-live no-underline">
            <i class="fa-solid fa-flag mr-1 text-[8px]" />参赛 {{ cid }}
          </router-link>
          <span class="chip" :class="ratingChipCls(problem.base)">Lv {{ problem.rating.toFixed(1) }}</span>
          <span v-for="t in problem.tags" :key="t" class="border border-line px-2 py-0.5 font-mono text-[9px] text-ink-soft">{{ t }}</span>
          <span class="ml-2 font-mono text-[9px] tracking-[0.14em] text-ink-faint">
            AC {{ problem.ac }} / {{ problem.submitted }} · RATE {{ problem.rate }}% · TL {{ problem.tl }}ms · {{ problem.nTests }} TESTS
          </span>
        </div>
      </div>
    </section>

    <div class="mb-16 grid gap-5 lg:grid-cols-[1fr_400px]">
      <section class="card relative border border-line bg-card px-6 py-5">
        <h2 class="mb-3 border-b border-line-soft pb-2.5 text-[14px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 题目描述 <span class="font-mono font-normal text-accent-deep">]</span>
          <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">DESCRIPTION</span>
        </h2>
        <p v-for="(s, i) in problem.statement" :key="i" class="mb-3 text-[13px] leading-7 text-ink-soft">{{ s }}</p>

        <h2 class="mb-2 mt-6 text-[13px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 输入格式 <span class="font-mono font-normal text-accent-deep">]</span>
        </h2>
        <p class="mb-4 text-[13px] leading-7 text-ink-soft">{{ problem.input }}</p>

        <h2 class="mb-2 text-[13px] font-extrabold">
          <span class="font-mono font-normal text-accent-deep">[</span> 输出格式 <span class="font-mono font-normal text-accent-deep">]</span>
        </h2>
        <p class="mb-4 text-[13px] leading-7 text-ink-soft">{{ problem.output }}</p>

        <div v-for="(s, i) in problem.samples" :key="i" class="mt-5 grid gap-3 md:grid-cols-2">
          <div>
            <div class="mb-1.5 flex justify-between font-mono text-[9px] tracking-[0.18em] text-ink-faint">
              <span>输入样例 {{ i + 1 }}</span><span>SAMPLE.IN</span>
            </div>
            <pre class="overflow-x-auto border border-line bg-paper px-3.5 py-2.5 font-mono text-[11.5px] leading-6 text-ink">{{ s.input }}</pre>
          </div>
          <div>
            <div class="mb-1.5 flex justify-between font-mono text-[9px] tracking-[0.18em] text-ink-faint">
              <span>输出样例 {{ i + 1 }}</span><span>SAMPLE.OUT</span>
            </div>
            <pre class="overflow-x-auto border border-line bg-paper px-3.5 py-2.5 font-mono text-[11.5px] leading-6 text-ink">{{ s.output }}</pre>
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-5">
        <section class="card relative border border-line bg-card">
          <header class="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
            <span class="text-[12px] font-extrabold">
              <span class="font-mono font-normal text-accent-deep">[</span> 代码 <span class="font-mono font-normal text-accent-deep">]</span>
              <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">EDITOR</span>
            </span>
            <select
              v-model="lang"
              class="cursor-pointer border border-line bg-card px-2 py-1 font-mono text-[10px] text-ink outline-none"
            >
              <option v-for="l in langs" :key="l">{{ l }}</option>
            </select>
          </header>
          <textarea
            v-model="code"
            spellcheck="false"
            rows="14"
            class="block w-full resize-y bg-transparent px-4 py-3 font-mono text-[12px] leading-6 text-ink outline-none"
          />
          <footer class="flex items-center justify-between border-t border-line-soft px-4 py-3">
            <span class="font-mono text-[9px] tracking-[0.14em] text-ink-faint">{{ code.length }} CHARS</span>
            <button class="btn-dark" :disabled="submitting" @click="onSubmit">
              {{ submitting ? '已入队' : '提交评测' }} <i :class="submitting ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-paper-plane'" class="ml-1.5" />
            </button>
          </footer>
        </section>

        <section class="card relative border border-line bg-card px-4 pb-3 pt-3.5">
          <header class="mb-2 flex items-center justify-between border-b border-line-soft pb-2">
            <span class="text-[12px] font-extrabold">
              <span class="font-mono font-normal text-accent-deep">[</span> 本题提交 <span class="font-mono font-normal text-accent-deep">]</span>
            </span>
            <router-link to="/submissions" class="mono-link">全部 →</router-link>
          </header>
          <div v-if="mySubs.length === 0" class="py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">
            // NO SUBMISSION YET
          </div>
          <router-link
            v-for="s in mySubs"
            :key="s.id"
            :to="`/submission/${s.id}`"
            class="flex items-center justify-between border-b border-dashed border-line-soft py-2 font-mono text-[10.5px] no-underline last:border-b-0 hover:bg-accent/10"
          >
            <span class="text-ink-faint">#{{ s.id }}</span>
            <span class="text-ink-soft">{{ s.lang }}</span>
            <span class="chip" :class="verdictChip[s.verdict].cls">
              <i v-if="s.verdict === 'JUDGING'" class="fa-solid fa-circle-notch fa-spin mr-1 text-[8px]" />{{ verdictChip[s.verdict].zh }}
            </span>
            <span class="text-ink-faint">{{ s.time }}</span>
          </router-link>
        </section>
      </div>
    </div>
  </template>
</template>
