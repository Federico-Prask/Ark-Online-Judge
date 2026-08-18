<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api, type ProblemSummary } from '../api'
import { difficultyClass } from '../utils'
import Pagination from '../components/Pagination.vue'

const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
}>()

const items = ref<ProblemSummary[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = ref(1)
const loading = ref(false)
const query = ref('')
const difficulty = ref('')
const tag = ref('')
const tags = ref<{ name: string; count: number }[]>([])

async function load() {
  loading.value = true
  try {
    const res = await api.problems({
      q: query.value,
      difficulty: difficulty.value || undefined,
      tag: tag.value || undefined,
      page: page.value,
      pageSize,
    })
    items.value = res.items
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (e) {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadTags() {
  try {
    const r = await api.problemTags()
    tags.value = r.tags
  } catch {
    tags.value = []
  }
}

onMounted(() => {
  load()
  loadTags()
})

watch([page, difficulty, tag], () => load())

let searchTimer: number | undefined
watch(query, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 280)
})

function solvedMark(s?: string | null) {
  if (s === 'AC') return '✓'
  if (s === 'TRIED') return '·'
  return ''
}
</script>

<template>
  <section class="page-panel">
    <div class="page-head">
      <div>
        <small>// PROBLEM SET</small>
        <h2>题库</h2>
      </div>
      <div class="page-tools">
        <div class="search">
          <font-awesome-icon icon="magnifying-glass" />
          <input v-model="query" placeholder="搜索题号 / 标题 / 标签" />
        </div>
        <select v-model="difficulty" class="filter-select">
          <option value="">全部难度</option>
          <option value="入门">入门</option>
          <option value="进阶">进阶</option>
          <option value="困难">困难</option>
        </select>
      </div>
    </div>

    <div class="tag-row" v-if="tags.length">
      <button :class="{ sel: !tag }" @click="tag = ''; page = 1">全部</button>
      <button
        v-for="t in tags"
        :key="t.name"
        :class="{ sel: tag === t.name }"
        @click="tag = tag === t.name ? '' : t.name; page = 1"
      >
        {{ t.name }} <sup>{{ t.count }}</sup>
      </button>
    </div>

    <div class="table-wrap">
      <div class="table-head problems-grid">
        <span></span>
        <span>题号</span>
        <span>标题</span>
        <span>难度</span>
        <span>标签</span>
        <span>通过率</span>
        <span>AC / 提交</span>
      </div>
      <div v-if="loading" class="empty-hint">加载中…</div>
      <div v-else-if="!items.length" class="empty-hint">没有匹配的题目</div>
      <div
        v-for="p in items"
        :key="p.id"
        class="table-row problems-grid clickable"
        @click="emit('navigate', '题目', { code: p.code })"
      >
        <span class="solved-mark" :class="{ ac: p.solved === 'AC', tried: p.solved === 'TRIED' }">{{
          solvedMark(p.solved)
        }}</span>
        <span class="mono">{{ p.code }}</span>
        <span class="title-cell">{{ p.title }}</span>
        <span
          ><span class="difficulty" :class="difficultyClass(p.difficulty)">{{
            p.difficulty
          }}</span></span
        >
        <span class="tags-cell">
          <i v-for="t in (p.tags || []).slice(0, 3)" :key="t">{{ t }}</i>
        </span>
        <span class="mono ac-text">{{ p.ac_rate }}%</span>
        <span class="mono muted">{{ p.accepted }} / {{ p.submitted }}</span>
      </div>
    </div>

    <Pagination
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @update:page="page = $event"
    />
  </section>
</template>
