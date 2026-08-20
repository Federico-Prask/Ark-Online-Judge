<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminCreateProblem, adminEditProblem, fetchProblem, fetchTestFiles, uploadTestsZip } from '../lib/api'
import { me } from '../lib/session'

const route = useRoute()
const router = useRouter()
const isEdit = route.name === 'problem-edit'
const error = ref('')

const id = ref('')
const title = ref('')
const base = ref(3)
const tags = ref('')
const tl = ref(1000)
const background = ref('')
const statement = ref('')
const input = ref('')
const output = ref('')
const notes = ref('')
const samples = ref<{ in: string; out: string }[]>([{ in: '', out: '' }])
const interactive = ref(false)
const interactor = ref('')
const visibility = ref<'hidden' | 'public' | 'contest'>('public')
const testFiles = ref<string[]>([])
const recognized = ref<{ subtasks: { idx: number; points: { n: number; f: string }[] }[] } | null>(null)
const uploadMsg = ref('')

onMounted(async () => {
  if (!me.value?.perms.includes('problem')) {
    router.replace('/')
    return
  }
  if (isEdit) {
    try {
      const p = await fetchProblem(String(route.params.id))
      id.value = p.id
      title.value = p.title
      base.value = p.base
      tags.value = (p.tags as string[]).join(', ')
      tl.value = p.tl
      background.value = p.desc.background ?? ''
      statement.value = p.desc.description ?? ''
      input.value = p.desc.input ?? ''
      output.value = p.desc.output ?? ''
      notes.value = p.desc.notes ?? ''
      samples.value = p.desc.samples?.length ? p.desc.samples.map((s) => ({ in: s.in, out: s.out })) : [{ in: '', out: '' }]
      interactive.value = Boolean(p.interactive)
      const t = await fetchTestFiles(p.id).catch(() => null)
      if (t) {
        testFiles.value = t.files
        recognized.value = (t as unknown as { recognized?: typeof recognized.value }).recognized ?? null
      }
    } catch {
      error.value = '题目不存在'
    }
  }
})

const addSample = () => samples.value.push({ in: '', out: '' })
const rmSample = (i: number) => samples.value.splice(i, 1)

const onZip = async (ev: Event) => {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (!f || !isEdit) return
  uploadMsg.value = '解压识别中…'
  try {
    const r = await uploadTestsZip(String(route.params.id), f)
    uploadMsg.value = `已解压 ${r.added.length} 个文件`
    const t = await fetchTestFiles(String(route.params.id))
    testFiles.value = t.files
    recognized.value = (t as unknown as { recognized?: typeof recognized.value }).recognized ?? null
  } catch (e) {
    uploadMsg.value = e instanceof Error ? e.message : '上传失败'
  }
}

const save = async () => {
  error.value = ''
  const body = {
    id: id.value.trim(),
    title: title.value,
    base: base.value,
    tags: tags.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    tl: tl.value,
    background: background.value,
    statement: statement.value,
    input: input.value,
    output: output.value,
    notes: notes.value,
    samples: samples.value.filter((s) => s.in.trim() !== ''),
    interactive: interactive.value,
    interactor: interactor.value,
    visibility: visibility.value,
  }
  try {
    if (isEdit) await adminEditProblem(String(route.params.id), body)
    else await adminCreateProblem(body)
    router.push('/problems')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
  }
}
</script>

<template>
  <section class="mx-auto max-w-[900px] pb-24 pt-16">
    <div class="mb-6 flex items-center gap-2.5 font-mono text-[10px] tracking-[0.2em] text-ink-soft">
      <router-link to="/problems" class="font-bold text-accent-deep no-underline hover:underline">[ 题库 ]</router-link>
      <span>/ {{ isEdit ? `编辑 ${route.params.id}` : '新建题目' }}</span>
    </div>
    <h1 class="mb-8 text-[clamp(26px,3.2vw,40px)] font-black tracking-[-0.015em]">
      题目<span class="grad-text">编辑</span>
    </h1>

    <div v-if="error" class="mb-4 border border-signal-red bg-signal-red/6 px-3 py-2 font-mono text-[10px] text-signal-red">[!] {{ error }}</div>

    <section class="card relative border border-line bg-card px-6 py-5">
      <div class="grid gap-4 md:grid-cols-[120px_1fr_110px_110px]">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">ID</label>
          <input v-model="id" :disabled="isEdit" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none disabled:opacity-50" placeholder="P1061" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">TITLE 标题</label>
          <input v-model="title" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">BASE 难度 1-8</label>
          <input v-model.number="base" type="number" min="1" max="8" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">TL (ms)</label>
          <input v-model.number="tl" type="number" min="100" max="5000" step="100" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none" />
        </div>
      </div>
      <div class="mt-4">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">TAGS 标签（逗号分隔）</label>
        <input v-model="tags" class="w-full border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none" placeholder="图论, 最短路" />
      </div>
      <div class="mt-4">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">BACKGROUND 背景（留空 = 无）</label>
        <textarea v-model="background" rows="2" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none" />
      </div>
      <div class="mt-4">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">DESCRIPTION 描述（空行分段）</label>
        <textarea v-model="statement" rows="5" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none" />
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">INPUT 输入格式</label>
          <textarea v-model="input" rows="3" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none" />
        </div>
        <div>
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">OUTPUT 输出格式</label>
          <textarea v-model="output" rows="3" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none" />
        </div>
      </div>

      <!-- 样例：左右排版，多组可增删 -->
      <div class="mt-5 border-t border-line-soft pt-4">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-mono text-[9px] tracking-[0.18em] text-ink-faint">SAMPLES 样例（左右对应）</span>
          <button class="chip chip-idle cursor-pointer" @click="addSample"><i class="fa-solid fa-plus mr-1 text-[8px]" />加一组</button>
        </div>
        <div v-for="(s, i) in samples" :key="i" class="mb-3 grid gap-3 md:grid-cols-2">
          <div>
            <div class="mb-1.5 flex justify-between font-mono text-[9px] tracking-[0.18em] text-ink-faint">
              <span>输入样例 {{ i + 1 }}</span><span>SAMPLE.IN</span>
            </div>
            <textarea v-model="s.in" rows="3" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[11.5px] leading-6 text-ink outline-none" />
          </div>
          <div>
            <div class="mb-1.5 flex justify-between font-mono text-[9px] tracking-[0.18em] text-ink-faint">
              <span>输出样例 {{ i + 1 }}</span>
              <button v-if="samples.length > 1" class="cursor-pointer border-none bg-transparent p-0 text-signal-red" title="删除该组" @click="rmSample(i)">
                <i class="fa-solid fa-xmark" />
              </button>
            </div>
            <textarea v-model="s.out" rows="3" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[11.5px] leading-6 text-ink outline-none" />
          </div>
        </div>
      </div>

      <!-- 测试点：zip 上传 + 自动识别 -->
      <div class="mt-4 border border-dashed border-line px-4 py-3">
        <div class="mb-2 flex items-center justify-between">
          <span class="font-mono text-[9px] tracking-[0.18em] text-ink-faint">
            TESTS 测试点压缩包（N.in / S_N.in 两种命名自动识别 subtask）
          </span>
          <span class="font-mono text-[9px] text-accent-deep">{{ uploadMsg }}</span>
        </div>
        <input v-if="isEdit" type="file" accept=".zip" class="block w-full cursor-pointer font-mono text-[10px] text-ink-soft file:mr-3 file:cursor-pointer file:border file:border-ink file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:text-ink" @change="onZip" />
        <p v-else class="font-mono text-[9px] text-ink-faint">// 创建后在编辑页上传测试点</p>
        <div v-if="testFiles.length" class="mt-2 flex flex-wrap gap-1.5">
          <span v-for="f in testFiles" :key="f" class="border border-line px-2 py-0.5 font-mono text-[9px] text-ink-soft">{{ f }}</span>
        </div>
        <div v-if="recognized?.subtasks.length" class="mt-2 font-mono text-[9px] text-ink-soft">
          识别结果：
          <span v-for="st in recognized.subtasks" :key="st.idx" class="mr-3">
            Subtask {{ st.idx }} · {{ st.points.length }} 点
          </span>
        </div>
      </div>

      <div class="mt-4">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">NOTES 说明与提示（留空 = 无）</label>
        <textarea v-model="notes" rows="2" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[12px] leading-6 text-ink outline-none" />
      </div>

      <div class="mt-5 border-t border-line-soft pt-4">
        <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">VISIBILITY 可见性</label>
        <select v-model="visibility" class="mb-4 w-full cursor-pointer border border-line bg-paper px-3 py-2.5 font-mono text-[12px] text-ink outline-none">
          <option value="public">公开 —— 题库可见</option>
          <option value="contest">比赛 —— 赛时仅比赛页可见，赛后自动公开</option>
          <option value="hidden">隐藏 —— 仅题目管理员可见</option>
        </select>
        <label class="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-ink">
          <input v-model="interactive" type="checkbox" class="accent-[#5E8FD4]" />
          交互题（INTERACTIVE）
        </label>
        <div v-if="interactive" class="mt-3">
          <label class="mb-1 block font-mono text-[9px] tracking-[0.18em] text-ink-faint">
            INTERACTOR 交互器 C++（stdin=测试输入，argv[1]=结果文件写 1/0，stdout↔选手程序）
          </label>
          <textarea v-model="interactor" rows="10" class="w-full resize-y border border-line bg-paper px-3 py-2.5 font-mono text-[11.5px] leading-6 text-ink outline-none" />
        </div>
      </div>
      <div class="mt-6">
        <button class="btn-dark" @click="save">保存 <i class="fa-solid fa-floppy-disk ml-1.5" /></button>
      </div>
    </section>
  </section>
</template>
