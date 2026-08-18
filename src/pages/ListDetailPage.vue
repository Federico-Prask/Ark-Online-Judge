<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api, type ProblemListDetail, type User } from '../api'
import { difficultyClass } from '../utils'

const props = defineProps<{ id: number; user: User | null }>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
}>()

const list = ref<ProblemListDetail | null>(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    list.value = await api.list(props.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    list.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.id, load)
</script>

<template>
  <section class="page-panel" v-if="loading"><div class="empty-hint">加载中…</div></section>
  <section class="page-panel" v-else-if="error">
    <div class="empty-hint error">{{ error }}</div>
    <button class="all-problems" @click="emit('navigate', '题单')">返回题单</button>
  </section>
  <section class="page-panel" v-else-if="list">
    <div class="page-head">
      <div>
        <small>// LIST #{{ list.id }} · {{ list.owner_nickname }}</small>
        <h2>{{ list.title }}</h2>
        <p class="page-desc">{{ list.description }}</p>
        <div class="meta-row">
          <span class="chip">{{ list.problem_count }} 题</span>
          <span class="chip" v-if="user"
            >进度 {{ list.solved_count }} / {{ list.problem_count }}</span
          >
        </div>
      </div>
      <div class="page-tools">
        <button class="ghost-btn" @click="emit('navigate', '题单')">← 题单</button>
      </div>
    </div>

    <div class="progress-bar" v-if="user && list.problem_count">
      <span
        :style="{
          width: Math.round((list.solved_count / list.problem_count) * 100) + '%',
        }"
      ></span>
    </div>

    <div class="table-wrap">
      <div class="table-head list-grid">
        <span>#</span>
        <span>题号</span>
        <span>标题</span>
        <span>难度</span>
        <span>通过率</span>
        <span>状态</span>
      </div>
      <div
        v-for="(p, i) in list.problems"
        :key="p.id"
        class="table-row list-grid clickable"
        @click="emit('navigate', '题目', { code: p.code })"
      >
        <span class="mono muted">{{ i + 1 }}</span>
        <span class="mono">{{ p.code }}</span>
        <span>{{ p.title }}</span>
        <span
          ><span class="difficulty" :class="difficultyClass(p.difficulty)">{{
            p.difficulty
          }}</span></span
        >
        <span class="mono ac-text">{{ p.ac_rate }}%</span>
        <span>
          <span v-if="p.solved === 'AC'" class="verdict st-ac">AC</span>
          <span v-else class="muted">—</span>
        </span>
      </div>
    </div>
  </section>
</template>
