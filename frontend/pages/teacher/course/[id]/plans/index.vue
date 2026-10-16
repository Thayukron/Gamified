<script setup lang="ts">
// Lesson-plan hub of a course: units as a short list (forms done per unit), one click to start a plan,
// one button to export the course as a Word book with a picker for the parts.
import { SHEET_TYPES, courseExportGroups, toInclude, type ExportGroup } from '~/utils/lessonPlan'
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const api = useApi()
const id = route.params.id as string
const data = ref<any>(null)
const err = ref('')
const busy = ref(false)
const other = reactive({ open: false, unit_no: 1, unit_name: '' })
const exportOpen = ref(false)
const exportGroups = ref<ExportGroup[]>([])
const exportData = ref<any>(null)

async function load() {
  data.value = await api(`/teacher/courses/${id}/plans`)
}
onMounted(() => load().catch((e) => (err.value = apiErrorMessage(e))))

const course = computed(() => data.value?.course)
const contentMissing = computed(() => course.value && !(course.value.objectives || '').trim() && !(course.value.description || '').trim())

/** units = course topics, plus any unit numbers that only exist in plans */
const units = computed(() => {
  if (!data.value) return []
  const list = data.value.topics.map((t: string, i: number) => ({ no: i + 1, name: t, plans: [] as any[] }))
  for (const p of data.value.plans) {
    let u = list.find((x: any) => x.no === p.unit_no)
    if (!u) list.push((u = { no: p.unit_no, name: p.unit_name, plans: [] }))
    u.plans.push(p)
  }
  return list.sort((a: any, b: any) => a.no - b.no)
})

async function start(unit: { no: number; name: string; plans: any[] }) {
  busy.value = true
  err.value = ''
  try {
    const session = unit.plans.length ? Math.max(...unit.plans.map((p: any) => p.session_no)) + 1 : 1
    const c = course.value
    const res = await api<any>(`/teacher/courses/${id}/plans`, {
      method: 'POST',
      body: {
        unit_no: unit.no, session_no: session, unit_name: unit.name, title: unit.name,
        hours_theory: parseFloat(c.theory_hours) || 1, hours_practice: parseFloat(c.practice_hours) || 2, prefill: 'guide',
      },
    })
    await navigateTo(`/teacher/course/${id}/plans/${res.id}`)
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
async function startOther() {
  if (!other.unit_name.trim()) return
  await start({ no: other.unit_no, name: other.unit_name.trim(), plans: units.value.find((u: any) => u.no === other.unit_no)?.plans ?? [] })
}
async function remove(p: any) {
  if (!confirm(`ลบหน่วยที่ ${p.unit_no} สอนครั้งที่ ${p.session_no} พร้อมเอกสารประกอบทั้งหมด?`)) return
  await api(`/teacher/plans/${p.id}`, { method: 'DELETE' })
  await load()
}

async function openExport() {
  busy.value = true
  try {
    exportData.value = await api(`/teacher/courses/${id}/book`)
    exportGroups.value = courseExportGroups(exportData.value.plans, exportData.value.learners.ready)
    exportOpen.value = true
  } finally {
    busy.value = false
  }
}
async function doExport(keys: string[]) {
  busy.value = true
  try {
    const d = exportData.value
    await exportLessonPlansDocx({
      course: d.course, plans: d.plans, learners: d.learners, book: d.book, institution: d.institution,
      include: toInclude(keys),
      filename: `แผนการจัดการเรียนรู้-${d.course.code}.docx`,
    })
    exportOpen.value = false
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <NuxtLink :to="`/teacher/course/${id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แดชบอร์ดรายวิชา</NuxtLink>
    <p v-if="err && !data" class="card text-red-300">{{ err }}</p>
    <p v-else-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-mono text-xs text-rune-300/80">{{ course.code }} · {{ course.section }}</p>
          <h1 class="title-glow mt-1 text-2xl sm:text-3xl">แผนการจัดการเรียนรู้</h1>
          <p class="text-sm text-slate-400">{{ course.name }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NuxtLink :to="`/teacher/course/${id}/plans/book`" class="btn-ghost !py-2 text-sm" data-testid="open-book"><AppIcon name="book" :size="16" /> ปก · คำนำ · ตารางวิเคราะห์</NuxtLink>
          <button class="btn-primary !py-2 text-sm" :disabled="busy" data-testid="course-export" @click="openExport"><AppIcon name="download" :size="16" /> ส่งออกทั้งรายวิชา</button>
        </div>
      </header>

      <NuxtLink v-if="contentMissing" :to="`/teacher/course/${id}/students?edit=content`" class="card card-hover flex items-center gap-3 border-rune-400/40 !py-3" data-testid="content-missing">
        <AppIcon name="quill" :size="18" class="text-rune-300" />
        <span class="flex-1 text-sm text-slate-200">ยังไม่ได้กรอก <b>จุดประสงค์ · สมรรถนะ · คำอธิบายรายวิชา</b> — กรอกครั้งเดียว ใช้ทั้งในเล่มแผนและให้ AI วิเคราะห์เนื้อหาได้ตรงหลักสูตร</span>
        <span class="text-sm text-rune-300">กรอกเลย →</span>
      </NuxtLink>

      <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>

      <!-- units -->
      <section class="space-y-2" data-testid="units">
        <div v-for="u in units" :key="u.no" class="card !p-4">
          <div class="flex flex-wrap items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rune-400/40 font-display text-rune-300">{{ u.no }}</span>
            <p class="min-w-0 flex-1 font-medium text-slate-100">{{ u.name }}</p>
            <button class="btn-ghost !px-3 !py-1.5 text-sm" :disabled="busy" :data-testid="`start-${u.no}`" @click="start(u)">
              {{ u.plans.length ? '+ สอนครั้งถัดไป' : '+ เริ่มทำแผน' }}
            </button>
          </div>
          <div v-if="u.plans.length" class="mt-3 space-y-2 pl-12">
            <div v-for="p in u.plans" :key="p.id" class="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10">
              <NuxtLink :to="`/teacher/course/${id}/plans/${p.id}`" class="text-slate-100 hover:text-rune-200" :data-testid="`open-plan-${p.id}`">ครั้งที่ {{ p.session_no }} · {{ p.title || p.unit_name }}</NuxtLink>
              <span class="flex-1" />
              <!-- forms of this session -->
              <span class="rounded-full px-2 py-0.5 text-xs" :class="p.completeness >= 100 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-slate-300'">แผน {{ p.completeness }}%</span>
              <span v-for="s in p.sheets" :key="s.id" class="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">{{ SHEET_TYPES[s.type as keyof typeof SHEET_TYPES].th }}</span>
              <NuxtLink :to="`/teacher/course/${id}/plans/${p.id}`" class="text-xs text-sky-300 hover:text-sky-200">เปิด</NuxtLink>
              <button class="text-xs text-red-300/70 hover:text-red-300" @click="remove(p)">ลบ</button>
            </div>
          </div>
        </div>
        <NuxtLink v-if="!units.length" :to="`/teacher/course/${id}/students?edit=units`" class="card card-hover block text-sm text-slate-300" data-testid="no-units">รายวิชานี้ยังไม่มีหน่วยการเรียน — <span class="text-rune-300">ให้ AI แบ่งหน่วยจากคำอธิบายรายวิชา →</span></NuxtLink>
      </section>

      <div>
        <button v-if="!other.open" class="text-sm text-slate-400 hover:text-rune-300" @click="other.open = true">+ เพิ่มหน่วยที่ไม่อยู่ในรายการ</button>
        <div v-else class="card flex flex-wrap items-end gap-3 !p-4">
          <div><p class="label">หน่วยที่</p><input v-model.number="other.unit_no" type="number" min="1" class="input !w-24"></div>
          <div class="flex-1"><p class="label">ชื่อหน่วย</p><input v-model="other.unit_name" class="input"></div>
          <button class="btn-primary !py-2 text-sm" :disabled="busy || !other.unit_name.trim()" @click="startOther">เริ่มทำแผน</button>
        </div>
      </div>

      <TeacherExportDialog v-if="exportOpen" :title="`ส่งออก ${course.code} ${course.name}`" :groups="exportGroups" :busy="busy" @close="exportOpen = false" @export="doExport" />
    </template>
  </div>
</template>
