<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchPublicSettings } from '../lib/api'
import { register } from '../lib/session'

const router = useRouter()
const username = ref('')
const password = ref('')
const confirm = ref('')
const invite = ref('')
const error = ref('')
const busy = ref(false)
const invNeeded = ref(false)

onMounted(async () => {
  const s = await fetchPublicSettings().catch(() => null)
  invNeeded.value = Boolean(s?.inv_needed)
})

const onSubmit = async () => {
  error.value = ''
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  busy.value = true
  try {
    await register(username.value, password.value, invite.value || undefined)
    router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '注册失败'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex justify-center pb-24 pt-20">
    <form class="card relative w-full max-w-[420px] border border-line bg-card px-7 py-6" @submit.prevent="onSubmit">
      <div class="mb-1 font-mono text-[10px] tracking-[0.2em] text-ink-soft">// ARKOJ.AUTH · NEW</div>
      <h1 class="mb-6 text-[30px] font-black tracking-[-0.01em]">
        注册<span class="grad-text">账号</span>
      </h1>

      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">USERNAME 用户名（3-16 位）</label>
      <input
        v-model="username"
        class="mb-4 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
        placeholder="new_competitor"
      />
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">PASSWORD 密码（≥6 位）</label>
      <input
        v-model="password"
        type="password"
        class="mb-4 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
      />
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">CONFIRM 确认密码</label>
      <input
        v-model="confirm"
        type="password"
        class="mb-5 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
      />
      <template v-if="invNeeded">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">INVITE 邀请码</label>
        <input
          v-model="invite"
          class="mb-5 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep"
        />
      </template>

      <div v-if="error" class="mb-4 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">
        [!] {{ error }}
      </div>

      <button class="btn-dark w-full text-center" :disabled="busy">
        {{ busy ? '创建中' : '注册并登录' }} <i class="fa-solid fa-user-plus ml-1.5" />
      </button>

      <div class="mt-5 text-right font-mono text-[10px] text-ink-faint">
        <router-link to="/login" class="mono-link">已有账号？登录 →</router-link>
      </div>
    </form>
  </section>
</template>
