<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, setStoredToken, type User } from './api'
import HomePage from './pages/HomePage.vue'
import ProblemsPage from './pages/ProblemsPage.vue'
import ProblemDetailPage from './pages/ProblemDetailPage.vue'
import ListsPage from './pages/ListsPage.vue'
import ListDetailPage from './pages/ListDetailPage.vue'
import ContestsPage from './pages/ContestsPage.vue'
import ContestDetailPage from './pages/ContestDetailPage.vue'
import RankPage from './pages/RankPage.vue'
import UserPage from './pages/UserPage.vue'
import DiscussPage from './pages/DiscussPage.vue'

// --- authentication state (backed by server/) ---
const user = ref<User | null>(null)
const authBusy = ref(false)
const showAuth = ref(false)
const authMode = ref<'login' | 'register'>('login')
const authUsername = ref('')
const authPassword = ref('')
const authError = ref('')
const userMenu = ref(false)
const logged = computed(() => user.value !== null)
const displayName = computed(() => {
  const n = user.value?.nickname || user.value?.username || ''
  return n.toUpperCase()
})
const userRoleLabel = computed(() =>
  user.value ? `ROLE / ${user.value.role.toUpperCase()}` : 'LOGIN REQUIRED',
)

async function submitAuth() {
  authError.value = ''
  authBusy.value = true
  try {
    const res =
      authMode.value === 'login'
        ? await api.login(authUsername.value, authPassword.value)
        : await api.register(authUsername.value, authPassword.value)
    // Persist token immediately (memory + localStorage) before any later call.
    if (res.token) setStoredToken(res.token)
    user.value = res.user
    showAuth.value = false
    authUsername.value = ''
    authPassword.value = ''
    userMenu.value = false
  } catch (e) {
    authError.value = e instanceof Error ? e.message : String(e)
  } finally {
    authBusy.value = false
  }
}
function openAuth(mode: 'login' | 'register' = 'login') {
  authMode.value = mode
  authError.value = ''
  showAuth.value = true
  userMenu.value = false
}
function switchMode(mode: 'login' | 'register') {
  authMode.value = mode
  authError.value = ''
}
function closeAuth() {
  if (!authBusy.value) showAuth.value = false
}
function onUserClick() {
  if (logged.value) userMenu.value = !userMenu.value
  else openAuth('login')
}
async function logout() {
  userMenu.value = false
  try {
    await api.logout()
  } catch {
    /* server unreachable: still drop the local session */
    setStoredToken(null)
  }
  user.value = null
}

// --- profile editing (PUT /api/auth/profile) ---
const showProfile = ref(false)
const profileBusy = ref(false)
const profileError = ref('')
const profileNickname = ref('')
const profileAvatar = ref('')
const profileBio = ref('')

function openProfile() {
  profileError.value = ''
  profileNickname.value = user.value?.nickname || user.value?.username || ''
  profileAvatar.value = user.value?.avatar || ''
  profileBio.value = user.value?.bio || ''
  showProfile.value = true
  userMenu.value = false
}
function closeProfile() {
  if (!profileBusy.value) showProfile.value = false
}
async function saveProfile() {
  profileError.value = ''
  profileBusy.value = true
  try {
    user.value = await api.updateProfile({
      nickname: profileNickname.value,
      avatar: profileAvatar.value,
      bio: profileBio.value,
    })
    showProfile.value = false
  } catch (e) {
    profileError.value = e instanceof Error ? e.message : String(e)
  } finally {
    profileBusy.value = false
  }
}

onMounted(async () => {
  try {
    user.value = await api.me()
  } catch {
    /* guest access */
  }
  // live clock
  window.setInterval(() => {
    clock.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  }, 1000)
})

const darkMode = ref(false)
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('ark_dark')
  if (saved === 'true') darkMode.value = true
}
watch(darkMode, (val) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ark_dark', val ? 'true' : 'false')
    document.documentElement.classList.toggle('dark-mode', val)
  }
})

const currentHour = new Date().getHours()
const greeting = computed(() =>
  currentHour >= 23 || currentHour < 5
    ? '夜深了'
    : currentHour < 12
      ? '早上好'
      : currentHour < 14
        ? '中午好'
        : currentHour < 18
          ? '下午好'
          : '晚上好',
)

const clock = ref(new Date().toLocaleTimeString('zh-CN', { hour12: false }))

// --- simple client-side routing ---
type NavKey = '首页' | '题库' | '题单' | '竞赛' | '排名' | '讨论'
const nav: NavKey[] = ['首页', '题库', '题单', '竞赛', '排名', '讨论']

type Route =
  | { name: '首页' }
  | { name: '题库' }
  | { name: '题目'; code: string; contestId?: number | null }
  | { name: '题单' }
  | { name: '题单详情'; id: number }
  | { name: '竞赛' }
  | { name: '比赛'; id: number }
  | { name: '排名' }
  | { name: '讨论'; focusId?: number | null }
  | { name: '用户'; username: string }

const route = ref<Route>({ name: '首页' })

const activeNav = computed<NavKey | ''>(() => {
  const n = route.value.name
  if (n === '题目') return '题库'
  if (n === '题单详情') return '题单'
  if (n === '比赛') return '竞赛'
  if (n === '用户') return ''
  return n as NavKey
})

function goNav(item: NavKey) {
  route.value = { name: item }
  userMenu.value = false
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function navigate(page: string, payload: Record<string, unknown> = {}) {
  userMenu.value = false
  switch (page) {
    case '首页':
      route.value = { name: '首页' }
      break
    case '题库':
      route.value = { name: '题库' }
      break
    case '题目':
      route.value = {
        name: '题目',
        code: String(payload.code || ''),
        contestId: (payload.contestId as number) || null,
      }
      break
    case '题单':
      route.value = { name: '题单' }
      break
    case '题单详情':
      route.value = { name: '题单详情', id: Number(payload.id) }
      break
    case '竞赛':
      route.value = { name: '竞赛' }
      break
    case '比赛':
      route.value = { name: '比赛', id: Number(payload.id) }
      break
    case '排名':
      route.value = { name: '排名' }
      break
    case '讨论':
      route.value = { name: '讨论', focusId: (payload.id as number) || null }
      break
    case '用户':
      route.value = { name: '用户', username: String(payload.username || '') }
      break
    default:
      route.value = { name: '首页' }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goMyProfile() {
  if (user.value) navigate('用户', { username: user.value.username })
  userMenu.value = false
}

const cornerNote = computed(() => {
  const n = route.value.name
  if (n === '题库' || n === '题目') return '[ PROBLEM SET ]'
  if (n === '题单' || n === '题单详情') return '[ LISTS ]'
  if (n === '竞赛' || n === '比赛') return '[ CONTESTS ]'
  if (n === '排名') return '[ RANKING ]'
  if (n === '讨论') return '[ FORUM ]'
  if (n === '用户') return '[ PROFILE ]'
  return '[ 限时活动 ]'
})
</script>

<template>
  <div class="terminal" :class="{ 'dark-mode': darkMode }">
    <header class="top">
      <div class="brand clickable" @click="goNav('首页')">
        <span class="brand-symbol">A</span>
        <div><b>ArkOJ</b><small>ALGORITHM OPERATING SYSTEM</small></div>
      </div>
      <nav>
        <button
          v-for="(item, idx) in nav"
          :key="item"
          :class="{ sel: activeNav === item }"
          @click="goNav(item)"
        >
          {{ item }} <sup>0{{ idx + 1 }}</sup>
        </button>
      </nav>
      <div class="top-right">
        <button
          class="theme-toggle"
          @click="darkMode = !darkMode"
          :title="darkMode ? '切换浅色模式' : '切换深色模式'"
        >
          <font-awesome-icon :icon="darkMode ? 'sun' : 'moon'" />
        </button>
        <span class="online"><i></i> SYSTEM NOMINAL</span>
        <span class="clock">{{ clock }}</span>
        <div class="user-area">
          <button class="user-button" @click="onUserClick">
            <font-awesome-icon icon="user" /> {{ logged ? displayName : '登录' }}
          </button>
          <div v-if="userMenu" class="user-menu">
            <b>{{ displayName }}</b>
            <small>{{ userRoleLabel }}</small>
            <button @click="goMyProfile">
              个人主页 <font-awesome-icon icon="user" />
            </button>
            <button @click="openProfile">
              编辑资料 <font-awesome-icon icon="user" />
            </button>
            <button @click="logout">
              退出登录 <font-awesome-icon icon="arrow-right" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <div class="viewport-frame">
      <span class="frame tl"></span><span class="frame tr"></span><span class="frame bl"></span
      ><span class="frame br"></span>
      <!-- Decorative corner labels live in the reserved strips, outside .viewport-body -->
      <div class="corner-notes" aria-hidden="true">
        <span class="corner-note tl">// RECOMPOSURE</span>
        <span class="corner-note tr">{{ cornerNote }}</span>
        <span class="corner-note bl">01</span>
        <span class="corner-note br">COORD 39°54′18″N</span>
      </div>

      <div class="viewport-body">
        <HomePage
          v-if="route.name === '首页'"
          :user="user"
          :greeting="greeting"
          @navigate="navigate"
          @login="openAuth('login')"
        />
        <ProblemsPage v-else-if="route.name === '题库'" @navigate="navigate" />
        <ProblemDetailPage
          v-else-if="route.name === '题目'"
          :code="route.code"
          :user="user"
          :contest-id="route.contestId"
          @navigate="navigate"
          @login="openAuth('login')"
        />
        <ListsPage
          v-else-if="route.name === '题单'"
          :user="user"
          @navigate="navigate"
          @login="openAuth('login')"
        />
        <ListDetailPage
          v-else-if="route.name === '题单详情'"
          :id="route.id"
          :user="user"
          @navigate="navigate"
        />
        <ContestsPage v-else-if="route.name === '竞赛'" @navigate="navigate" />
        <ContestDetailPage
          v-else-if="route.name === '比赛'"
          :id="route.id"
          :user="user"
          @navigate="navigate"
          @login="openAuth('login')"
        />
        <RankPage v-else-if="route.name === '排名'" @navigate="navigate" />
        <DiscussPage
          v-else-if="route.name === '讨论'"
          :user="user"
          :focus-id="route.focusId"
          @navigate="navigate"
          @login="openAuth('login')"
        />
        <UserPage
          v-else-if="route.name === '用户'"
          :username="route.username"
          :user="user"
          @navigate="navigate"
          @edit-profile="openProfile"
        />
      </div>
    </div>

    <footer>
      <span>ArkOJ // ONLINE JUDGE</span
      ><span><b class="signal"></b> ALL SYSTEMS NOMINAL</span
      ><span>© 2026 ARK LABS · v0.2.0</span>
    </footer>

    <div v-if="showAuth" class="auth-overlay" @click.self="closeAuth">
      <div class="auth-modal">
        <div class="auth-head">
          <small>// ACCESS GATE</small>
          <h2>{{ authMode === 'login' ? '登录' : '注册' }}</h2>
          <button class="auth-close" @click="closeAuth" :disabled="authBusy">×</button>
        </div>
        <div class="auth-tabs">
          <button :class="{ sel: authMode === 'login' }" @click="switchMode('login')">
            LOGIN / 登录</button
          ><button :class="{ sel: authMode === 'register' }" @click="switchMode('register')">
            REGISTER / 注册
          </button>
        </div>
        <form @submit.prevent="submitAuth">
          <label class="auth-field"
            ><small>USERNAME / 用户名</small
            ><input
              v-model.trim="authUsername"
              placeholder="3-32 位字母、数字或下划线"
              autocomplete="username"
              :disabled="authBusy"
          /></label>
          <label class="auth-field"
            ><small>PASSWORD / 密码</small
            ><input
              v-model="authPassword"
              type="password"
              :placeholder="authMode === 'login' ? '输入密码' : '至少 6 位密码'"
              autocomplete="current-password"
              :disabled="authBusy"
          /></label>
          <p v-if="authMode === 'register'" class="auth-hint">
            注册成功后自动登录，默认角色 USER。
          </p>
          <p v-if="authError" class="auth-error">{{ authError }}</p>
          <button class="auth-submit" type="submit" :disabled="authBusy">
            {{ authBusy ? '处理中…' : authMode === 'login' ? '进入系统' : '创建账号' }}
            <font-awesome-icon icon="arrow-right" />
          </button>
        </form>
        <p class="auth-foot">DEFAULT ROOT / admin · admin123</p>
      </div>
    </div>

    <div v-if="showProfile" class="auth-overlay" @click.self="closeProfile">
      <div class="auth-modal">
        <div class="auth-head">
          <small>// USER PROFILE</small>
          <h2>编辑资料</h2>
          <button class="auth-close" @click="closeProfile" :disabled="profileBusy">×</button>
        </div>
        <form @submit.prevent="saveProfile">
          <label class="auth-field"
            ><small>NICKNAME / 昵称</small
            ><input
              v-model.trim="profileNickname"
              maxlength="32"
              placeholder="展示昵称（默认与用户名一致）"
              :disabled="profileBusy"
          /></label>
          <label class="auth-field"
            ><small>AVATAR URL / 头像地址</small
            ><input
              v-model.trim="profileAvatar"
              maxlength="500"
              placeholder="https://…（可留空）"
              :disabled="profileBusy"
          /></label>
          <label class="auth-field"
            ><small>BIO / 简介</small
            ><input
              v-model.trim="profileBio"
              maxlength="200"
              placeholder="一句话介绍自己（可留空）"
              :disabled="profileBusy"
          /></label>
          <p v-if="profileError" class="auth-error">{{ profileError }}</p>
          <button class="auth-submit" type="submit" :disabled="profileBusy">
            {{ profileBusy ? '保存中…' : '保存修改' }}
            <font-awesome-icon icon="arrow-right" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
