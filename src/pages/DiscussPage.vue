<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api, type Discussion, type User } from '../api'
import { relativeTime } from '../utils'
import Pagination from '../components/Pagination.vue'

const props = defineProps<{ user: User | null; focusId?: number | null }>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'login'): void
}>()

const items = ref<Discussion[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const query = ref('')
const loading = ref(false)

const detail = ref<Awaited<ReturnType<typeof api.discussion>> | null>(null)
const showNew = ref(false)
const newTitle = ref('')
const newBody = ref('')
const replyBody = ref('')
const busy = ref(false)
const err = ref('')

async function load() {
  loading.value = true
  try {
    const r = await api.discussions({ q: query.value, page: page.value, pageSize: 15 })
    items.value = r.items
    total.value = r.total
    totalPages.value = r.totalPages
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function open(id: number) {
  try {
    detail.value = await api.discussion(id)
    replyBody.value = ''
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(async () => {
  await load()
  if (props.focusId) open(props.focusId)
})
watch(page, load)
watch(
  () => props.focusId,
  (id) => {
    if (id) open(id)
  },
)
let t: number | undefined
watch(query, () => {
  clearTimeout(t)
  t = window.setTimeout(() => {
    page.value = 1
    load()
  }, 280)
})

async function createPost() {
  if (!props.user) return emit('login')
  busy.value = true
  err.value = ''
  try {
    const r = await api.createDiscussion({ title: newTitle.value, body: newBody.value })
    showNew.value = false
    newTitle.value = ''
    newBody.value = ''
    await load()
    await open(r.id)
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

async function sendReply() {
  if (!props.user) return emit('login')
  if (!detail.value) return
  busy.value = true
  err.value = ''
  try {
    await api.replyDiscussion(detail.value.id, replyBody.value)
    replyBody.value = ''
    await open(detail.value.id)
    await load()
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="page-panel discuss-layout">
    <div class="discuss-list">
      <div class="page-head">
        <div>
          <small>// FORUM</small>
          <h2>讨论</h2>
        </div>
        <div class="page-tools">
          <div class="search">
            <font-awesome-icon icon="magnifying-glass" />
            <input v-model="query" placeholder="搜索讨论" />
          </div>
          <button class="action-main compact" @click="user ? (showNew = true) : emit('login')">
            发帖
          </button>
        </div>
      </div>

      <div v-if="loading" class="empty-hint">加载中…</div>
      <div
        v-for="d in items"
        :key="d.id"
        class="discuss-item clickable"
        :class="{ sel: detail?.id === d.id }"
        @click="open(d.id)"
      >
        <div class="di-top">
          <span v-if="d.pinned" class="chip highlight-chip">PIN</span>
          <b>{{ d.title }}</b>
        </div>
        <div class="di-meta muted">
          <span>{{ d.author_nickname }}</span>
          <span v-if="d.problem_code">· {{ d.problem_code }}</span>
          <span>· {{ relativeTime(d.updated_at) }}</span>
          <span>· {{ d.replies }} 回复</span>
        </div>
      </div>
      <div v-if="!loading && !items.length" class="empty-hint">暂无讨论</div>
      <Pagination
        :page="page"
        :total-pages="totalPages"
        :total="total"
        @update:page="page = $event"
      />
    </div>

    <div class="discuss-detail">
      <div v-if="!detail" class="empty-hint">选择左侧帖子查看</div>
      <template v-else>
        <small>// THREAD #{{ detail.id }}</small>
        <h2>{{ detail.title }}</h2>
        <div class="di-meta muted">
          {{ detail.author_nickname }} · {{ relativeTime(detail.created_at) }}
          <button
            v-if="detail.problem_code"
            class="linkish"
            @click="emit('navigate', '题目', { code: detail.problem_code })"
          >
            · 关联 {{ detail.problem_code }}
          </button>
        </div>
        <div class="post-body">{{ detail.body }}</div>

        <div class="replies">
          <h3>回复 ({{ detail.replies?.length || 0 }})</h3>
          <div v-for="r in detail.replies" :key="r.id" class="reply">
            <div class="di-meta">
              <b>{{ r.author_nickname }}</b>
              <span class="muted">{{ relativeTime(r.created_at) }}</span>
            </div>
            <p>{{ r.body }}</p>
          </div>
          <div v-if="!detail.replies?.length" class="empty-hint">还没有回复</div>
        </div>

        <div class="reply-box">
          <textarea
            v-model="replyBody"
            rows="3"
            placeholder="写下你的回复…"
            :disabled="busy"
          ></textarea>
          <p v-if="err" class="auth-error">{{ err }}</p>
          <button class="action-main compact" :disabled="busy || !replyBody.trim()" @click="sendReply">
            发送回复
          </button>
        </div>
      </template>
    </div>

    <div v-if="showNew" class="auth-overlay" @click.self="showNew = false">
      <div class="auth-modal wide">
        <div class="auth-head">
          <small>// NEW THREAD</small>
          <h2>发布讨论</h2>
          <button class="auth-close" @click="showNew = false">×</button>
        </div>
        <form @submit.prevent="createPost">
          <label class="auth-field">
            <small>TITLE</small>
            <input v-model.trim="newTitle" maxlength="120" required />
          </label>
          <label class="auth-field">
            <small>BODY</small>
            <textarea v-model.trim="newBody" rows="6" required class="auth-textarea"></textarea>
          </label>
          <p v-if="err" class="auth-error">{{ err }}</p>
          <button class="auth-submit" type="submit" :disabled="busy">发布</button>
        </form>
      </div>
    </div>
  </section>
</template>
