<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { pct } from '~/utils/viz'

interface Course { id: number; code: string; name: string; section: string; semester: number; academic_year: number; department_name: string; enrolled: number; profiled: number; reset_requests: number }

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

const steps = [
  { icon: "book", tone: "indigo", title: "สร้างรายวิชา", desc: "เลือกกลุ่มเรียนที่เรียนกับคุณ ผู้เรียนทำแบบประเมินครั้งเดียวใช้ได้ทุกวิชา" },
  { icon: "chart", tone: "sky", title: "ดูแดชบอร์ดผู้เรียน", desc: "สัดส่วน VARK / RIASEC / Mindset และโปรไฟล์รายคน" },
  { icon: "bulb", tone: "amber", title: "ไกด์การสอน", desc: "สื่อ วิธีสอน และแนวทางรายหน่วย (+AI เมื่อกรอก Key)" },
  { icon: "users", tone: "emerald", title: "จัดกลุ่มผู้เรียน", desc: "คละจุดแข็งหรือกลุ่มซ่อมเสริม แล้วบันทึก" },
  { icon: "file", tone: "violet", title: "แผนการจัดการเรียนรู้", desc: "แบบฟอร์มสถานศึกษา (MIAP) · AI ร่าง · ดาวน์โหลด Word" },
  { icon: "clipboard", tone: "rose", title: "รายงาน ว.PA", desc: "พิมพ์ PDF และดาวน์โหลด Excel" },
]
// term filter: the current term by default, so last term's courses don't clutter the list
const termKey = (c: { semester: number; academic_year: number }) => `${c.semester}/${c.academic_year}`
const termFilter = ref('current')
const terms = computed(() => [...new Set(courses.value.map(termKey))].sort((a, b) => {
  const [sa, ya] = a.split('/').map(Number)
  const [sb, yb] = b.split('/').map(Number)
  return yb * 10 + sb - (ya * 10 + sa)
}))
const shown = computed(() => {
  if (termFilter.value === 'all') return courses.value
  const k = termFilter.value === 'current' ? (term.value ? termKey(term.value) : '') : termFilter.value
  return courses.value.filter((c) => termKey(c) === k)
})
const otherTerms = computed(() => terms.value.filter((t) => !term.value || t !== termKey(term.value)))
const totals = computed(() => {
  const enrolled = shown.value.reduce((n, c) => n + c.enrolled, 0)
  const profiled = shown.value.reduce((n, c) => n + c.profiled, 0)
  return { courses: shown.value.length, enrolled, profiled, pct: pct(profiled, enrolled) }
})
const TONES = ["indigo", "violet", "sky", "emerald", "amber", "rose"] as const
</script>

<template>
  <div class="space-y-8">
    <section class="staff-hero">
      <div class="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p class="text-sm text-indigo-100/90">ภาคเรียน {{ term?.semester ?? "-" }}/{{ term?.academic_year ?? "-" }}</p>
          <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">สวัสดี {{ auth.user?.full_name }}</h1>
          <p class="mt-1 max-w-xl text-indigo-100/90">เลือกรายวิชาเพื่อดูโปรไฟล์ผู้เรียน และวางแผนการสอนให้เหมาะกับผู้เรียนแต่ละกลุ่ม</p>
        </div>
        <NuxtLink to="/teacher/course/new" class="inline-flex items-center gap-2 rounded-xl bg-snow px-4 py-2.5 font-medium text-indigo-700 shadow-lg shadow-indigo-900/20 transition hover:-translate-y-0.5" data-testid="new-course-hero">
          <AppIcon name="plus" :size="18" :stroke="2.2" /> สร้างรายวิชา
        </NuxtLink>
      </div>
      <div class="relative mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <div v-for="s in [{ v: totals.courses, l: 'รายวิชา' }, { v: totals.enrolled, l: 'ผู้เรียนทั้งหมด' }, { v: totals.pct + '%', l: 'มีโปรไฟล์แล้ว' }]" :key="s.l" class="rounded-2xl bg-snow/10 px-4 py-3 ring-1 ring-inset ring-snow/15 backdrop-blur">
          <p class="font-display text-2xl font-semibold tabular-nums">{{ s.v }}</p>
          <p class="text-xs text-indigo-100/90">{{ s.l }}</p>
        </div>
      </div>
    </section>

    <NuxtLink to="/teacher/settings" class="card card-hover flex items-center gap-4 !p-4">
      <StaffIcon name="sparkle" tone="fuchsia" />
      <div class="flex-1">
        <p class="font-medium text-slate-50">ตั้งค่า AI ของฉัน</p>
        <p class="text-sm text-slate-400">กรอก API Key ของ Gemini (ฟรี) เพื่อให้ AI ช่วยออกแบบแผนการสอนรายวิชาและรายหน่วย</p>
      </div>
      <AppIcon name="chevron" :size="18" class="text-slate-500" />
    </NuxtLink>

    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="staff-section">รายวิชาของฉัน <span class="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">{{ shown.length }}</span></h2>
        <NuxtLink to="/teacher/course/new" class="text-sm font-medium text-rune-300 hover:underline" data-testid="new-course">+ สร้างรายวิชาใหม่</NuxtLink>
      </div>
      <div v-if="courses.length" class="flex flex-wrap gap-2" data-testid="term-filter">
        <button
          v-for="t in [{ k: 'current', th: `ภาคเรียนปัจจุบัน${term ? ' ' + termKey(term) : ''}` }, ...otherTerms.map((x) => ({ k: x, th: 'ภาคเรียน ' + x })), { k: 'all', th: 'ทั้งหมด' }]"
          :key="t.k"
          type="button"
          class="rounded-full px-3 py-1 text-sm ring-1 transition"
          :class="termFilter === t.k ? 'bg-rune-400/15 font-medium text-rune-200 ring-rune-400/50' : 'text-slate-400 ring-white/15 hover:text-slate-200'"
          @click="termFilter = t.k"
        >{{ t.th }}</button>
      </div>
      <p v-if="loading" class="text-slate-500">กำลังโหลดรายวิชา...</p>
      <p v-else-if="courses.length && !shown.length" class="text-sm text-slate-500">ยังไม่มีรายวิชาในภาคเรียนนี้ — สร้างรายวิชาใหม่ หรือดูภาคเรียนอื่นด้านบน</p>
      <NuxtLink v-else-if="!courses.length" to="/teacher/course/new" class="card card-hover flex items-center gap-4 border-dashed">
        <StaffIcon name="plus" tone="indigo" />
        <div>
          <p class="text-lg font-semibold text-slate-50">สร้างรายวิชาแรกของคุณ</p>
          <p class="text-sm text-slate-400">กรอกข้อมูลวิชา แล้วเลือกกลุ่มเรียนที่เรียนกับคุณ — ใช้ผลประเมินที่ผู้เรียนทำไว้แล้วได้ทันที</p>
        </div>
      </NuxtLink>
      <div class="grid gap-4 md:grid-cols-2">
        <NuxtLink v-for="(c, i) in shown" :key="c.id" :to="`/teacher/course/${c.id}`" class="card card-hover group overflow-hidden">
          <div class="flex items-start gap-4">
            <StaffIcon name="graduation" :tone="TONES[i % TONES.length]" />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-medium text-slate-500">{{ c.code }} · กลุ่ม {{ c.section }} · ภาคเรียน {{ termKey(c) }}</p>
              <h3 class="mt-0.5 truncate font-display text-lg font-semibold text-slate-50">{{ c.name }}</h3>
              <p class="text-sm text-slate-400">แผนก{{ c.department_name }}</p>
            </div>
            <AppIcon name="chevron" :size="18" class="mt-1 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-rune-300" />
          </div>
          <button
            v-if="c.reset_requests > 0"
            type="button"
            class="mt-4 flex w-full items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-200 hover:bg-amber-500/15"
            data-testid="course-resets"
            @click.prevent.stop="navigateTo(`/teacher/course/${c.id}/students`)"
          >
            <AppIcon name="lock" :size="14" /> ผู้เรียน {{ c.reset_requests }} คนขอรีเซ็ตรหัสผ่าน — คลิกเพื่อจัดการ
          </button>
          <div class="mt-5">
            <div class="flex justify-between text-xs">
              <span class="text-slate-400">ผู้เรียนที่มีโปรไฟล์แล้ว</span>
              <span class="font-medium tabular-nums text-slate-200">{{ c.profiled }}/{{ c.enrolled }} คน · {{ pct(c.profiled, c.enrolled) }}%</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-900">
              <div class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" :style="{ width: `${pct(c.profiled, c.enrolled)}%` }" />
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="space-y-4">
      <h2 class="staff-section">ขั้นตอนการใช้งาน</h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="(u, i) in steps" :key="u.title" class="card flex gap-4 !p-5">
          <StaffIcon :name="u.icon" :tone="u.tone" />
          <div>
            <p class="font-medium text-slate-50"><span class="mr-1 text-slate-500">{{ i + 1 }}.</span>{{ u.title }}</p>
            <p class="mt-0.5 text-sm text-slate-400">{{ u.desc }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
