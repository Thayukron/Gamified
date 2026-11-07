<script setup lang="ts">
// How many AI requests the teacher has made in this quota day (Gemini's free tier resets at midnight Pacific time).
const api = useApi()
const usage = ref<{ used: number; failed: number; since: string } | null>(null)
async function refresh() {
  try {
    usage.value = (await api<any>('/me/ai')).usage ?? null
  } catch {
    usage.value = null // the counter is a hint only
  }
}
onMounted(refresh)
defineExpose({ refresh })
</script>

<template>
  <span v-if="usage" class="text-xs text-slate-400" data-testid="ai-usage" :title="`นับตั้งแต่ ${usage.since} น. (โควตาฟรีของ Gemini เริ่มรอบใหม่ทุกวันเวลานี้)`">
    ใช้ AI รอบนี้ {{ usage.used }} ครั้ง<template v-if="usage.failed"> (ไม่สำเร็จ {{ usage.failed }})</template>
  </span>
</template>
