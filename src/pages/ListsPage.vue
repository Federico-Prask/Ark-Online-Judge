<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api, type ProblemListSummary, type User } from '../api'
import { formatDate, relativeTime } from '../utils'
import Pagination from '../components/Pagination.vue'

const props = defineProps<{ user: User | null }>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'login'): void
}>()

const items = ref<ProblemListSummary[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const query = ref('')
const loading = ref(false)
const showCreate = ref(false)
const createTitle = ref('')
const createDesc = ref('')
const createBusy = ref(false)
const createError = ref('')

async function load() {
  loading.value = true
  try {
    const r = await api.lists({ q: query.value, page: page.value, pageSize: 12 })
    items.value = r.items
    total.value = r.total
    totalPages.value = r.totalPages
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(page, load)
let t: number | undefined
watch(query, () => {
  clearTimeout(t)
  t = window.setTimeout(() => {
    page.value = 1
    load()
  }, 280)
})

async function createList() {
  if (!props.user) {
    emit('login')
    return
  }
  createError.value = ''
  createBusy.value = true
  try {
    const list = await api.createList({
      title: createTitle.value,
      description: createDesc.value,
      is_public: true,
    })
    showCreate.value = false
    createTitle.value = ''
    createDesc.value = ''
    emit('navigate', '题单详情', { id: list.id })
  } catch (e) {
    createError.value = e instanceof Error ? e.message : String(e)
  } finally {
    createBusy.value = false
  }
}
</script>

<template>
  <section class="page-panel">
    <div class="page-head">
      <div>
        <small>// PROBLEM LISTS</small>
        <h2>题单</h2>
      </div>
      <div class="page-tools">
        <div class="search">
          <font-awesome-icon icon="magnifying-glass" />
          <input v-model="query" placeholder="搜索题单" />
        </div>
        <button class="action-main compact" @click="user ? (showCreate = true) : emit('login')">
          新建题单
        </button>
      </div>
    </div>

    <div v-if="loading" class="empty-hint">加载中…</div>
    <div v-else-if="!items.length" class="empty-hint">暂无题单</div>
    <div class="card-grid" v-else>
      <article
        class="ark-card clickable"
        v-for="l in items"
        :key="l.id"
        @click="emit('navigate', '题单详情', { id: l.id })"
      >
        <small>// LIST #{{ l.id }}</small>
        <h3>{{ l.title }}</h3>
        <p>{{ l.description || '暂无描述' }}</p>
        <div class="card-foot">
          <span>{{ l.problem_count }} 题</span>
          <span>{{ l.owner_nickname }}</span>
          <span>{{ relativeTime(l.updated_at) || formatDate(l.updated_at) }}</span>
        </div>
      </article>
    </div>

    <Pagination
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @update:page="page = $event"
    />

    <div v-if="showCreate" class="auth-overlay" @click.self="showCreate = false">
      <div class="auth-modal">
        <div class="auth-head">
          <small>// NEW LIST</small>
          <h2>新建题单</h2>
          <button class="auth-close" @click="showCreate = false">×</button>
        </div>
        <form @submit.prevent="createList">
          <label class="auth-field">
            <small>TITLE</small>
            <input v-model.trim="createTitle" maxlength="80" required placeholder="题单名称" />
          </label>
          <label class="auth-field">
            <small>DESCRIPTION</small>
            <input v-model.trim="createDesc" maxlength="500" placeholder="简介（可选）" />
          </label>
          <p v-if="createError" class="auth-error">{{ createError }}</p>
          <button class="auth-submit" type="submit" :disabled="createBusy">
            {{ createBusy ? '创建中…' : '创建' }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>
