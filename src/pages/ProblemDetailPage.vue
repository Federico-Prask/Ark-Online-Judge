<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { api, type ProblemDetail, type Submission, type User } from '../api'
import { difficultyClass, renderText, statusClass, formatTime } from '../utils'

const props = defineProps<{
  code: string
  user: User | null
  contestId?: number | null
}>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'login'): void
}>()

const problem = ref<ProblemDetail | null>(null)
const loading = ref(true)
const error = ref('')
const tab = ref<'desc' | 'submit' | 'subs'>('desc')

const language = ref('javascript')
const code = ref(
  `// 从全局变量 input (string) 读取输入，用 console.log 输出\n// 也可定义 main(input) / solve(input) 并 return 结果\nconst parts = input.trim().split(/\\s+/).map(Number)\nconst a = parts[0], b = parts[1]\nconsole.log(a + b)\n`,
)
const submitting = ref(false)
const submitError = ref('')
const lastSub = ref<Submission | null>(null)
const mySubs = ref<Submission[]>([])
let pollTimer: number | undefined

const languages = [
  { id: 'javascript', label: 'JavaScript (真实评测)' },
  { id: 'cpp', label: 'C++ (模拟)' },
  { id: 'python', label: 'Python (模拟)' },
  { id: 'java', label: 'Java (模拟)' },
  { id: 'go', label: 'Go (模拟)' },
  { id: 'rust', label: 'Rust (模拟)' },
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    problem.value = await api.problem(props.code)
    if (props.user) await loadSubs()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    problem.value = null
  } finally {
    loading.value = false
  }
}

async function loadSubs() {
  if (!problem.value) return
  try {
    const r = await api.submissions({
      problem_id: problem.value.id,
      username: props.user?.username,
      pageSize: 10,
    })
    mySubs.value = r.items
  } catch {
    mySubs.value = []
  }
}

watch(
  () => props.code,
  () => load(),
)
onMounted(load)
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})

async function doSubmit() {
  submitError.value = ''
  if (!props.user) {
    emit('login')
    return
  }
  if (!problem.value) return
  submitting.value = true
  try {
    const sub = await api.submit({
      problem_id: problem.value.id,
      language: language.value,
      code: code.value,
      contest_id: props.contestId || undefined,
    })
    lastSub.value = sub
    tab.value = 'subs'
    startPoll(sub.id)
    await loadSubs()
  } catch (e) {
    submitError.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}

function startPoll(id: number) {
  if (pollTimer) clearInterval(pollTimer)
  let n = 0
  pollTimer = window.setInterval(async () => {
    n++
    try {
      const s = await api.submission(id)
      lastSub.value = s
      mySubs.value = mySubs.value.map((x) => (x.id === s.id ? s : x))
      if (s.status !== 'Pending' && s.status !== 'Judging') {
        clearInterval(pollTimer)
        pollTimer = undefined
        // refresh problem AC mark
        load()
      }
    } catch {
      /* ignore */
    }
    if (n > 40) {
      clearInterval(pollTimer)
      pollTimer = undefined
    }
  }, 600)
}

const descHtml = computed(() => renderText(problem.value?.description || ''))
const inHtml = computed(() => renderText(problem.value?.input_format || ''))
const outHtml = computed(() => renderText(problem.value?.output_format || ''))
const hintHtml = computed(() => renderText(problem.value?.hint || ''))
</script>

<template>
  <section class="page-panel" v-if="loading">
    <div class="empty-hint">加载题目…</div>
  </section>
  <section class="page-panel" v-else-if="error">
    <div class="empty-hint error">{{ error }}</div>
    <button class="all-problems" @click="emit('navigate', '题库')">返回题库</button>
  </section>
  <section class="page-panel problem-detail" v-else-if="problem">
    <div class="page-head">
      <div>
        <small>// PROBLEM {{ problem.code }}</small>
        <h2>
          <span class="mono dim">{{ problem.code }}</span> {{ problem.title }}
        </h2>
        <div class="meta-row">
          <span class="difficulty" :class="difficultyClass(problem.difficulty)">{{
            problem.difficulty
          }}</span>
          <span class="chip">TL {{ problem.time_limit }} ms</span>
          <span class="chip">ML {{ problem.memory_limit }} MB</span>
          <span class="chip ac-text">{{ problem.ac_rate }}% AC</span>
          <span class="chip" v-for="t in problem.tags" :key="t">{{ t }}</span>
          <span class="chip" v-if="problem.solved === 'AC'">已通过</span>
        </div>
      </div>
      <div class="page-tools">
        <button class="ghost-btn" @click="emit('navigate', '题库')">← 题库</button>
        <button class="action-main compact" @click="tab = 'submit'">提交代码</button>
      </div>
    </div>

    <div class="tabs">
      <button :class="{ sel: tab === 'desc' }" @click="tab = 'desc'">题面</button>
      <button :class="{ sel: tab === 'submit' }" @click="tab = 'submit'">提交</button>
      <button :class="{ sel: tab === 'subs' }" @click="tab = 'subs'; loadSubs()">我的提交</button>
    </div>

    <div v-if="tab === 'desc'" class="prob-body">
      <div class="prob-section">
        <h3>题目描述</h3>
        <div class="md" v-html="descHtml"></div>
      </div>
      <div class="prob-section" v-if="problem.input_format">
        <h3>输入格式</h3>
        <div class="md" v-html="inHtml"></div>
      </div>
      <div class="prob-section" v-if="problem.output_format">
        <h3>输出格式</h3>
        <div class="md" v-html="outHtml"></div>
      </div>
      <div class="prob-section" v-for="(s, i) in problem.samples" :key="i">
        <h3>样例 {{ i + 1 }}</h3>
        <div class="sample-grid">
          <div>
            <small>INPUT</small>
            <pre>{{ s.input }}</pre>
          </div>
          <div>
            <small>OUTPUT</small>
            <pre>{{ s.output }}</pre>
          </div>
        </div>
      </div>
      <div class="prob-section" v-if="problem.hint">
        <h3>提示</h3>
        <div class="md" v-html="hintHtml"></div>
      </div>
      <div class="prob-section" v-if="problem.source">
        <h3>来源</h3>
        <p class="muted">{{ problem.source }}</p>
      </div>
    </div>

    <div v-else-if="tab === 'submit'" class="submit-pane">
      <div class="submit-bar">
        <label>
          <small>LANGUAGE</small>
          <select v-model="language" class="filter-select">
            <option v-for="l in languages" :key="l.id" :value="l.id">{{ l.label }}</option>
          </select>
        </label>
        <p class="hint-inline" v-if="language === 'javascript'">
          JS 使用真实沙箱评测：读 <code>input</code>，写 <code>console.log</code>。
        </p>
        <p class="hint-inline" v-else>其他语言当前为模拟评测（演示流程）。</p>
      </div>
      <textarea
        class="code-editor"
        v-model="code"
        spellcheck="false"
        :disabled="submitting"
        rows="18"
      ></textarea>
      <p v-if="submitError" class="auth-error">{{ submitError }}</p>
      <div class="submit-actions">
        <button class="action-main" :disabled="submitting" @click="doSubmit">
          {{ submitting ? '提交中…' : '提交评测' }}
          <font-awesome-icon icon="arrow-right" />
        </button>
        <div v-if="lastSub" class="last-verdict" :class="statusClass(lastSub.status)">
          #{{ lastSub.id }} · {{ lastSub.status }}
          <span v-if="lastSub.time_ms != null"> · {{ lastSub.time_ms }}ms</span>
        </div>
      </div>
    </div>

    <div v-else class="subs-pane">
      <div v-if="!user" class="empty-hint">登录后查看提交记录</div>
      <div v-else-if="!mySubs.length" class="empty-hint">暂无提交</div>
      <div class="table-wrap" v-else>
        <div class="table-head subs-grid">
          <span>ID</span>
          <span>状态</span>
          <span>语言</span>
          <span>耗时</span>
          <span>时间</span>
        </div>
        <div v-for="s in mySubs" :key="s.id" class="table-row subs-grid">
          <span class="mono">#{{ s.id }}</span>
          <span
            ><span class="verdict" :class="statusClass(s.status)">{{ s.status }}</span></span
          >
          <span class="mono">{{ s.language }}</span>
          <span class="mono">{{ s.time_ms != null ? s.time_ms + 'ms' : '—' }}</span>
          <span class="muted">{{ formatTime(s.created_at) }}</span>
        </div>
        <p v-if="lastSub?.detail" class="detail-box">{{ lastSub.detail }}</p>
      </div>
    </div>
  </section>
</template>
