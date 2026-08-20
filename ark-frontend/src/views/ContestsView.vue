<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createContest, deleteContestApi, fetchContests, loadProblems, problemCache, type ContestPub } from '../lib/api'
import { me } from '../lib/session'

const contests = ref<ContestPub[]>([])
const loading = ref(true)
const error = ref('')

const canManage = computed(() => !!me.value?.perms.includes('contest'))

const fmt = (ts: number) => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const refresh = async () => {
  contests.value = await fetchContests().catch(() => [] as ContestPub[])
  loading.value = false
}
onMounted(async () => {
  void loadProblems()
  await refresh()
})

// ---------------- 创建比赛 ----------------
const showCreate = ref(false)
const title = ref('')
const mode = ref<'ACM' | 'OI'>('ACM')
const startLocal = ref('')
const endLocal = ref('')
const freezeMin = ref(30)
const picked = ref<string[]>([])

const togglePick = (pid: string) => {
  picked.value = picked.value.includes(pid) ? picked.value.filter((x) => x !== pid) : [...picked.value, pid]
}

const submitCreate = async () => {
  error.value = ''
  const s = new Date(startLocal.value).getTime()
  const e = new Date(endLocal.value).getTime()
  if (!title.value.trim() || !(e > s) || picked.value.length === 0) {
    error.value = '标题 / 时间 / 赛题 均需有效'
    return
  }
  try {
    await createContest({ title: title.value.trim(), mode: mode.value, start: s, end: e, problems: picked.value, freezeMin: freezeMin.value })
    showCreate.value = false
    title.value = ''
    picked.value = []
    await refresh()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '创建失败'
  }
}

// ---------------- 删除（两次确认） ----------------
const confirmDel = ref('')
let delTimer = 0
const askDelete = (id: string) => {
  if (confirmDel.value === id) {
    void doDelete(id)
  } else {
    confirmDel.value = id
    window.clearTimeout(delTimer)
    delTimer = window.setTimeout(() => (confirmDel.value = ''), 3000)
  }
}
const doDelete = async (id: string) => {
  error.value = ''
  try {
    await deleteContestApi(id)
    contests.value = contests.value.filter((c) => c.id !== id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
  } finally {
    confirmDel.value = ''
  }
}
</script>

<template>
  <section class="pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ 比赛 ]</span>
      <span>CONTESTS · {{ contests.length }}</span>
    </div>
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 class="text-[clamp(28px,3.6vw,44px)] font-black tracking-[-0.015em]">
        赛事<span class="grad-text">中心</span>
      </h1>
      <button v-if="canManage" class="btn-dark" @click="showCreate = !showCreate">
        <i class="fa-solid fa-plus mr-1.5" />创建比赛
      </button>
    </div>

    <div v-if="error" class="mb-4 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">
      [!] {{ error }}
    </div>

    <!-- 创建面板 -->
    <section v-if="showCreate && canManage" class="card relative mb-8 border border-line bg-card px-6 py-5">
      <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[13px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span> 新建比赛 <span class="font-mono font-normal text-accent-deep">]</span>
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">NEW.CONTEST</span>
      </h2>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">TITLE 标题</label>
          <input v-model="title" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" placeholder="周赛 #13" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">MODE 赛制</label>
          <select v-model="mode" class="w-full cursor-pointer border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none">
            <option value="ACM">ACM（过题 + 罚时）</option>
            <option value="OI">OI（按分数）</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">START 开始</label>
          <input v-model="startLocal" type="datetime-local" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">END 结束</label>
            <input v-model="endLocal" type="datetime-local" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
          </div>
          <div>
            <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">封榜(分钟)</label>
            <input v-model.number="freezeMin" type="number" min="0" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
          </div>
        </div>
      </div>
      <div class="mt-4">
        <label class="mb-2 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">PROBLEMS 赛题（多选）</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in problemCache"
            :key="p.id"
            class="chip cursor-pointer"
            :class="picked.includes(p.id) ? 'chip-live' : 'chip-idle'"
            @click="togglePick(p.id)"
          >
            {{ p.id }} {{ p.title }}
          </button>
        </div>
      </div>
      <div class="mt-5">
        <button class="btn-dark" @click="submitCreate">创建 <i class="fa-solid fa-flag ml-1.5" /></button>
      </div>
    </section>

    <!-- 列表 -->
    <div v-if="loading" class="card relative border border-line bg-card px-5 py-10 text-center font-mono text-[10px] tracking-[0.24em] text-ink-faint">
      <i class="fa-solid fa-circle-notch fa-spin mr-2" />LOADING CONTESTS…
    </div>
    <section v-else class="grid grid-cols-1 gap-4.5 md:grid-cols-2">
      <div v-for="c in contests" :key="c.id" class="card relative flex flex-col border border-line bg-card px-6 py-5">
        <div class="flex items-center gap-2">
          <span v-if="c.status === 'running'" class="live-dot h-[7px] w-[7px] rounded-full bg-signal-red" />
          <span class="text-[15px] font-bold text-ink">{{ c.title }}</span>
          <span class="chip" :class="c.status === 'running' ? 'chip-live' : c.status === 'upcoming' ? 'chip-idle' : 'chip-ac'">
            {{ c.status === 'running' ? '进行中' : c.status === 'upcoming' ? '即将开始' : '已结束' }}
          </span>
          <span class="chip chip-idle">{{ c.mode }}</span>
        </div>
        <div class="mt-2 font-mono text-[9px] tracking-[0.14em] text-ink-faint">
          {{ fmt(c.start) }} → {{ fmt(c.end) }} · 封榜 {{ c.freezeMin }}min · {{ c.status === 'upcoming' ? '?' : c.problems.length }} 题
        </div>
        <div class="mt-5 flex items-center justify-between">
          <router-link :to="`/contest/${c.id}`" class="btn-base">
            {{ c.status === 'running' ? '进入比赛' : '详情' }} <i class="fa-solid fa-arrow-right ml-1" />
          </router-link>
          <button
            v-if="canManage"
            class="chip cursor-pointer"
            :class="confirmDel === c.id ? 'chip-wa' : 'chip-idle'"
            @click="askDelete(c.id)"
          >
            {{ confirmDel === c.id ? '确认删除?' : '删除' }}
          </button>
        </div>
      </div>
    </section>
  </section>
</template>
