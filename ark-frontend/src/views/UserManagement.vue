<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { adminDeleteUser, adminPatchUser, adminUsers, fetchAdminSettings, patchAdminSettings, type SiteSettings, type UserProfile } from '../lib/api'
import { logout, me, restoreSession } from '../lib/session'
import { ADMIN_PERMS, DEFAULT_PERMS, PERM_META, type PermKey } from '../lib/perms'

const router = useRouter()
const users = ref<UserProfile[]>([])
const error = ref('')
const loading = ref(true)

const canUserPerms = computed(() => !!me.value?.perms.includes('user_perms'))
const canAdminAdmin = computed(() => !!me.value?.perms.includes('admin_admin'))

// ---------------- 站点设置 ----------------
const settings = ref<SiteSettings | null>(null)
const settingsMsg = ref('')
const saveSettings = async () => {
  if (!settings.value) return
  settingsMsg.value = ''
  try {
    settings.value = await patchAdminSettings(settings.value)
    settingsMsg.value = '✓ 已保存'
  } catch (e) {
    settingsMsg.value = e instanceof Error ? e.message : '保存失败'
  }
}

onMounted(async () => {
  // 先刷新会话，避免跨后端世代的陈旧 me
  await restoreSession()
  if (canUserPerms.value) settings.value = await fetchAdminSettings().catch(() => null)
  if (!canUserPerms.value) {
    router.replace('/')
    return
  }
  try {
    users.value = await adminUsers()
  } catch (e) {
    const msg = e instanceof Error ? e.message : '加载失败'
    error.value = /403|权限/.test(msg) ? `${msg} —— 会话可能已失效，点击此处重新登录` : msg
  } finally {
    loading.value = false
  }
})

const relogin = () => {
  logout()
  // 整页跳转兜底：任何 HMR/路由怪状态下都能回到登录页
  window.location.hash = '#/login'
  router.push('/login')
}

/** 当前登录者能否编辑目标用户的某权限 */
const canEdit = (target: UserProfile, perm: PermKey) => {
  if (!canUserPerms.value) return false
  if (target.name === me.value?.name) return false // 不能改自己
  if ((ADMIN_PERMS as readonly string[]).includes(perm) && !canAdminAdmin.value) return false
  return true
}

const togglePerm = async (target: UserProfile, perm: PermKey) => {
  if (!canEdit(target, perm)) return
  error.value = ''
  const has = target.perms.includes(perm)
  const perms = has ? target.perms.filter((p) => p !== perm) : [...target.perms, perm]
  try {
    const updated = await adminPatchUser(target.name, { perms })
    users.value = users.value.map((u) => (u.name === updated.name ? updated : u))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败'
  }
}

const setRole = async (target: UserProfile, role: 'admin' | 'user') => {
  if (!canAdminAdmin.value || target.name === me.value?.name) return
  error.value = ''
  try {
    const updated = await adminPatchUser(target.name, { role })
    users.value = users.value.map((u) => (u.name === updated.name ? updated : u))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败'
  }
}

// ---------------- 搜索 ----------------
const q = ref('')
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return users.value
  return users.value.filter((u) => u.name.toLowerCase().includes(s) || String(u.uid).includes(s))
})

// ---------------- 删除（两次点击确认） ----------------
const confirmDel = ref('')
let delTimer = 0
const canDelete = (u: UserProfile) => {
  if (!canUserPerms.value || u.name === me.value?.name) return false
  const priv = u.role === 'admin' || u.perms.includes('admin_admin')
  return !priv || canAdminAdmin.value
}
const askDelete = (name: string) => {
  if (!canDelete(users.value.find((u) => u.name === name)!)) return
  if (confirmDel.value === name) {
    void doDelete(name)
  } else {
    confirmDel.value = name
    window.clearTimeout(delTimer)
    delTimer = window.setTimeout(() => (confirmDel.value = ''), 3000)
  }
}
const doDelete = async (name: string) => {
  error.value = ''
  try {
    await adminDeleteUser(name)
    users.value = users.value.filter((x) => x.name !== name)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  } finally {
    confirmDel.value = ''
  }
}
</script>

<template>
  <section class="mx-auto max-w-[1080px] pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ 用户管理 ]</span>
      <span>USER.MANAGEMENT · {{ users.length }} USERS</span>
    </div>
    <h1 class="mb-3 text-[clamp(28px,3.6vw,44px)] font-black tracking-[-0.015em]">
      用户<span class="grad-text">权限</span>
    </h1>
    <p class="mb-6 font-mono text-[9px] leading-relaxed tracking-[0.14em] text-ink-faint">
      // 默认可移除：进入 OJ · 发表讨论 ｜ 可授予：管理题目 · 管理比赛 · 管理用户权限 · 管理用户管理员权限
    </p>

    <div class="mb-5 flex items-center gap-3">
      <label class="flex items-center gap-2 border border-line bg-card px-3 py-2">
        <i class="fa-solid fa-magnifying-glass text-[11px] text-ink-faint" />
        <input
          v-model="q"
          placeholder="搜索 用户名 / UID"
          class="w-48 bg-transparent font-mono text-[11px] tracking-[0.06em] text-ink outline-none placeholder:text-ink-faint"
        />
      </label>
      <span class="font-mono text-[9px] tracking-[0.16em] text-ink-faint">
        {{ filtered.length }} / {{ users.length }} SHOWN
      </span>
    </div>

    <div
      v-if="error"
      class="mb-4 flex cursor-pointer items-center justify-between border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red"
      title="点击重新登录"
      @click="relogin"
    >
      <span>[!] {{ error }}</span>
      <span class="mono-link">重新登录 →</span>
    </div>

    <div v-if="loading" class="card relative border border-line bg-card px-5 py-10 text-center font-mono text-[10px] tracking-[0.24em] text-ink-faint">
      <i class="fa-solid fa-circle-notch fa-spin mr-2" />LOADING USERS…
    </div>

    <section v-else class="card relative border border-line bg-card">
      <header class="hidden grid-cols-[70px_1fr_100px_100px_1fr_1fr_90px] gap-3 border-b border-line-soft px-5 py-2.5 font-mono text-[9px] tracking-[0.18em] text-ink-faint md:grid">
        <span>UID</span><span>用户 / USER</span><span>注册</span><span>角色</span><span>默认权限（可移除）</span><span>管理权限（可授予）</span><span>操作</span>
      </header>

      <div
        v-for="u in filtered"
        :key="u.uid"
        class="grid grid-cols-1 gap-3 border-b border-dashed border-line-soft px-5 py-4 last:border-b-0 md:grid-cols-[70px_1fr_100px_100px_1fr_1fr_90px] md:items-center"
      >
        <span class="font-mono text-[10.5px] text-ink-faint">{{ u.uid }}</span>
        <span class="flex items-center gap-2">
          <router-link :to="`/user/${u.name}`" class="text-[13px] font-bold text-ink no-underline hover:text-accent-deep">{{ u.name }}</router-link>
          <span v-if="u.name === me?.name" class="font-mono text-[8px] tracking-[0.14em] text-accent-deep">（你）</span>
        </span>
        <span class="font-mono text-[10px] text-ink-faint">{{ u.reg }}</span>

        <!-- 角色 -->
        <span>
          <select
            v-if="canAdminAdmin && u.name !== me?.name"
            :value="u.role"
            class="cursor-pointer border border-line bg-card px-2 py-1 font-mono text-[10px] text-ink outline-none"
            @change="setRole(u, ($event.target as HTMLSelectElement).value as 'admin' | 'user')"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <span v-else class="chip" :class="u.role === 'admin' ? 'chip-wa' : 'chip-idle'">{{ u.role }}</span>
        </span>

        <!-- 默认权限 -->
        <span class="flex flex-wrap gap-1.5">
          <button
            v-for="p in DEFAULT_PERMS"
            :key="p"
            class="chip"
            :class="[u.perms.includes(p) ? 'chip-ac' : 'chip-idle opacity-50', !canEdit(u, p) && 'cursor-not-allowed']"
            :disabled="!canEdit(u, p)"
            :title="canEdit(u, p) ? '点击切换' : u.name === me?.name ? '不能修改自己的权限' : '无权限'"
            @click="togglePerm(u, p)"
          >
            {{ PERM_META[p].zh }}
          </button>
        </span>

        <!-- 管理权限 -->
        <span class="flex flex-wrap gap-1.5">
          <button
            v-for="p in ADMIN_PERMS"
            :key="p"
            class="chip"
            :class="[u.perms.includes(p) ? 'chip-live' : 'chip-idle opacity-50', !canEdit(u, p) && 'cursor-not-allowed']"
            :disabled="!canEdit(u, p)"
            :title="canEdit(u, p) ? '点击切换' : u.name === me?.name ? '不能修改自己的权限' : '需要 admin_admin 权限'"
            @click="togglePerm(u, p)"
          >
            {{ PERM_META[p].zh }}
          </button>
        </span>

        <!-- 操作：删除（两次点击确认） -->
        <span>
          <button
            v-if="u.name !== me?.name"
            class="chip cursor-pointer"
            :class="confirmDel === u.name ? 'chip-wa' : 'chip-idle'"
            :disabled="!canDelete(u)"
            :title="canDelete(u) ? (confirmDel === u.name ? '再点一次确认删除' : '删除用户') : '无权限'"
            @click="askDelete(u.name)"
          >
            {{ confirmDel === u.name ? '确认删除?' : '删除' }}
          </button>
          <span v-else class="chip chip-idle opacity-50">—</span>
        </span>
      </div>

      <div v-if="filtered.length === 0" class="px-5 py-10 text-center font-mono text-[10px] tracking-[0.2em] text-ink-faint">
        // NO MATCH — 换个关键词
      </div>
    </section>

    <!-- 站点设置 -->
    <section v-if="settings" class="card relative mt-8 border border-line bg-card px-6 py-5">
      <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[13px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span> 站点设置 <span class="font-mono font-normal text-accent-deep">]</span>
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">SITE.SETTINGS</span>
      </h2>
      <label class="flex cursor-pointer items-center gap-2 py-1.5 font-mono text-[11px] text-ink">
        <input v-model="settings.new_access" type="checkbox" class="accent-[#5E8FD4]" />
        new_access —— 新用户默认能够进入 OJ
      </label>
      <label class="flex cursor-pointer items-center gap-2 py-1.5 font-mono text-[11px] text-ink">
        <input v-model="settings.inv_needed" type="checkbox" class="accent-[#5E8FD4]" />
        inv_needed —— 注册需要邀请码
      </label>
      <div class="mt-2">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">inv_code —— 邀请码</label>
        <input v-model="settings.inv_code" class="w-full max-w-[320px] border border-line bg-paper px-3 py-2 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
      </div>
      <div class="mt-4 flex items-center gap-3">
        <button class="btn-dark" @click="saveSettings">保存设置 <i class="fa-solid fa-floppy-disk ml-1.5" /></button>
        <span class="font-mono text-[10px] text-signal-green">{{ settingsMsg }}</span>
      </div>
    </section>

    <p class="mt-4 font-mono text-[9px] tracking-[0.16em] text-ink-faint">
      // 角色或 admin_admin 的变更需要「管理用户管理员权限」；不能修改自己的权限
    </p>
  </section>
</template>
