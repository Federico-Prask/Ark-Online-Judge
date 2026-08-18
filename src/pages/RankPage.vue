<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { api, type RankItem } from '../api'
import { makeAvatar } from '../utils'
import Pagination from '../components/Pagination.vue'

const emit = defineEmits<{
  (e: 'navigate', page: string, payload?: Record<string, unknown>): void
}>()

const items = ref<RankItem[]>([])
const page = ref(1)
const totalPages = ref(1)
const total = ref(0)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const r = await api.rank({ page: page.value, pageSize: 30 })
    items.value = r.items
    total.value = r.total
    totalPages.value = r.totalPages
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(page, load)
</script>

<template>
  <section class="page-panel">
    <div class="page-head">
      <div>
        <small>// GLOBAL RANKING</small>
        <h2>排名</h2>
      </div>
    </div>

    <div v-if="loading" class="empty-hint">加载中…</div>
    <div class="table-wrap" v-else>
      <div class="table-head rank-grid">
        <span>#</span>
        <span>用户</span>
        <span>通过题数</span>
        <span>提交数</span>
        <span>角色</span>
      </div>
      <div
        v-for="u in items"
        :key="u.id"
        class="table-row rank-grid clickable"
        @click="emit('navigate', '用户', { username: u.username })"
      >
        <span class="mono rank-num" :class="{ top: u.rank <= 3 }">{{ u.rank }}</span>
        <span class="user-cell">
          <img class="mini-avatar" :src="makeAvatar(u)" alt="" />
          <span>
            <b>{{ u.nickname }}</b>
            <small class="block muted">@{{ u.username }}</small>
          </span>
        </span>
        <span class="mono ac-text">{{ u.solved }}</span>
        <span class="mono muted">{{ u.submitted }}</span>
        <span class="chip">{{ u.role }}</span>
      </div>
      <div v-if="!items.length" class="empty-hint">暂无数据</div>
    </div>

    <Pagination
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @update:page="page = $event"
    />
  </section>
</template>
