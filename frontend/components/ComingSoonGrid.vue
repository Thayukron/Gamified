<script setup lang="ts">
defineProps<{ items: { icon: string; title: string; desc: string; phase: number }[] }>()
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div v-for="it in items" :key="it.title" class="card flex gap-4">
      <div class="text-3xl">{{ it.icon }}</div>
      <div>
        <div class="font-semibold text-slate-800">{{ it.title }}</div>
        <p class="mt-1 text-sm text-slate-500">{{ it.desc }}</p>
        <span class="mt-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
          กำลังพัฒนา · เฟส {{ it.phase }}
        </span>
      </div>
    </div>
  </div>
</template>
