<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, type ContestDetail, type User } from '../api'
import {
  contestStatusLabel,
  countdown,
  difficultyClass,
  formatTime,
} from '../utils'

const props = defineProps<{ id: number; user: User | null }>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'login'): void
}>()

const contest = ref<ContestDetail | null>(null)
const rank = ref<Awaited<ReturnType<typeof api.contestRank>> | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'problems' | 'rank'>('problems')
const busy = ref(false)
const tick = ref(0)
let timer: number | undefined

async function load() {
  loading.value = true
  error.value = ''
  try {
    contest.value = await api.contest(props.id)
    if (tab.value === 'rank') await loadRank()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function loadRank() {
  try {
    rank.value = await api.contestRank(props.id)
  } catch {
    rank.value = null
  }
}

onMounted(() => {
  load()
  timer = window.setInterval(() => tick.value++, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
watch(() => props.id, load)
watch(tab, (t) => {
  if (t === 'rank') loadRank()
})

const cdText = computed(() => {
  void tick.value
  if (!contest.value) return ''
  if (contest.value.status === 'upcoming') return '距开始 ' + countdown(contest.value.start_at)
  if (contest.value.status === 'running') return '距结束 ' + countdown(contest.value.end_at)
  return '比赛已结束'
})

async function toggleReg() {
  if (!props.user) {
    emit('login')
    return
  }
  if (!contest.value) return
  busy.value = true
  try {
    if (contest.value.registered) {
      await api.unregisterContest(contest.value.id)
      contest.value.registered = false
    } else {
      await api.registerContest(contest.value.id)
      contest.value.registered = true
    }
    await load()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}

function openProblem(p: ContestDetail['problems'][0]) {
  if (!p.code && !p.id) return
  emit('navigate', '题目', {
    code: p.code || String(p.id),
    contestId: contest.value?.id,
  })
}
</script>

<template>
  <section class="page-panel" v-if="loading"><div class="empty-hint">加载中…</div></section>
  <section class="page-panel" v-else-if="error && !contest">
    <div class="empty-hint error">{{ error }}</div>
    <button class="all-problems" @click="emit('navigate', '竞赛')">返回竞赛</button>
  </section>
  <section class="page-panel" v-else-if="contest">
    <div class="page-head">
      <div>
        <small>// CONTEST #{{ contest.id }} · {{ contest.rule }}</small>
        <h2>{{ contest.title }}</h2>
        <p class="page-desc">{{ contest.description }}</p>
        <div class="meta-row">
          <span class="status-pill" :class="'cs-' + contest.status">{{
            contestStatusLabel(contest.status)
          }}</span>
          <span class="chip">{{ contest.participant_count }} 人报名</span>
          <span class="chip">{{ contest.problem_count }} 题</span>
          <span class="chip mono">{{ cdText }}</span>
        </div>
        <div class="time-row muted">
          {{ formatTime(contest.start_at) }} — {{ formatTime(contest.end_at) }}
        </div>
      </div>
      <div class="page-tools col">
        <button class="ghost-btn" @click="emit('navigate', '竞赛')">← 竞赛</button>
        <button
          v-if="contest.status !== 'ended'"
          class="action-main compact"
          :disabled="busy || (contest.status === 'running' && contest.registered)"
          @click="toggleReg"
        >
          {{
            contest.registered
              ? contest.status === 'running'
                ? '已报名'
                : '取消报名'
              : '报名参赛'
          }}
        </button>
      </div>
    </div>

    <p v-if="error" class="auth-error">{{ error }}</p>

    <div class="tabs">
      <button :class="{ sel: tab === 'problems' }" @click="tab = 'problems'">题目</button>
      <button :class="{ sel: tab === 'rank' }" @click="tab = 'rank'">榜单</button>
    </div>

    <div v-if="tab === 'problems'">
      <div v-if="contest.status === 'upcoming'" class="empty-hint">
        比赛尚未开始，题目将在开赛后解锁。
        <template v-if="contest.problems?.length">
          （共 {{ contest.problems.length }} 题：
          {{ contest.problems.map((p) => p.label).join(', ') }}）
        </template>
      </div>
      <div class="table-wrap" v-else>
        <div class="table-head cprob-grid">
          <span>题号</span>
          <span>标题</span>
          <span>难度</span>
          <span>分值</span>
          <span>状态</span>
        </div>
        <div
          v-for="p in contest.problems"
          :key="p.label"
          class="table-row cprob-grid"
          :class="{ clickable: !!(p.code || p.id) }"
          @click="openProblem(p)"
        >
          <span class="mono"><b>{{ p.label }}</b> · {{ p.code || '—' }}</span>
          <span>{{ p.title || '（未公开）' }}</span>
          <span>
            <span v-if="p.difficulty" class="difficulty" :class="difficultyClass(p.difficulty)">{{
              p.difficulty
            }}</span>
            <span v-else class="muted">—</span>
          </span>
          <span class="mono">{{ p.score }}</span>
          <span>
            <span v-if="p.solved === 'AC'" class="verdict st-ac">AC</span>
            <span v-else-if="p.solved === 'TRIED'" class="verdict st-wa">TRIED</span>
            <span v-else class="muted">—</span>
          </span>
        </div>
      </div>
    </div>

    <div v-else class="rank-pane">
      <div v-if="!rank" class="empty-hint">加载榜单…</div>
      <div v-else-if="!rank.ranking.length" class="empty-hint">暂无参赛者</div>
      <div class="table-wrap scroll-x" v-else>
        <table class="rank-table">
          <thead>
            <tr>
              <th>#</th>
              <th>选手</th>
              <th>{{ rank.rule === 'OI' ? '总分' : '解题' }}</th>
              <th v-if="rank.rule !== 'OI'">罚时</th>
              <th v-for="p in rank.problems" :key="p.label">{{ p.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rank.ranking" :key="r.user_id">
              <td class="mono">{{ r.rank }}</td>
              <td>
                <button
                  class="linkish"
                  @click="emit('navigate', '用户', { username: r.username })"
                >
                  {{ r.nickname }}
                </button>
              </td>
              <td class="mono">{{ rank.rule === 'OI' ? r.score : r.solved }}</td>
              <td v-if="rank.rule !== 'OI'" class="mono muted">{{ r.penalty }}</td>
              <td v-for="cell in r.problems" :key="cell.label" class="cell-score">
                <span v-if="cell.ac" class="verdict st-ac">
                  {{ rank.rule === 'OI' ? cell.score : cell.ac_time + "'" }}
                  <small v-if="cell.attempts > 1">(-{{ cell.attempts - 1 }})</small>
                </span>
                <span v-else-if="cell.attempts" class="verdict st-wa">-{{ cell.attempts }}</span>
                <span v-else-if="cell.pending" class="verdict st-pending">…</span>
                <span v-else class="muted">·</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
