<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchDiscussions, postThread, type ThreadPub } from '../lib/api'
import { loggedIn, me } from '../lib/session'
import { CATS, type CatKey } from '../lib/cats'

const threads = ref<ThreadPub[]>([])
const error = ref('')
const showNew = ref(false)
const title = ref('')
const content = ref('')
const category = ref<CatKey>('help')

const canPost = computed(() => !!me.value?.perms.includes('discuss'))
const isAdmin = computed(() => me.value?.role === 'admin')

const fmt = (ts: number) => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(async () => {
  threads.value = await fetchDiscussions().catch(() => [])
})

const byCat = (key: string) => threads.value.filter((t) => t.category === key)

const submitNew = async () => {
  error.value = ''
  try {
    await postThread(title.value, content.value, category.value)
    showNew.value = false
    title.value = ''
    content.value = ''
    threads.value = await fetchDiscussions()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发布失败'
  }
}
</script>

<template>
  <section class="pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ 讨论 ]</span>
      <span>DISCUSS · {{ threads.length }}</span>
    </div>
    <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 class="text-[clamp(28px,3.6vw,44px)] font-black tracking-[-0.015em] text-ink">
        讨论区
      </h1>
      <button v-if="loggedIn && canPost" class="btn-dark" @click="showNew = !showNew">
        <i class="fa-solid fa-pen mr-1.5" />发新帖
      </button>
      <span v-else-if="loggedIn" class="font-mono text-[9px] tracking-[0.14em] text-signal-red">[!] 发表讨论权限已停用</span>
    </div>

    <div v-if="error" class="mb-4 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">[!] {{ error }}</div>

    <section v-if="showNew" class="card relative mb-8 border border-line bg-card px-6 py-5">
      <div class="mb-4 grid gap-4 md:grid-cols-[1fr_220px]">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">TITLE 标题</label>
          <input v-model="title" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">CATEGORY 分区</label>
          <select v-model="category" class="w-full cursor-pointer border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none">
            <option v-for="c in CATS" :key="c.key" :value="c.key" :disabled="c.key === 'announce' && !isAdmin">
              {{ c.zh }}{{ c.key === 'announce' && !isAdmin ? '（仅管理员）' : '' }}
            </option>
          </select>
        </div>
      </div>
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">CONTENT 内容</label>
      <textarea v-model="content" rows="5" class="mb-4 w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none focus:border-accent-deep" />
      <button class="btn-dark" @click="submitNew">发布 <i class="fa-solid fa-paper-plane ml-1.5" /></button>
    </section>

    <!-- 四分区：公告 / 求助 / 题解 / 灌水 -->
    <section v-for="c in CATS" :key="c.key" class="card relative mb-6 border border-line bg-card">
      <header
        class="flex items-center justify-between px-5 py-3"
        :style="{ borderBottom: `1px solid ${c.color}33` }"
      >
        <span class="flex items-center gap-2.5 text-[14px] font-extrabold text-ink">
          <span class="h-3 w-3" :style="{ background: c.color, clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }" />
          {{ c.zh }}
          <span class="font-mono text-[8px] tracking-[0.22em]" :style="{ color: c.color }">{{ c.key.toUpperCase() }}</span>
        </span>
        <span class="font-mono text-[9px] tracking-[0.16em] text-ink-faint">{{ byCat(c.key).length }} THREADS</span>
      </header>
      <div v-if="byCat(c.key).length === 0" class="px-5 py-6 text-center font-mono text-[9px] tracking-[0.2em] text-ink-faint">
        // 暂无帖子
      </div>
      <router-link
        v-for="t in byCat(c.key)"
        :key="t.id"
        :to="`/discuss/${t.id}`"
        class="flex items-center justify-between gap-4 border-b border-dashed border-line-soft px-5 py-3.5 no-underline last:border-b-0 hover:bg-accent/10"
      >
        <span class="min-w-0">
          <span class="block truncate text-[13.5px] font-bold text-ink">{{ t.title }}</span>
          <span class="mt-1 block font-mono text-[9px] tracking-[0.12em] text-ink-faint">{{ t.author }} · {{ fmt(t.ts) }}</span>
        </span>
        <span class="chip flex-none" :style="{ color: c.color, borderColor: c.color }">
          <i class="fa-regular fa-comments mr-1 text-[8px]" />{{ t.replyCount }}
        </span>
      </router-link>
    </section>
  </section>
</template>
