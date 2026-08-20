<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteReplyApi, deleteThreadApi, fetchThread, postReply, type ThreadPub } from '../lib/api'
import { me } from '../lib/session'
import { catOf } from '../lib/cats'

const route = useRoute()
const router = useRouter()
const thread = ref<ThreadPub | null>(null)
const reply = ref('')
const error = ref('')

const canPost = computed(() => !!me.value?.perms.includes('discuss'))
const canMod = (author: string) => me.value?.name === author || me.value?.role === 'admin'

const fmt = (ts: number) => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

onMounted(async () => {
  try {
    thread.value = await fetchThread(Number(route.params.id))
  } catch {
    thread.value = null
  }
})

const submitReply = async () => {
  error.value = ''
  try {
    thread.value = await postReply(Number(route.params.id), reply.value)
    reply.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '回复失败'
  }
}

const removeThread = async () => {
  if (!thread.value) return
  try {
    await deleteThreadApi(thread.value.id)
    router.push('/discuss')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

const removeReply = async (rid: number) => {
  if (!thread.value) return
  try {
    await deleteReplyApi(thread.value.id, rid)
    thread.value = await fetchThread(thread.value.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}
</script>

<template>
  <div v-if="!thread" class="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-ink-faint">
    // 404 — THREAD NOT FOUND
  </div>

  <section v-else class="mx-auto max-w-[860px] pb-24 pt-16">
    <router-link to="/discuss" class="mb-6 inline-block font-mono text-[10px] tracking-[0.2em] text-accent-deep no-underline hover:underline">
      [ 讨论 ] ← 返回
    </router-link>

    <div class="mb-3 flex items-start justify-between gap-4">
      <div>
        <span
          class="mb-2 inline-block border px-2 py-0.5 font-mono text-[9px] tracking-[0.16em]"
          :style="{ color: catOf(thread.category).color, borderColor: catOf(thread.category).color }"
        >
          {{ catOf(thread.category).zh }}
        </span>
        <h1 class="text-[clamp(22px,3vw,34px)] font-black leading-tight tracking-[-0.015em]">{{ thread.title }}</h1>
      </div>
      <button v-if="canMod(thread.author)" class="chip chip-idle cursor-pointer flex-none" @click="removeThread">删帖</button>
    </div>
    <div class="mb-6 font-mono text-[9px] tracking-[0.14em] text-ink-faint">{{ thread.author }} · {{ fmt(thread.ts) }}</div>

    <section class="card relative mb-8 border border-line bg-card px-6 py-5">
      <p class="whitespace-pre-wrap text-[13px] leading-7 text-ink-soft">{{ thread.content }}</p>
    </section>

    <h2 class="mb-4 text-[14px] font-extrabold">
      <span class="font-mono font-normal text-accent-deep">[</span> 回复 <span class="font-mono font-normal text-accent-deep">]</span>
      <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">{{ thread.replies?.length ?? 0 }}</span>
    </h2>

    <div v-for="r in thread.replies" :key="r.id" class="card relative mb-3 border border-line bg-card px-5 py-4">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-mono text-[10px] tracking-[0.12em] text-ink-soft">
          <router-link :to="`/user/${r.author}`" class="font-bold text-ink no-underline hover:text-accent-deep">{{ r.author }}</router-link>
          · {{ fmt(r.ts) }}
        </span>
        <button v-if="canMod(r.author)" class="chip chip-idle cursor-pointer" @click="removeReply(r.id)">删除</button>
      </div>
      <p class="whitespace-pre-wrap text-[12.5px] leading-6 text-ink-soft">{{ r.content }}</p>
    </div>

    <div v-if="error" class="mb-3 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">[!] {{ error }}</div>

    <section v-if="canPost" class="card relative border border-line bg-card px-5 py-4">
      <textarea v-model="reply" rows="3" placeholder="写下你的回复…" class="mb-3 w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none focus:border-accent-deep" />
      <button class="btn-dark" @click="submitReply">回复 <i class="fa-solid fa-paper-plane ml-1.5" /></button>
    </section>
    <p v-else class="font-mono text-[9px] tracking-[0.16em] text-ink-faint">// 登录后参与讨论</p>
  </section>
</template>
