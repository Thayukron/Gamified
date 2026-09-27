<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { pct } from '~/utils/viz'

interface Course { id: number; code: string; name: string; section: string; department_name: string; enrolled: number; profiled: number }

const auth = useAuthStore()
const api = useApi()
const courses = ref<Course[]>([])
const term = ref<{ semester: number; academic_year: number } | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await api('/teacher/courses')
    courses.value = res.courses
    term.value = res.term
  } finally {
    loading.value = false
  }
})

const upcoming = [
  { icon: 'castle', title: 'จัดกลุ่มอัจฉริยะ', desc: 'จัดกลุ่มคละจุดแข็งอัตโนมัติ', phase: 'C' },
  { icon: 'scroll', title: 'ส่งออกรายงาน', desc: 'PDF / Excel สำหรับ ว.PA และวิจัยชั้นเรียน', phase: 'D' },
]
</script>

<template>
  <div class="space-y-8">
    <div class="animate-fade-up">
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">KEEPER OF KNOWLEDGE</p>
      <h1 class="title-glow mt-2 text-3xl">สวัสดี {{ auth.user?.full_name }}</h1>
      <p class="mt-1 text-slate-400">
        เลือกรายวิชาเพื่อดูโปรไฟล์ผู้เรียน
        <template v-if="term"> · ภาคเรียน {{ term.semester }}/{{ term.academic_year }}</template>
      </p>
    </div>

    <NuxtLink to="/teacher/settings" class="card card-hover flex animate-fade-up items-center gap-4 border-sky-400/30 !p-4">
      <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/50 text-sky-300"><AppIcon name="key" /></span>
      <div class="flex-1">
        <p class="font-medium text-slate-100">ตั้งค่า AI ของฉัน</p>
        <p class="text-sm text-slate-400">กรอก API Key ของ Gemini (ฟรี) เพื่อให้ AI ช่วยออกแบบแผนการสอนรายวิชาและรายหน่วย</p>
      </div>
      <AppIcon name="back" :size="18" class="rotate-180 text-slate-500" />
    </NuxtLink>

    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">MY COURSES</span></div>

    <p v-if="loading" class="text-slate-500">กำลังโหลดรายวิชา...</p>
    <p v-else-if="!courses.length" class="card text-slate-400">ยังไม่มีรายวิชาที่คุณสอนในระบบ — ติดต่อผู้ดูแลระบบเพื่อผูกรายวิชา</p>

    <div class="grid gap-4 md:grid-cols-2">
      <NuxtLink
        v-for="(c, i) in courses"
        :key="c.id"
        :to="`/teacher/course/${c.id}`"
        class="card card-hover group animate-fade-up"
        :style="{ animationDelay: `${i * 80}ms` }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-xs text-rune-300/80">{{ c.code }} · {{ c.section }}</p>
            <h2 class="mt-1 text-xl font-semibold text-slate-50">{{ c.name }}</h2>
            <p class="text-sm text-slate-400">แผนก{{ c.department_name }}</p>
          </div>
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rune-400/40 text-rune-300 transition group-hover:rotate-6">
            <AppIcon name="chart" />
          </span>
        </div>
        <div class="mt-4">
          <div class="flex justify-between text-xs text-slate-400">
            <span>ผู้เรียนที่มีโปรไฟล์แล้ว</span>
            <span class="tabular-nums text-slate-200">{{ c.profiled }}/{{ c.enrolled }} คน ({{ pct(c.profiled, c.enrolled) }}%)</span>
          </div>
          <div class="mt-1.5 h-2 rounded-full bg-white/10">
            <div class="h-full rounded-full bg-[#3987e5]" :style="{ width: `${pct(c.profiled, c.enrolled)}%` }" />
          </div>
        </div>
      </NuxtLink>
    </div>

    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">COMING NEXT</span></div>
    <div class="grid gap-4 sm:grid-cols-3">
      <div v-for="u in upcoming" :key="u.title" class="card flex gap-3 opacity-80">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rune-400/30 text-rune-300"><AppIcon :name="u.icon" /></span>
        <div>
          <p class="font-medium text-slate-100">{{ u.title }}</p>
          <p class="text-sm text-slate-400">{{ u.desc }}</p>
          <span class="mt-2 inline-block rounded-full border border-arcane-400/30 px-2 py-0.5 text-xs text-arcane-300">ขั้น {{ u.phase }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
