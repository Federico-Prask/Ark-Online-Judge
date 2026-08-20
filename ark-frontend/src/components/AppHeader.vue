<script setup lang="ts">
import { useRoute } from 'vue-router'
import { loggedIn, me, logout } from '../lib/session'
import { isDark, toggleTheme } from '../lib/theme'
import { useNarrow } from '../lib/useMedia'
import { byPrefixAndName } from '../lib/fa'

// 窄屏时图标按钮固定为正方形（aspect-ratio 在 flex 行中不生效，故用 TS 固定宽高）
const narrow = useNarrow()

const route = useRoute()
const navs = [
  { zh: '首页', icon: 'fa-solid fa-house', to: '/' },
  { zh: '题库', icon: 'fa-solid fa-database', to: '/problems' },
  { zh: '比赛', icon: 'fa-solid fa-flag', to: '/contests' },
  { zh: '提交', icon: 'fa-solid fa-code', to: '/submissions' },
  { zh: '排行', icon: 'fa-solid fa-ranking-star', to: '/rank' },
  { zh: '讨论', icon: 'fa-regular fa-comments', to: '/discuss' },
]
const extra: { zh: string; icon: string; to?: string }[] = []
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to === '/problems' ? '/problem' : to)
</script>

<template>
  <header class="flex items-center justify-between border-b border-line pt-10 pb-4">
    <div class="flex items-baseline gap-3">
      <span class="text-[20px] font-black tracking-[-0.02em]">
        ARK<span class="text-accent-deep">OJ</span>
      </span>
      <span class="max-xl:hidden font-mono text-[9px] tracking-[0.12em] text-ink-faint">
        // ONLINE JUDGE · v0.1.0
      </span>
    </div>

    <!-- 导航：窄屏仅图标 -->
    <nav class="hidden gap-8 text-[13px] tracking-[0.06em] md:flex max-xl:gap-5">
      <router-link
        v-for="n in navs"
        :key="n.zh"
        :to="n.to"
        class="relative whitespace-nowrap py-1 no-underline"
        :class="isActive(n.to) ? 'font-bold text-ink' : 'text-ink-soft hover:text-ink'"
        :title="n.zh"
      >
        <i :class="n.icon" class="mr-1.5 max-kilo:mr-0" /><span class="max-kilo:hidden">{{ n.zh }}</span>
        <span v-if="isActive(n.to)" class="absolute inset-x-0 -bottom-0.5 h-[3px] bg-accent" />
      </router-link>
      <a
        v-for="n in extra"
        :key="n.zh"
        href="#"
        class="relative whitespace-nowrap py-1 text-ink-soft no-underline hover:text-ink"
        :title="`${n.zh}（待建）`"
      >
        <i :class="n.icon" class="mr-1.5 max-kilo:mr-0" /><span class="max-kilo:hidden">{{ n.zh }}</span>
      </a>
    </nav>

    <div class="flex items-center gap-3 max-lg:gap-2">
      <button
        class="cursor-pointer whitespace-nowrap border border-dashed border-ink-faint bg-transparent px-2.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-ink-soft hover:border-ink hover:text-ink"
        :class="{ 'btn-square': narrow }"
        :title="isDark ? '切换到浅色' : '切换到深色'"
        @click="toggleTheme()"
      >
        <i :class="isDark ? 'fa-regular fa-sun' : 'fa-regular fa-moon'" class="mr-1 max-md:mr-0" /><span class="max-md:hidden">{{ isDark ? '浅色' : '深色' }}</span>
      </button>

      <template v-if="!loggedIn">
        <router-link to="/login" class="btn-base max-md:px-3" :class="{ 'btn-square': narrow }">
          <i class="fa-solid fa-right-to-bracket mr-1.5 max-md:mr-0" /><span class="max-md:hidden">登录</span>
        </router-link>
        <router-link to="/register" class="btn-dark" :class="{ 'btn-square': narrow }">
          <i class="fa-solid fa-user-plus mr-1.5 max-md:mr-0" /><span class="max-md:hidden">注册</span>
        </router-link>
      </template>
      <template v-else>
        <router-link :to="`/user/${me!.name}`" class="flex items-center gap-2 no-underline" :title="me!.name">
          <span class="h-2 w-2 bg-accent-deep" style="clip-path: polygon(100% 0, 100% 100%, 0 100%)" />
          <span class="max-md:hidden font-mono text-[11px] font-bold text-ink">{{ me!.name }}</span>
        </router-link>
        <!-- 用户权限管理：仅持有 user_perms 者可见（TS 控制显隐） -->
        <router-link
          v-if="me?.perms.includes('user_perms')"
          to="/admin/users"
          class="flex h-[30px] w-[30px] items-center justify-center border border-dashed border-ink-faint text-ink-soft no-underline hover:border-ink hover:text-ink"
          title="用户权限管理"
        >
          <FontAwesomeIcon :icon="byPrefixAndName.fas['users-gear']" class="text-[12px]" />
        </router-link>
        <router-link
          to="/settings"
          class="flex h-[30px] w-[30px] items-center justify-center border border-dashed border-ink-faint text-ink-soft no-underline hover:border-ink hover:text-ink"
          title="设置"
        >
          <i class="fa-solid fa-gear text-[11px]" />
        </router-link>
        <span class="mx-1 h-4 w-px bg-line" />
        <a
          href="#"
          class="flex h-[30px] w-[30px] items-center justify-center border border-dashed border-ink-faint text-ink-soft no-underline hover:border-signal-red hover:text-signal-red"
          title="登出"
          @click.prevent="logout()"
        >
          <i class="fa-solid fa-right-from-bracket text-[11px]" />
        </a>
      </template>
    </div>
  </header>
</template>
