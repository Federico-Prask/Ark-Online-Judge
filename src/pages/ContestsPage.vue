<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { api, type ContestSummary } from '../api'
import { contestStatusLabel, countdown, formatTime } from '../utils'
import Pagination from '../components/Pagination.vue'

const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
}>()

const items = ref<ContestSummary[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const status = ref('')
const loading = ref(false)
const tick = ref(0)
let timer: number | undefined

async function load() {
  loading.value = true
  try {
    const r = await api.contests({
      status: status.value || undefined,
      page: page.value,
      pageSize: 12,
    })
    items.value = r.items
    total.value = r.total
    totalPages.value = r.totalPages
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  timer = window.setInterval(() => tick.value++, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
watch([page, status], load)

function cd(c: ContestSummary) {
  void tick.value
  if (c.status === 'upcoming') return '开始倒计时 ' + countdown(c.start_at)
  if (c.status === 'running') return '剩余 ' + countdown(c.end_at)
  return '已于 ' + formatTime(c.end_at) + ' 结束'
}
</script>

<template>
  <section class="page-panel">
    <div class="page-head">
      <div>
        <small>// CONTESTS</small>
        <h2>竞赛</h2>
      </div>
      <div class="page-tools">
        <div class="seg">
          <button :class="{ sel: !status }" @click="status = ''; page = 1">全部</button>
          <button :class="{ sel: status === 'running' }" @click="status = 'running'; page = 1">
            进行中
          </button>
          <button :class="{ sel: status === 'upcoming' }" @click="status = 'upcoming'; page = 1">
            未开始
          </button>
          <button :class="{ sel: status === 'ended' }" @click="status = 'ended'; page = 1">
            已结束
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="empty-hint">加载中…</div>
    <div v-else-if="!items.length" class="empty-hint">暂无比赛</div>
    <div class="card-grid contests" v-else>
      <article
        class="ark-card contest-card clickable"
        v-for="c in items"
        :key="c.id"
        @click="emit('navigate', '比赛', { id: c.id })"
      >
        <div class="card-top">
          <span class="status-pill" :class="'cs-' + c.status">{{
            contestStatusLabel(c.status)
          }}</span>
          <span class="chip">{{ c.rule }}</span>
        </div>
        <h3>{{ c.title }}</h3>
        <p>{{ c.description || '暂无简介' }}</p>
        <div class="card-foot">
          <span>{{ c.problem_count }} 题</span>
          <span>{{ c.participant_count }} 人</span>
          <span class="mono">{{ cd(c) }}</span>
        </div>
      </article>
    </div>

    <Pagination
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @update:page="page = $event"
    />
  </section>
</template>
