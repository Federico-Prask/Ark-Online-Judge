<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
  total?: number
}>()
const emit = defineEmits<{ (e: 'update:page', v: number): void }>()
function go(p: number, totalPages: number) {
  const n = Math.min(totalPages, Math.max(1, p))
  emit('update:page', n)
}
</script>

<template>
  <div class="pager" v-if="totalPages > 1 || (total ?? 0) > 0">
    <span class="pager-meta" v-if="total != null">共 {{ total }} 条</span>
    <button :disabled="page <= 1" @click="go(page - 1, totalPages)">‹ PREV</button>
    <span class="pager-cur">{{ page }} / {{ totalPages }}</span>
    <button :disabled="page >= totalPages" @click="go(page + 1, totalPages)">NEXT ›</button>
  </div>
</template>
