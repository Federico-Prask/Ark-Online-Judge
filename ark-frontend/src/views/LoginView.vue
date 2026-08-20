<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { clearToken } from '../lib/api'
import { login } from '../lib/session'

const router = useRouter()
const route = useRoute()
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

onMounted(() => {
  // #/login?fresh=1 ：强制清掉本地会话，干净登录
  if (route.query.fresh) clearToken()
})

const onSubmit = async () => {
  error.value = ''
  busy.value = true
  try {
    await login(username.value, password.value)
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex justify-center pb-24 pt-20">
    <form class="card relative w-full max-w-[420px] border border-line bg-card px-7 py-6" @submit.prevent="onSubmit">
      <div class="mb-1 font-mono text-[10px] tracking-[0.2em] text-ink-soft">// ARKOJ.AUTH</div>
      <h1 class="mb-6 text-[30px] font-black tracking-[-0.01em]">
        登录<span class="grad-text">ArkOJ</span>
      </h1>

      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">USERNAME 用户名</label>
      <input
        v-model="username"
        class="mb-4 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
        placeholder="admin"
      />
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">PASSWORD 密码</label>
      <input
        v-model="password"
        type="password"
        class="mb-5 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
        placeholder="••••••••"
      />

      <div v-if="error" class="mb-4 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">
        [!] {{ error }}
      </div>

      <button class="btn-dark w-full text-center" :disabled="busy">
        {{ busy ? '验证中' : '登录' }} <i :class="busy ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-right-to-bracket'" class="ml-1.5" />
      </button>

      <div class="mt-5 flex items-center justify-between font-mono text-[10px] text-ink-faint">
        <span>// 演示账号 admin / admin123</span>
        <router-link to="/register" class="mono-link">注册 →</router-link>
      </div>
    </form>
  </section>
</template>
