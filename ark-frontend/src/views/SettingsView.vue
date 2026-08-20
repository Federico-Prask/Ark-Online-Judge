<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { changePass, patchMe } from '../lib/api'
import { loggedIn, me } from '../lib/session'

const router = useRouter()
const bio = ref('')
const email = ref('')
const school = ref('')
const oldPass = ref('')
const newPass = ref('')
const confirmPass = ref('')
const flash = ref('')
const err = ref('')
const flash2 = ref('')
const err2 = ref('')

onMounted(() => {
  if (!loggedIn.value) {
    router.replace('/login')
    return
  }
  bio.value = me.value?.bio ?? ''
  email.value = me.value?.email ?? ''
  school.value = me.value?.school ?? ''
})

const saveProfile = async () => {
  err.value = ''
  flash.value = ''
  try {
    me.value = await patchMe({ bio: bio.value, email: email.value, school: school.value })
    flash.value = '资料已保存'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '保存失败'
  }
}

const savePass = async () => {
  err2.value = ''
  flash2.value = ''
  if (newPass.value !== confirmPass.value) {
    err2.value = '两次输入的新密码不一致'
    return
  }
  try {
    await changePass(oldPass.value, newPass.value)
    flash2.value = '密码已更新'
    oldPass.value = newPass.value = confirmPass.value = ''
  } catch (e) {
    err2.value = e instanceof Error ? e.message : '修改失败'
  }
}
</script>

<template>
  <section class="mx-auto max-w-[720px] pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <span class="font-bold text-accent-deep">[ 设置 ]</span>
      <span>SETTINGS · {{ me?.name }}</span>
    </div>
    <h1 class="mb-8 text-[clamp(28px,3.6vw,44px)] font-black tracking-[-0.015em]">
      用户<span class="grad-text">设置</span>
    </h1>

    <!-- 资料 -->
    <form class="card relative mb-6 border border-line bg-card px-6 py-5" @submit.prevent="saveProfile">
      <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[13px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span> 个人资料 <span class="font-mono font-normal text-accent-deep">]</span>
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">PROFILE</span>
      </h2>
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">BIO 个人简介</label>
      <textarea
        v-model="bio"
        rows="3"
        maxlength="200"
        class="mb-4 w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none focus:border-accent-deep"
      />
      <div class="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">EMAIL 邮箱</label>
          <input v-model="email" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">SCHOOL 学校 / 组织</label>
          <input v-model="school" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
      </div>
      <div v-if="err" class="mb-3 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">[!] {{ err }}</div>
      <div v-if="flash" class="mb-3 border border-signal-green bg-signal-green/6 px-3 py-2 font-mono text-[10px] text-signal-green">✓ {{ flash }}</div>
      <button class="btn-dark">保存资料 <i class="fa-solid fa-floppy-disk ml-1.5" /></button>
    </form>

    <!-- 安全 -->
    <form class="card relative border border-line bg-card px-6 py-5" @submit.prevent="savePass">
      <h2 class="mb-4 border-b border-line-soft pb-2.5 text-[13px] font-extrabold">
        <span class="font-mono font-normal text-accent-deep">[</span> 修改密码 <span class="font-mono font-normal text-accent-deep">]</span>
        <span class="ml-2 font-mono text-[8px] tracking-[0.22em] text-ink-faint">SECURITY</span>
      </h2>
      <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">OLD 原密码</label>
      <input v-model="oldPass" type="password" class="mb-4 w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
      <div class="mb-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">NEW 新密码（≥6 位）</label>
          <input v-model="newPass" type="password" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">CONFIRM 确认新密码</label>
          <input v-model="confirmPass" type="password" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none focus:border-accent-deep" />
        </div>
      </div>
      <div v-if="err2" class="mb-3 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">[!] {{ err2 }}</div>
      <div v-if="flash2" class="mb-3 border border-signal-green bg-signal-green/6 px-3 py-2 font-mono text-[10px] text-signal-green">✓ {{ flash2 }}</div>
      <button class="btn-dark">更新密码 <i class="fa-solid fa-key ml-1.5" /></button>
    </form>
  </section>
</template>
