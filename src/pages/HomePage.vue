<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api, type Overview, type User } from '../api'
import { countdown, difficultyClass, makeAvatar } from '../utils'

const props = defineProps<{
  user: User | null
  greeting: string
}>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'login'): void
}>()

const overview = ref<Overview | null>(null)
const loading = ref(true)
const readyMs = ref(1 + Math.floor(Math.random() * 150))
const nowTick = ref(0)
let timer: number | undefined

const logged = computed(() => !!props.user)
const displayName = computed(() =>
  (props.user?.nickname || props.user?.username || '').toUpperCase(),
)
const userName = computed(() => props.user?.nickname || props.user?.username || '')
const avatarSrc = computed(() => makeAvatar(props.user))
const userRoleLabel = computed(() =>
  props.user ? `ROLE / ${props.user.role.toUpperCase()}` : 'LOGIN REQUIRED',
)

const nextCd = computed(() => {
  void nowTick.value
  if (!overview.value?.next_contest) return '—'
  const c = overview.value.next_contest
  const start = new Date(c.start_at.includes('T') ? c.start_at : c.start_at.replace(' ', 'T') + 'Z')
  if (start.getTime() > Date.now()) return countdown(c.start_at)
  return countdown(c.end_at)
})

async function load() {
  loading.value = true
  try {
    overview.value = await api.overview()
  } catch {
    overview.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  timer = window.setInterval(() => {
    nowTick.value++
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function openProblem(code: string) {
  emit('navigate', '题目', { code })
}
</script>

<template>
  <section class="hero">
    <div class="hero-meta">
      // SESSION 01 / {{ logged ? 'AUTHENTICATED' : 'GUEST ACCESS' }}<br />COORD 39°54′18″N ·
      116°23′29″E
    </div>
    <div class="hero-copy">
      <div class="micro-tag">[ ARKOJ / HOMECOMING ]</div>
      <h1 v-if="!logged">欢迎来到 ArkOJ<br /><strong>算法竞赛人</strong></h1>
      <h1 v-else>
        <span>{{ greeting }}</span
        ><br /><strong>{{ userName }}</strong>
      </h1>
      <p>在这里，思考被编译，解法被验证。<br />构建你的算法坐标系，向未知发起测试。</p>
      <div class="hero-actions">
        <button class="action-main" @click="emit('navigate', '题库')">
          开始训练 <font-awesome-icon icon="arrow-right" />
        </button>
        <button class="action-secondary" @click="emit('navigate', '竞赛')">查看竞赛日历</button>
      </div>
    </div>
    <div class="hero-right">
      <div class="avatar-window">
        <img :src="avatarSrc" alt="avatar" />
      </div>
      <div class="cad-box">
        <div class="bolt"></div>
        <div class="cad-line one"></div>
        <div class="cad-line two"></div>
        <label>CORE / 0102</label>
      </div>
      <div class="big-number">01<span>02</span></div>
      <div class="hero-plate">
        <small>[ CORE MODULE ]</small><b>ALGORITHM / ONLINE</b
        ><span>READY <i></i> {{ readyMs }}ms</span>
      </div>
    </div>
    <div class="hero-foot">
      <span
        >V///A <b>■■■■■■■□□□</b></span
      ><span
        >NODES /
        {{ overview?.totals.problems ?? '—' }} P · {{ overview?.totals.users ?? '—' }} U</span
      ><span>BUILD 0.2.0</span>
    </div>
  </section>

  <section class="command-row">
    <div class="command-title">
      <span class="section-index">01</span>
      <div>
        <small>// YOUR CONSOLE</small>
        <h2>今日工作台</h2>
      </div>
    </div>
    <div class="command-item clickable" @click="emit('navigate', '题库')">
      <font-awesome-icon icon="list-check" />
      <div>
        <small>CONTINUE TRAINING</small><b>继续训练</b>
      </div>
      <strong
        >{{ overview?.me?.week_solved ?? 0
        }}<span>/{{ overview?.me?.week_goal ?? 20 }}</span></strong
      >
      <font-awesome-icon icon="arrow-right" class="arrow" />
    </div>
    <div
      class="command-item contest clickable"
      @click="
        overview?.next_contest
          ? emit('navigate', '比赛', { id: overview.next_contest.id })
          : emit('navigate', '竞赛')
      "
    >
      <font-awesome-icon icon="flag" />
      <div>
        <small>NEXT CONTEST</small>
        <b>{{ overview?.next_contest?.title || '暂无比赛' }}</b>
      </div>
      <strong>{{ nextCd }}</strong>
      <font-awesome-icon icon="arrow-right" class="arrow" />
    </div>
  </section>

  <section class="lower">
    <div class="problem-panel">
      <div class="section-head">
        <div>
          <small>// RECOMMENDED PROBLEMS</small>
          <h2>推荐题目</h2>
        </div>
        <button class="linkish" @click="emit('navigate', '题库')">全部题库 →</button>
      </div>
      <div v-if="loading" class="empty-hint">加载中…</div>
      <div
        class="problem clickable"
        v-for="p in overview?.recommended || []"
        :key="p.id"
        @click="openProblem(p.code)"
      >
        <span class="problem-id">{{ p.code }}</span>
        <div class="problem-name">
          <b>{{ p.title }}</b
          ><small>{{ (p.tags || []).join(' · ') || 'GENERAL' }} / {{ p.difficulty }}</small>
        </div>
        <span class="difficulty" :class="difficultyClass(p.difficulty)">{{ p.difficulty }}</span>
        <span class="accept-rate"
          >{{ p.ac_rate }}%<small>ACCEPTED</small></span
        >
        <font-awesome-icon icon="arrow-right" class="arrow" />
      </div>
      <button class="all-problems" @click="emit('navigate', '题库')">
        进入完整题库 <font-awesome-icon icon="arrow-right" />
      </button>
    </div>
    <aside class="status-panel">
      <small>// OPERATOR STATUS</small>
      <div class="operator">
        <div class="avatar">
          <img :src="avatarSrc" alt="avatar" />
        </div>
        <div>
          <h3>{{ logged ? displayName : 'GUEST_USER' }}</h3>
          <p>{{ userRoleLabel }}</p>
        </div>
      </div>
      <div class="status-bar">
        <span
          :style="{
            width:
              overview?.me && overview.me.week_goal
                ? Math.min(100, (overview.me.week_solved / overview.me.week_goal) * 100) + '%'
                : '0%',
          }"
        ></span>
      </div>
      <div class="status-text">
        <span>本周完成</span>
        <b>{{
          overview?.me ? `${overview.me.week_solved} / ${overview.me.week_goal}` : '— / —'
        }}</b>
      </div>
      <div class="mini-stats" v-if="overview">
        <div><small>题目</small><b>{{ overview.totals.problems }}</b></div>
        <div><small>用户</small><b>{{ overview.totals.users }}</b></div>
        <div><small>提交</small><b>{{ overview.totals.submissions }}</b></div>
        <div><small>比赛</small><b>{{ overview.totals.contests }}</b></div>
      </div>
      <button
        class="save"
        @click="logged ? emit('navigate', '用户', { username: user!.username }) : emit('login')"
      >
        {{ logged ? '查看个人档案' : '登录以保存进度' }}
        <font-awesome-icon icon="arrow-right" />
      </button>
    </aside>
  </section>
</template>
