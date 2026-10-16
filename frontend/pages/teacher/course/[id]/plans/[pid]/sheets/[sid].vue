<script setup lang="ts">
// Sheets are edited inside the unit workspace now; keep old links working.
const route = useRoute()
await navigateTo(`/teacher/course/${route.params.id}/plans/${route.params.pid}?tab=s${route.params.sid}`, { replace: true })
</script>

<template>
  <p class="text-slate-500">กำลังเปิด…</p>
</template>
