<script setup lang="ts">
// An AI draft of this item that was never saved (page left, browser closed): offer to take it up again
// instead of asking the AI once more. Dismissed drafts stay hidden in this browser.
const props = defineProps<{ path: string; after?: string | null }>()
const emit = defineEmits<{ use: [result: any] }>()
const api = useApi()
const job = ref<any>(null)
const KEY = 'ai-draft-dismissed'
const dismissed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}
onMounted(async () => {
  try {
    const r = await api<any>('/jobs/latest', { query: { path: props.path, after: props.after ?? '' } })
    if (r.job && !dismissed().includes(r.job.id)) job.value = r.job
  } catch {
    // nothing to offer
  }
})
function hide() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...dismissed(), job.value.id].slice(-50)))
  } catch {
    // storage blocked: hidden for this visit only
  }
  job.value = null
}
function use() {
  emit('use', job.value.result)
  job.value = null
}
const time = computed(() => job.value && new Date(job.value.created_at.replace(' ', 'T')).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))
</script>

<template>
  <div v-if="job" class="flex flex-wrap items-center gap-3 rounded-xl bg-rune-400/10 px-4 py-3 text-sm ring-1 ring-rune-400/30" data-testid="ai-draft-banner">
    <span class="min-w-0 flex-1 text-slate-200">
      มีร่างจาก AI เมื่อ {{ time }}{{ job.result?.section ? ' (เฉพาะข้อเดียว)' : '' }} ที่ยังไม่ได้บันทึก — นำมาใช้ได้เลยโดยไม่ต้องใช้โควตา AI อีก
    </span>
    <button type="button" class="btn-primary !px-3 !py-1.5 text-sm" data-testid="ai-draft-use" @click="use">นำร่างมาใช้</button>
    <button type="button" class="text-xs text-slate-400 hover:text-slate-200" data-testid="ai-draft-hide" @click="hide">ไม่ใช้</button>
  </div>
</template>
