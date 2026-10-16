<script setup lang="ts">
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const api = useApi()
const id = route.params.id as string
const data = ref<any>(null)
const err = ref('')
const busy = ref(false)

const form = reactive({ topicIndex: -1, unit_no: 1, session_no: 1, unit_name: '', title: '', hours_theory: 1, hours_practice: 2, prefill: true })

async function load() {
  data.value = await api(`/teacher/courses/${id}/plans`)
}
onMounted(() => load().catch((e) => (err.value = apiErrorMessage(e))))

// picking a course topic fills unit number + name; the next free session number is suggested
watch(() => form.topicIndex, (i) => {
  if (i < 0 || !data.value) return
  form.unit_no = i + 1
  form.unit_name = data.value.topics[i]
  const used = data.value.plans.filter((p: any) => p.unit_no === form.unit_no).map((p: any) => p.session_no)
  form.session_no = used.length ? Math.max(...used) + 1 : 1
})

async function create() {
  err.value = ''
  busy.value = true
  try {
    const { topicIndex: _t, prefill, ...body } = form
    const res = await api<any>(`/teacher/courses/${id}/plans`, { method: 'POST', body: { ...body, prefill: prefill ? 'guide' : 'none' } })
    await navigateTo(`/teacher/course/${id}/plans/${res.id}`)
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

async function remove(p: any) {
  if (!confirm(`ลบแผนหน่วยที่ ${p.unit_no} สอนครั้งที่ ${p.session_no} “${p.title || p.unit_name}”?`)) return
  await api(`/teacher/plans/${p.id}`, { method: 'DELETE' })
  await load()
}

async function downloadOne(p: any) {
  busy.value = true
  try {
    const r = await api<any>(`/teacher/plans/${p.id}`)
    await exportLessonPlansDocx({ course: r.course, plans: [r.plan], learners: r.learners, filename: `แผนการจัดการเรียนรู้-${r.course.code}-หน่วย${p.unit_no}-ครั้ง${p.session_no}.docx` })
  } finally {
    busy.value = false
  }
}
async function downloadAll() {
  busy.value = true
  try {
    const r = await api<any>(`/teacher/courses/${id}/plans/full`)
    await exportLessonPlansDocx({ course: r.course, plans: r.plans, learners: r.learners, filename: `แผนการจัดการเรียนรู้-${r.course.code}-ทุกหน่วย.docx` })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <NuxtLink :to="`/teacher/course/${id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แดชบอร์ดรายวิชา</NuxtLink>
    <p v-if="err && !data" class="card text-red-300">{{ err }}</p>
    <p v-else-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} · {{ data.course.section }} · {{ data.level_higher ? 'ปวส.' : 'ปวช.' }}</p>
          <h1 class="title-glow mt-1 text-2xl sm:text-3xl">แผนการจัดการเรียนรู้</h1>
          <p class="text-sm text-slate-400">{{ data.course.name }} · แบบฟอร์มแผนการจัดการเรียนรู้รายวิชา หลักสูตร 2567 (ฐานสมรรถนะ · MIAP)</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NuxtLink :to="`/teacher/course/${id}/plans/book`" class="btn-primary !py-2 text-sm" data-testid="open-book">
            <AppIcon name="book" :size="16" /> เล่มแผนทั้งรายวิชา (ปก · หลักสูตร · ตารางวิเคราะห์)
          </NuxtLink>
          <button v-if="data.plans.length" class="btn-ghost !py-2 text-sm" :disabled="busy" data-testid="download-all" @click="downloadAll">
            <AppIcon name="download" :size="16" /> เฉพาะแผนรายหน่วย (Word)
          </button>
        </div>
      </header>

      <section class="card !p-0">
        <div class="flex items-center justify-between px-5 py-4">
          <h2 class="text-lg font-medium text-slate-50">แผนรายหน่วย ({{ data.plans.length }})</h2>
        </div>
        <p v-if="!data.plans.length" class="px-5 pb-5 text-sm text-slate-500">ยังไม่มีแผน — สร้างแผนแรกจากด้านล่าง</p>
        <table v-else class="w-full text-sm">
          <thead class="text-left text-slate-400">
            <tr class="border-t border-white/10"><th class="px-4 py-2">หน่วย</th><th class="px-4 py-2">ครั้งที่</th><th class="px-4 py-2">ชื่อหน่วย / เรื่อง</th><th class="px-4 py-2">ท/ป (ชม.)</th><th class="px-4 py-2">ความครบถ้วน</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="p in data.plans" :key="p.id" class="border-t border-white/5">
              <td class="px-4 py-2 text-slate-200">{{ p.unit_no }}</td>
              <td class="px-4 py-2 text-slate-300">{{ p.session_no }}</td>
              <td class="px-4 py-2">
                <NuxtLink :to="`/teacher/course/${id}/plans/${p.id}`" class="text-slate-100 hover:text-rune-200">{{ p.unit_name }}</NuxtLink>
                <p v-if="p.title" class="text-xs text-slate-400">{{ p.title }}</p>
              </td>
              <td class="px-4 py-2 text-slate-300">{{ p.hours_theory }}/{{ p.hours_practice }}</td>
              <td class="px-4 py-2">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-20 rounded-full bg-white/10"><div class="h-full rounded-full bg-emerald-400" :style="{ width: p.completeness + '%' }" /></div>
                  <span class="text-xs text-slate-400">{{ p.completeness }}%</span>
                  <span v-if="p.ai_model" class="rounded-full bg-sky-500/15 px-2 text-xs text-sky-300">AI</span>
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-2 text-right">
                <NuxtLink :to="`/teacher/course/${id}/plans/${p.id}`" class="mr-3 text-xs text-sky-300 hover:text-sky-200">แก้ไข</NuxtLink>
                <button class="mr-3 text-xs text-rune-300 hover:text-rune-200" :disabled="busy" @click="downloadOne(p)">Word</button>
                <button class="text-xs text-red-300/80 hover:text-red-300" @click="remove(p)">ลบ</button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card space-y-4" data-testid="new-plan">
        <h2 class="text-lg font-medium text-slate-50">สร้างแผนรายหน่วย</h2>
        <div>
          <p class="label">เลือกจากหน่วยการเรียนของรายวิชา</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(t, i) in data.topics"
              :key="t"
              type="button"
              class="rounded-full px-3 py-1.5 text-sm ring-1 transition"
              :class="form.topicIndex === i ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
              @click="form.topicIndex = i"
            >{{ i + 1 }}. {{ t }}</button>
          </div>
          <p v-if="!data.topics.length" class="text-sm text-slate-500">รายวิชานี้ยังไม่ได้กำหนดหน่วยการเรียน — กรอกเองด้านล่าง หรือเพิ่มที่หน้า “จัดการรายชื่อ / แก้ไขวิชา”</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-6">
          <div><p class="label">หน่วยที่</p><input v-model.number="form.unit_no" type="number" min="1" class="input"></div>
          <div><p class="label">สอนครั้งที่</p><input v-model.number="form.session_no" type="number" min="1" class="input"></div>
          <div class="sm:col-span-4"><p class="label">ชื่อหน่วยการเรียนรู้ *</p><input v-model="form.unit_name" class="input" data-testid="unit-name"></div>
          <div class="sm:col-span-4"><p class="label">ชื่อเรื่อง/งาน (ครั้งนี้)</p><input v-model="form.title" class="input" placeholder="เช่น การสร้างและใช้งานสแตก" data-testid="plan-title"></div>
          <div><p class="label">ทฤษฎี (ชม.)</p><input v-model.number="form.hours_theory" type="number" min="0" step="0.5" class="input"></div>
          <div><p class="label">ปฏิบัติ (ชม.)</p><input v-model.number="form.hours_practice" type="number" min="0" step="0.5" class="input"></div>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input v-model="form.prefill" type="checkbox"> เติมร่างเริ่มต้นจากไกด์การสอนของห้องนี้ (ไม่ใช้ AI) — ให้ AI ร่างละเอียดได้ในหน้าถัดไป
        </label>
        <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>
        <button class="btn-primary" :disabled="busy || !form.unit_name.trim()" data-testid="create-plan" @click="create"><AppIcon name="quill" :size="18" /> สร้างแผน</button>
      </section>
    </template>
  </div>
</template>
