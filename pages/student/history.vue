<script setup lang="ts">
import { varkLabel, type AssessmentResult } from '~/utils/profile'

const api = useApi()
const results = ref<AssessmentResult[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    results.value = (await api('/student/results')).results
  } finally {
    loading.value = false
  }
})

const fmtDate = (s: string) => new Date(s.replace(' ', 'T')).toLocaleDateString('th-TH', { dateStyle: 'medium' })
</script>

<template>
  <div class="space-y-6">
    <div class="animate-fade-up">
      <NuxtLink to="/student" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300">
        <AppIcon name="back" :size="16" /> หน้าหลัก
      </NuxtLink>
      <p class="mt-3 font-display text-xs tracking-[0.4em] text-arcane-300/80">CHRONICLES</p>
      <h1 class="title-glow mt-1 text-2xl">บันทึกการเดินทาง</h1>
    </div>

    <p v-if="loading" class="text-slate-500">กำลังเปิดบันทึก...</p>
    <div v-else-if="!results.length" class="card text-center text-slate-400">
      ยังไม่มีบันทึกการเดินทาง — เริ่มเควสต์แรกของคุณเลย!
      <div class="mt-4"><NuxtLink to="/student" class="btn-primary">ไปเลือกเควสต์</NuxtLink></div>
    </div>

    <div class="relative space-y-4 border-l border-rune-400/25 pl-6">
      <NuxtLink
        v-for="(r, i) in results"
        :key="r.id"
        :to="`/student/result/${r.id}`"
        class="card card-hover relative block animate-fade-up !p-4"
        :style="{ animationDelay: `${i * 100}ms` }"
      >
        <span class="absolute -left-[31px] top-6 h-3 w-3 rounded-full border-2 border-abyss-950 shadow-glow-gold" :style="{ background: r.color }" />
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-abyss-950" :style="{ borderColor: r.color, color: r.color }">
            <AppIcon :name="r.icon" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-xs text-slate-500">ภาคเรียน {{ r.semester }}/{{ r.academic_year }} · {{ fmtDate(r.completed_at) }}</div>
            <div class="font-medium text-slate-100">{{ r.archetype_name }} <span class="text-sm" :style="{ color: r.color }">· {{ r.archetype_title }}</span></div>
            <div class="truncate text-xs text-slate-400">
              {{ r.scenario_title }} · Holland {{ r.dominant_riasec }} · {{ varkLabel(r.dominant_vark).th }}
            </div>
          </div>
          <AppIcon name="back" :size="18" class="rotate-180 text-slate-500" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
