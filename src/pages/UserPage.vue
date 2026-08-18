<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, type User, type UserProfile } from '../api'
import { difficultyClass, formatDate, formatTime, makeAvatar, statusClass } from '../utils'

const props = defineProps<{ username: string; user: User | null }>()
const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
  (e: 'edit-profile'): void
}>()

const profile = ref<UserProfile | null>(null)
const loading = ref(true)
const error = ref('')

const isSelf = computed(() => props.user?.username === props.username)
const avatarSrc = computed(() => makeAvatar(profile.value))

async function load() {
  loading.value = true
  error.value = ''
  try {
    profile.value = await api.user(props.username)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    profile.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.username, load)
</script>

<template>
  <section class="page-panel" v-if="loading"><div class="empty-hint">加载中…</div></section>
  <section class="page-panel" v-else-if="error">
    <div class="empty-hint error">{{ error }}</div>
  </section>
  <section class="page-panel profile-page" v-else-if="profile">
    <div class="profile-hero">
      <div class="profile-avatar">
        <img :src="avatarSrc" alt="avatar" />
      </div>
      <div class="profile-info">
        <small>// OPERATOR / {{ profile.role.toUpperCase() }}</small>
        <h2>{{ profile.nickname }}</h2>
        <p class="muted">@{{ profile.username }} · 加入于 {{ formatDate(profile.created_at) }}</p>
        <p class="bio" v-if="profile.bio">{{ profile.bio }}</p>
        <p class="bio muted" v-else>这个人很懒，还没有写简介。</p>
        <div class="meta-row">
          <span class="chip">Rank #{{ profile.stats.rank }}</span>
          <span class="chip ac-text">{{ profile.stats.solved }} 题</span>
          <span class="chip">{{ profile.stats.submitted }} 次提交</span>
          <span class="chip">AC率 {{ profile.stats.ac_rate }}%</span>
        </div>
        <button v-if="isSelf" class="ghost-btn" @click="emit('edit-profile')">编辑资料</button>
      </div>
      <div class="diff-bars">
        <small>// SOLVED BY DIFFICULTY</small>
        <div v-for="(n, k) in profile.stats.difficulty" :key="k" class="diff-row">
          <span class="difficulty" :class="difficultyClass(String(k))">{{ k }}</span>
          <div class="bar"><span :style="{ width: Math.min(100, n * 12) + '%' }"></span></div>
          <b class="mono">{{ n }}</b>
        </div>
      </div>
    </div>

    <div class="profile-grid">
      <div class="sub-panel">
        <div class="section-head">
          <div>
            <small>// RECENT AC</small>
            <h3>最近通过</h3>
          </div>
        </div>
        <div v-if="!profile.recent_solved.length" class="empty-hint">暂无</div>
        <div
          v-for="p in profile.recent_solved"
          :key="p.id"
          class="mini-row clickable"
          @click="emit('navigate', '题目', { code: p.code })"
        >
          <span class="mono">{{ p.code }}</span>
          <span class="grow">{{ p.title }}</span>
          <span class="difficulty" :class="difficultyClass(p.difficulty)">{{ p.difficulty }}</span>
        </div>
      </div>

      <div class="sub-panel">
        <div class="section-head">
          <div>
            <small>// SUBMISSIONS</small>
            <h3>最近提交</h3>
          </div>
        </div>
        <div v-if="!profile.recent_submissions.length" class="empty-hint">暂无</div>
        <div v-for="s in profile.recent_submissions" :key="s.id" class="mini-row">
          <span class="verdict" :class="statusClass(s.status)">{{ s.status }}</span>
          <span
            class="grow clickable"
            @click="emit('navigate', '题目', { code: s.problem_code })"
            >{{ s.problem_code }} {{ s.problem_title }}</span
          >
          <span class="muted mono">{{ formatTime(s.created_at) }}</span>
        </div>
      </div>

      <div class="sub-panel">
        <div class="section-head">
          <div>
            <small>// LISTS</small>
            <h3>题单</h3>
          </div>
        </div>
        <div v-if="!profile.lists.length" class="empty-hint">暂无</div>
        <div
          v-for="l in profile.lists"
          :key="l.id"
          class="mini-row clickable"
          @click="emit('navigate', '题单详情', { id: l.id })"
        >
          <span class="grow">{{ l.title }}</span>
          <span class="muted">{{ l.problem_count }} 题</span>
        </div>
      </div>

      <div class="sub-panel">
        <div class="section-head">
          <div>
            <small>// CONTESTS</small>
            <h3>参加过的比赛</h3>
          </div>
        </div>
        <div v-if="!profile.contests.length" class="empty-hint">暂无</div>
        <div
          v-for="c in profile.contests"
          :key="c.id"
          class="mini-row clickable"
          @click="emit('navigate', '比赛', { id: c.id })"
        >
          <span class="grow">{{ c.title }}</span>
          <span class="chip">{{ c.rule }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
