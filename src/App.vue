<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { api, type User } from './api'
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
// raw nickname (not uppercased) for the hero heading, e.g. "晚上好 / ArkOJ"
const userName = computed(() => user.value?.nickname || user.value?.username || '')
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
// Always a real avatar image: the user's picture when set, otherwise an
// auto-generated initial avatar (SVG data URL) so every avatar spot renders
// an <img> instead of an icon placeholder.
const avatarSrc = computed(() => {
  if (user.value?.avatar) return user.value.avatar
  const ch = (user.value?.nickname || user.value?.username || '?').charAt(0).toUpperCase()
  const safe = ch
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">` +
    `<rect width="160" height="160" fill="#151a1e"/>` +
    `<rect x="5" y="5" width="150" height="150" fill="none" stroke="#354049" stroke-width="2"/>` +
    `<text x="80" y="112" font-family="monospace" font-size="76" font-weight="800" fill="#9dc1f1" text-anchor="middle">${safe}</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
})
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
})
const darkMode = ref(false)
// restore persisted theme if any
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('ark_dark')
  if (saved === 'true') darkMode.value = true
}
// persist changes and keep <html> in sync: index.html pre-applies the class
// to documentElement to avoid a flash, so it must be toggled back here too,
// otherwise dark.css descendant rules keep matching via the <html> ancestor
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
const active = ref('首页')
const nav = ['首页', '题库', '竞赛', '排名', '讨论']
// fake system latency shown on the hero plate, randomized per page load
const readyMs = ref(1 + Math.floor(Math.random() * 150))
const difficultyClass = (tag: string) =>
  tag === '入门' ? 'easy' : tag === '困难' ? 'hard' : 'medium'
const query = ref('')
const problems = [
  {
    id: 'A001',
    title: 'A+B Problem',
    sub: '基础运算 / BASIC OPERATION',
    tag: '入门',
    rate: '98.7%',
  },
  {
    id: 'A017',
    title: '不稳定的排序系统',
    sub: '排序 · 数据结构 / SORTING',
    tag: '进阶',
    rate: '74.2%',
  },
  {
    id: 'B204',
    title: '轨道网络的最短路径',
    sub: '图论 · 最短路 / GRAPH',
    tag: '困难',
    rate: '42.8%',
  },
]
const filtered = computed(() =>
  problems.filter(
    (p) =>
      !query.value || `${p.id}${p.title}${p.sub}`.toLowerCase().includes(query.value.toLowerCase()),
  ),
)
</script>
<template>
  <div class="terminal" :class="{ 'dark-mode': darkMode }">
    <header class="top">
      <div class="brand">
        <span class="brand-symbol">A</span>
        <div><b>ArkOJ</b><small>ALGORITHM OPERATING SYSTEM</small></div>
      </div>
      <nav>
        <button
          v-for="item in nav"
          :key="item"
          :class="{ sel: active === item }"
          @click="active = item"
        >
          {{ item }} <sup>0{{ nav.indexOf(item) + 1 }}</sup>
        </button>
      </nav>
      <div class="top-right">
        <button
          class="theme-toggle"
          @click="darkMode = !darkMode"
          :title="darkMode ? '切换浅色模式' : '切换深色模式'"
        >
          <font-awesome-icon :icon="darkMode ? 'sun' : 'moon'" /></button
        ><span class="online"><i></i> SYSTEM NOMINAL</span
        ><span class="clock">{{ new Date().toLocaleTimeString('zh-CN', { hour12: false }) }}</span>
        <div class="user-area">
          <button class="user-button" @click="onUserClick">
            <font-awesome-icon icon="user" /> {{ logged ? displayName : '登录' }}
          </button>
          <div v-if="userMenu" class="user-menu">
            <b>{{ displayName }}</b
            ><small>{{ userRoleLabel }}</small
            ><button @click="openProfile">编辑资料 <font-awesome-icon icon="user" /></button
            ><button @click="logout">退出登录 <font-awesome-icon icon="arrow-right" /></button>
          </div>
        </div>
      </div>
    </header>
    <div class="viewport-frame">
      <span class="frame tl"></span><span class="frame tr"></span><span class="frame bl"></span
      ><span class="frame br"></span>
      <div class="corner-notes" aria-hidden="true">
        <span class="corner-note tl">// RECOMPOSURE</span>
        <span class="corner-note tr">[ 限时活动 ]</span>
        <span class="corner-note bl">01</span>
        <span class="corner-note br">COORD 39°54′18″N</span>
      </div>
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
            <button class="action-main">开始训练 <font-awesome-icon icon="arrow-right" /></button
            ><button class="action-secondary">查看竞赛日历</button>
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
          <span>V///A <b>■■■■■■■□□□</b></span
          ><span>RESPONSE / 24ms</span><span>BUILD 0.1.0</span>
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
        <div class="command-item">
          <font-awesome-icon icon="list-check" />
          <div><small>CONTINUE TRAINING</small><b>继续训练</b></div>
          <strong>12<span>/20</span></strong
          ><font-awesome-icon icon="arrow-right" class="arrow" />
        </div>
        <div class="command-item contest">
          <font-awesome-icon icon="flag" />
          <div><small>NEXT CONTEST · 42</small><b>全面测试</b></div>
          <strong>06:18:42</strong><font-awesome-icon icon="arrow-right" class="arrow" />
        </div>
      </section>
      <section class="lower">
        <div class="problem-panel">
          <div class="section-head">
            <div>
              <small>// RECOMMENDED PROBLEMS</small>
              <h2>推荐题目</h2>
            </div>
            <div class="search">
              <font-awesome-icon icon="magnifying-glass" /><input
                v-model="query"
                placeholder="搜索题目 / 编号 / 知识点"
              />
            </div>
          </div>
          <div class="problem" v-for="p in filtered" :key="p.id">
            <span class="problem-id">{{ p.id }}</span>
            <div class="problem-name">
              <b>{{ p.title }}</b
              ><small>{{ p.sub }}</small>
            </div>
            <span class="difficulty" :class="difficultyClass(p.tag)">{{ p.tag }}</span
            ><span class="accept-rate">{{ p.rate }}<small>ACCEPTED</small></span
            ><font-awesome-icon icon="arrow-right" class="arrow" />
          </div>
          <button class="all-problems">
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
          <div class="status-bar"><span></span></div>
          <div class="status-text">
            <span>本周完成</span><b>{{ logged ? '12 / 20' : '— / —' }}</b>
          </div>
          <button class="save" @click="onUserClick">
            {{ logged ? '查看个人档案' : '登录以保存进度' }}
            <font-awesome-icon icon="arrow-right" />
          </button>
        </aside>
      </section>
    </div>
    <footer>
      <span>ArkOJ // ONLINE JUDGE</span><span><b class="signal"></b> ALL SYSTEMS NOMINAL</span
      ><span>© 2024 ARK LABS · v0.1.0</span>
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
