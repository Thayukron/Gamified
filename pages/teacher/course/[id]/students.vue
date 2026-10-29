<script setup lang="ts">
import { courseToForm, formToBody, type CourseFormValue } from '~/utils/courseForm'
import { downloadImportTemplate, parseImportFile } from '~/utils/importData'

const route = useRoute()
const api = useApi()
const id = route.params.id as string

const meta = ref<any>(null)
const course = ref<any>(null)
const roster = ref<any[]>([])
const form = ref<CourseFormValue | null>(null)
const editing = ref(route.query.edit !== undefined) // ?edit=content opens the course form on its content tab
const msg = ref<{ ok: boolean; text: string } | null>(
  route.query.created !== undefined ? { ok: true, text: `สร้างรายวิชาแล้ว · เพิ่มผู้เรียน ${route.query.created} คน` } : null,
)
const busy = ref(false)
const TABS = [{ k: 'group', th: 'ทั้งกลุ่มเรียน' }, { k: 'search', th: 'ค้นหารายคน' }, { k: 'paste', th: 'วางรหัสนักศึกษา' }, { k: 'one', th: 'เพิ่มนักศึกษาใหม่รายคน' }, { k: 'file', th: 'นำเข้าจากไฟล์ Excel/CSV' }] as const
const tab = ref<(typeof TABS)[number]['k']>('group')
const q = ref('')
const qGroup = ref('')
const results = ref<any[]>([])
const pasted = ref('')
const rosterFilter = ref('')

async function load() {
  const res = await api<any>(`/teacher/courses/${id}/students`)
  course.value = res.course
  roster.value = res.students
  if (!editing.value || !form.value) form.value = courseToForm(res.course)
}
const loadError = ref('')
onMounted(async () => {
  try {
    meta.value = await api('/teacher/meta')
    await load()
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})

const inCourse = computed(() => new Set(roster.value.map((s) => s.id)))
const groupsInCourse = computed(() => {
  const m: Record<string, number> = {}
  for (const s of roster.value) m[s.class_group ?? '-'] = (m[s.class_group ?? '-'] ?? 0) + 1
  return m
})
const shownRoster = computed(() => {
  const f = rosterFilter.value.trim().toLowerCase()
  return f ? roster.value.filter((s) => `${s.student_code} ${s.full_name} ${s.class_group ?? ''}`.toLowerCase().includes(f)) : roster.value
})

async function run(fn: () => Promise<void>) {
  busy.value = true
  msg.value = null
  try { await fn() } catch (e) { msg.value = { ok: false, text: apiErrorMessage(e) } } finally { busy.value = false }
}

const addGroup = (g: string) => run(async () => {
  const r = await api<any>(`/teacher/courses/${id}/students`, { method: 'POST', body: { class_groups: [g] } })
  msg.value = { ok: true, text: `เพิ่มกลุ่ม ${g} แล้ว · ใหม่ ${r.added} คน` }
  await load()
})

let timer: ReturnType<typeof setTimeout>
watch([q, qGroup], () => {
  clearTimeout(timer)
  timer = setTimeout(search, 300)
})
async function search() {
  results.value = (await api<any>('/teacher/students', { query: { q: q.value, group: qGroup.value, course: id } })).students
}
const addIds = (ids: number[]) => run(async () => {
  const r = await api<any>(`/teacher/courses/${id}/students`, { method: 'POST', body: { student_ids: ids } })
  msg.value = { ok: true, text: `เพิ่มผู้เรียน ${r.added} คน` }
  await load()
  await search()
})
const notYet = computed(() => results.value.filter((s) => !inCourse.value.has(s.id)))

const addPasted = () => run(async () => {
  const r = await api<any>(`/teacher/courses/${id}/students`, { method: 'POST', body: { codes: pasted.value } })
  msg.value = { ok: !r.not_found.length, text: `เพิ่มผู้เรียน ${r.added} คน${r.not_found.length ? ` · ไม่พบรหัส: ${r.not_found.join(', ')}` : ''}` }
  if (!r.not_found.length) pasted.value = ''
  await load()
})

const removeStudent = (s: any) => {
  if (!confirm(`นำ ${s.full_name} ออกจากรายวิชานี้? (ผลการเล่นเกมของผู้เรียนยังอยู่)`)) return
  run(async () => {
    await api(`/teacher/courses/${id}/students/${s.id}`, { method: 'DELETE' })
    await load()
  })
}

// take several students (or a whole group) out of this course only, e.g. dropped out — accounts stay
const selected = ref<Set<number>>(new Set())
function toggleSel(id: number) {
  const n = new Set(selected.value)
  n.has(id) ? n.delete(id) : n.add(id)
  selected.value = n
}
const allShownSelected = computed(() => shownRoster.value.length > 0 && shownRoster.value.every((s) => selected.value.has(s.id)))
function toggleAllShown() {
  selected.value = allShownSelected.value ? new Set() : new Set(shownRoster.value.map((s) => s.id))
}
const removeSelected = () => {
  if (!confirm(`นำผู้เรียนที่เลือก ${selected.value.size} คน ออกจากรายวิชานี้?
(บัญชีและผลการเล่นเกมยังอยู่ — ถ้าออกกลางคัน/สำเร็จการศึกษา แจ้งผู้ดูแลระบบให้เปลี่ยนสถานะบัญชี)`)) return
  run(async () => {
    const r = await api<any>(`/teacher/courses/${id}/students/remove`, { method: 'POST', body: { student_ids: [...selected.value] } })
    selected.value = new Set()
    msg.value = { ok: true, text: `นำออกจากรายวิชาแล้ว ${r.removed} คน` }
    await load()
  })
}
const removeGroup = (g: string) => {
  if (!confirm(`นำผู้เรียนกลุ่ม ${g} ทั้งหมด (${groupsInCourse.value[g]} คน) ออกจากรายวิชานี้?`)) return
  run(async () => {
    const r = await api<any>(`/teacher/courses/${id}/students/remove`, { method: 'POST', body: { class_group: g } })
    selected.value = new Set()
    msg.value = { ok: true, text: `นำกลุ่ม ${g} ออกจากรายวิชาแล้ว ${r.removed} คน` }
    await load()
  })
}

const resetStudent = (s: any) => {
  if (!confirm(`รีเซ็ตรหัสผ่านของ ${s.full_name}?\nรหัสผ่านชั่วคราว = ${s.student_code} และผู้เรียนต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ`)) return
  run(async () => {
    msg.value = { ok: true, text: (await api<any>(`/teacher/courses/${id}/students/${s.id}/reset-password`, { method: 'POST' })).message }
    await load()
  })
}
const pendingResets = computed(() => roster.value.filter((s) => s.reset_requested).length)

const saveCourse = () => run(async () => {
  await api(`/teacher/courses/${id}`, { method: 'PUT', body: formToBody(form.value!) })
  editing.value = false
  msg.value = { ok: true, text: 'บันทึกข้อมูลรายวิชาแล้ว' }
  await load()
})
// import the course list from a file: new students get accounts, existing ones are only enrolled
const fileRows = ref<Record<string, string>[] | null>(null)
const fileName = ref('')
const filePreview = ref<any>(null)
const fileInput = ref<HTMLInputElement>()
const IMPORT_STATUS: Record<string, { th: string; cls: string }> = {
  new: { th: 'สร้างบัญชี + เพิ่มเข้าวิชา', cls: 'bg-emerald-500/15 text-emerald-300' },
  enroll: { th: 'เพิ่มเข้าวิชา', cls: 'bg-sky-500/15 text-sky-300' },
  enrolled: { th: 'อยู่ในวิชาแล้ว', cls: 'bg-white/10 text-slate-400' },
  error: { th: 'ผิดพลาด', cls: 'bg-red-500/15 text-red-300' },
}
const rosterTemplate = () => run(() => downloadImportTemplate('roster', [
  '5. นักศึกษาที่ยังไม่มีบัญชี ระบบสร้างให้ (แผนกตามรายวิชา · รหัสผ่านเริ่มต้น = รหัสนักศึกษา) แล้วเพิ่มเข้ารายวิชา',
  '6. นักศึกษาที่มีบัญชีอยู่แล้ว ระบบเพิ่มเข้ารายวิชาอย่างเดียว ไม่แก้ไขข้อมูลเดิม',
]))
const pickRoster = (file?: File | null) => file && run(async () => {
  filePreview.value = null
  fileName.value = file.name
  try {
    fileRows.value = (await parseImportFile(file, 'roster')).payload.roster ?? []
    if (!fileRows.value.length) throw new Error('ไม่พบรายชื่อในไฟล์ — ตรวจหัวคอลัมน์ให้มี “รหัสนักศึกษา” และ “ชื่อ-สกุล”')
    filePreview.value = await api<any>(`/teacher/courses/${id}/import/preview`, { method: 'POST', body: { rows: fileRows.value } })
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
})
const commitRoster = () => {
  const s = filePreview.value.summary
  if (!confirm(`ยืนยัน: สร้างบัญชีใหม่ ${s.new} คน และเพิ่มเข้ารายวิชารวม ${s.new + s.enroll} คน?`)) return
  run(async () => {
    const r = await api<any>(`/teacher/courses/${id}/import/commit`, { method: 'POST', body: { rows: fileRows.value } })
    msg.value = { ok: true, text: `นำเข้าแล้ว · สร้างบัญชีใหม่ ${r.created} คน · เพิ่มเข้ารายวิชา ${r.enrolled} คน${r.error ? ` · ข้าม ${r.error} แถวที่ผิดพลาด` : ''}` }
    filePreview.value = null
    fileRows.value = null
    fileName.value = ''
    await load()
  })
}

// one new (or existing) student by hand: same rules as the file import
const one = reactive({ student_code: '', full_name: '', class_group: '' })
const addOne = () => run(async () => {
  const rows = [{ ...one, _row: 'แบบฟอร์ม' }]
  const p = await api<any>(`/teacher/courses/${id}/import/preview`, { method: 'POST', body: { rows } })
  const r0 = p.rows[0]
  if (r0.status === 'error') throw Object.assign(new Error(r0.messages.join(' · ')), { data: { error: r0.messages.join(' · ') } })
  if (r0.status === 'enrolled') { msg.value = { ok: true, text: `${one.student_code} อยู่ในรายวิชานี้แล้ว` }; return }
  const r = await api<any>(`/teacher/courses/${id}/import/commit`, { method: 'POST', body: { rows } })
  msg.value = { ok: true, text: r.created ? `สร้างบัญชี ${one.full_name} (${one.student_code}) และเพิ่มเข้ารายวิชาแล้ว · รหัสผ่านเริ่มต้น = รหัสนักศึกษา` : `${one.student_code} มีบัญชีอยู่แล้ว — เพิ่มเข้ารายวิชาแล้ว (ไม่แก้ข้อมูลเดิม)` }
  Object.assign(one, { student_code: '', full_name: '' })
  await load()
})

const deleteCourse = () => {
  if (!confirm(`ลบรายวิชา ${course.value.code} ${course.value.name} (${course.value.section})?\nรายชื่อ การจัดกลุ่ม และผล AI ของวิชานี้จะถูกลบ — ผลการเล่นเกมของผู้เรียนยังอยู่`)) return
  run(async () => {
    await api(`/teacher/courses/${id}`, { method: 'DELETE' })
    await navigateTo('/teacher')
  })
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <NuxtLink :to="`/teacher/course/${id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แดชบอร์ดรายวิชา</NuxtLink>

    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!course || !meta" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-mono text-xs text-rune-300/80">{{ course.code }} · {{ course.section }} · ภาคเรียน {{ course.semester }}/{{ course.academic_year }}</p>
          <h1 class="title-glow mt-1 text-2xl sm:text-3xl">{{ course.name }}</h1>
          <p class="text-sm text-slate-400">จัดการรายชื่อผู้เรียนและข้อมูลรายวิชา</p>
        </div>
        <NuxtLink :to="`/teacher/course/${id}`" class="btn-primary !py-2 text-sm"><AppIcon name="chart" :size="16" /> ดูแดชบอร์ด ({{ roster.length }} คน)</NuxtLink>
      </header>

      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="msg">{{ msg.text }}</p>

      <!-- course info -->
      <section class="card space-y-4">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-medium text-slate-50">ข้อมูลรายวิชา</h2>
          <button v-if="!editing" class="btn-ghost !py-1.5 text-sm" @click="editing = true"><AppIcon name="quill" :size="16" /> แก้ไข</button>
        </div>
        <template v-if="editing && form">
          <TeacherCourseForm v-model="form" :departments="meta.departments" :initial-step="(['content', 'units'].includes(route.query.edit as string) ? route.query.edit : 'basic') as any" />
          <div class="flex flex-wrap items-center justify-between gap-3">
            <button class="text-sm text-red-300/80 hover:text-red-300" :disabled="busy" @click="deleteCourse">ลบรายวิชานี้</button>
            <div class="flex gap-2">
              <button class="btn-ghost !py-2 text-sm" @click="editing = false; form = courseToForm(course)">ยกเลิก</button>
              <button class="btn-primary !py-2 text-sm" :disabled="busy || !form.code || !form.name" @click="saveCourse">บันทึก</button>
            </div>
          </div>
        </template>
        <p v-else class="text-sm text-slate-300">
          ประเภท {{ { theory: 'ทฤษฎี', practice: 'ปฏิบัติ', mixed: 'ผสม' }[course.course_type as string] }} ·
          ระดับ {{ course.level || '-' }} · แผนก{{ course.department_name || ' -' }} ·
          หน่วยการเรียน {{ JSON.parse(course.topics || '[]').length }} หน่วย
        </p>
      </section>

      <!-- add students -->
      <section class="card space-y-4">
        <h2 class="text-lg font-medium text-slate-50">เพิ่มผู้เรียน</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="t in TABS"
            :key="t.k"
            class="rounded-full px-4 py-1.5 text-sm ring-1 transition"
            :class="tab === t.k ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
            @click="tab = t.k"
          >{{ t.th }}</button>
        </div>

        <div v-if="tab === 'group'" class="flex flex-wrap gap-2">
          <p v-if="!meta.class_groups.length" class="text-sm text-slate-500">ยังไม่มีข้อมูลกลุ่มเรียน — ใช้การค้นหารายคนหรือวางรหัสแทน</p>
          <div v-for="g in meta.class_groups" :key="g.name" class="flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-white/15">
            <div>
              <p class="font-medium text-slate-100">{{ g.name }}</p>
              <p class="text-xs text-slate-400">{{ g.students }} คน · {{ g.department_name ?? '-' }} · อยู่ในวิชาแล้ว {{ groupsInCourse[g.name] ?? 0 }}</p>
            </div>
            <button
              class="btn-ghost !px-3 !py-1.5 text-sm"
              :disabled="busy || (groupsInCourse[g.name] ?? 0) >= g.students"
              :data-testid="`add-group-${g.name}`"
              @click="addGroup(g.name)"
            >{{ (groupsInCourse[g.name] ?? 0) >= g.students ? 'ครบแล้ว' : '+ เพิ่มทั้งกลุ่ม' }}</button>
          </div>
        </div>

        <div v-else-if="tab === 'search'" class="space-y-3">
          <div class="flex flex-wrap gap-2">
            <input v-model="q" class="input !w-72 !py-1.5" placeholder="รหัสนักศึกษา หรือ ชื่อ-สกุล" data-testid="search">
            <select v-model="qGroup" class="input !w-auto !py-1.5">
              <option value="">ทุกกลุ่มเรียน</option>
              <option v-for="g in meta.class_groups" :key="g.name" :value="g.name">{{ g.name }}</option>
            </select>
            <button v-if="notYet.length > 1" class="btn-ghost !py-1.5 text-sm" :disabled="busy" @click="addIds(notYet.map((s) => s.id))">+ เพิ่มทั้งหมดที่แสดง ({{ notYet.length }})</button>
          </div>
          <p v-if="!q && !qGroup" class="text-sm text-slate-500">พิมพ์รหัส/ชื่อ หรือเลือกกลุ่มเรียนเพื่อค้นหา</p>
          <div v-else class="max-h-80 overflow-auto rounded-xl ring-1 ring-white/10">
            <table class="w-full text-sm">
              <tbody>
                <tr v-for="s in results" :key="s.id" class="border-t border-white/5 first:border-0">
                  <td class="px-3 py-2 text-slate-300">{{ s.student_code }}</td>
                  <td class="px-3 py-2 text-slate-100">{{ s.full_name }}</td>
                  <td class="px-3 py-2 text-slate-400">{{ s.class_group ?? '-' }}</td>
                  <td class="px-3 py-2 text-right">
                    <span v-if="inCourse.has(s.id)" class="text-xs text-emerald-300">อยู่ในวิชาแล้ว</span>
                    <button v-else class="text-sm text-rune-300 hover:text-rune-200" :disabled="busy" @click="addIds([s.id])">+ เพิ่ม</button>
                  </td>
                </tr>
                <tr v-if="!results.length"><td class="px-3 py-4 text-center text-slate-500">ไม่พบผู้เรียน</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <form v-else-if="tab === 'one'" class="space-y-3" data-testid="roster-one" @submit.prevent="addOne">
          <p class="text-sm text-slate-400">สำหรับนักศึกษาที่ยังไม่มีในระบบ (เช่น ย้ายมาใหม่) — ระบบสร้างบัญชีให้ (แผนกตามรายวิชา · รหัสผ่านเริ่มต้น = รหัสนักศึกษา) แล้วเพิ่มเข้าวิชานี้ · ถ้ามีบัญชีอยู่แล้วจะเพิ่มเข้าวิชาอย่างเดียว</p>
          <div class="grid gap-3 sm:grid-cols-[1fr_1.6fr_1fr_auto] sm:items-end">
            <div><p class="label">รหัสนักศึกษา *</p><input v-model="one.student_code" class="input" placeholder="เช่น 6901001" data-testid="one-code"></div>
            <div><p class="label">ชื่อ-สกุล *</p><input v-model="one.full_name" class="input" placeholder="เช่น นายกิตติ ใจดี" data-testid="one-name"></div>
            <div><p class="label">กลุ่มเรียน</p><input v-model="one.class_group" class="input" :placeholder="course.section || 'เช่น ปวส.1/1'" data-testid="one-group"></div>
            <button class="btn-primary !py-2.5 text-sm" :disabled="busy || !one.student_code.trim() || !one.full_name.trim()" data-testid="one-save"><AppIcon name="plus" :size="16" /> เพิ่ม</button>
          </div>
        </form>

        <div v-else-if="tab === 'file'" class="space-y-3" data-testid="roster-import">
          <div class="flex flex-wrap items-center gap-3">
            <p class="flex-1 text-sm text-slate-400">ไฟล์มี 3 คอลัมน์: <b class="text-slate-200">รหัสนักศึกษา* · ชื่อ-สกุล* · กลุ่มเรียน</b> — ผู้ที่ยังไม่มีบัญชีระบบสร้างให้ (รหัสผ่านเริ่มต้น = รหัสนักศึกษา) ผู้ที่มีบัญชีแล้วเพิ่มเข้าวิชาอย่างเดียว</p>
            <button class="btn-ghost !py-2 text-sm" :disabled="busy" data-testid="roster-template" @click="rosterTemplate"><AppIcon name="download" :size="16" /> แม่แบบรายชื่อ.xlsx</button>
          </div>
          <label class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-white/15 px-4 py-6 text-center transition hover:border-rune-400/60" @dragover.prevent @drop.prevent="pickRoster($event.dataTransfer?.files?.[0])">
            <AppIcon name="upload" :size="26" class="text-rune-300" />
            <span class="text-slate-200">{{ busy ? 'กำลังอ่านและตรวจสอบ...' : fileName || 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์ (.xlsx / .csv)' }}</span>
            <input ref="fileInput" type="file" accept=".xlsx,.csv" class="hidden" data-testid="roster-file" @change="pickRoster(($event.target as HTMLInputElement).files?.[0])">
          </label>
          <template v-if="filePreview">
            <div class="flex flex-wrap items-center gap-3">
              <p class="flex-1 text-sm text-slate-300">
                {{ filePreview.summary.total }} แถว ·
                <span class="text-emerald-300">สร้างบัญชีใหม่ {{ filePreview.summary.new }}</span> ·
                <span class="text-sky-300">เพิ่มเข้าวิชา {{ filePreview.summary.enroll }}</span> ·
                <span class="text-slate-400">อยู่แล้ว {{ filePreview.summary.enrolled }}</span> ·
                <span :class="filePreview.summary.error ? 'text-red-300' : 'text-slate-400'">ผิดพลาด {{ filePreview.summary.error }}</span>
              </p>
              <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="filePreview = null; fileName = ''">ยกเลิก</button>
              <button class="btn-primary !py-2 text-sm" :disabled="busy || !(filePreview.summary.new + filePreview.summary.enroll)" data-testid="roster-commit" @click="commitRoster">
                <AppIcon name="check" :size="16" /> นำเข้า {{ filePreview.summary.new + filePreview.summary.enroll }} คน
              </button>
            </div>
            <div class="max-h-80 overflow-auto rounded-xl ring-1 ring-white/10">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
                  <tr><th class="px-3 py-2">แถว</th><th class="px-3 py-2">สถานะ</th><th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อ-สกุล</th><th class="px-3 py-2">กลุ่มเรียน</th><th class="px-3 py-2">หมายเหตุ</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in filePreview.rows" :key="r.row" class="border-t border-white/5 align-top" :class="r.status === 'error' && 'bg-red-500/5'">
                    <td class="px-3 py-2 text-slate-500">{{ r.row }}</td>
                    <td class="px-3 py-2"><span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs" :class="IMPORT_STATUS[r.status].cls">{{ IMPORT_STATUS[r.status].th }}</span></td>
                    <td class="px-3 py-2 text-slate-300">{{ r.data.student_code }}</td>
                    <td class="px-3 py-2 text-slate-100">{{ r.data.full_name }}</td>
                    <td class="px-3 py-2 text-slate-300">{{ r.data.class_group || '-' }}</td>
                    <td class="px-3 py-2 text-xs" :class="r.status === 'error' ? 'text-red-300' : 'text-slate-400'">{{ r.messages.join(' · ') }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <div v-else class="space-y-2">
          <textarea v-model="pasted" rows="4" class="input" placeholder="วางรหัสนักศึกษา คั่นด้วยเว้นวรรค จุลภาค หรือขึ้นบรรทัดใหม่ (คัดลอกจากคอลัมน์ Excel ได้เลย)" data-testid="paste" />
          <button class="btn-ghost !py-2 text-sm" :disabled="busy || !pasted.trim()" @click="addPasted">+ เพิ่มตามรหัส</button>
        </div>
      </section>

      <!-- roster -->
      <section class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-medium text-slate-50">ผู้เรียนในรายวิชา <span class="text-sm font-normal text-slate-400">({{ roster.length }} คน)</span></h2>
          <input v-model="rosterFilter" class="input !w-64 !py-1.5" placeholder="กรองรายชื่อ">
        </div>
        <p v-if="pendingResets" class="rounded-xl bg-rune-400/10 px-3 py-2 text-sm text-rune-200">
          <AppIcon name="lock" :size="14" /> ผู้เรียน {{ pendingResets }} คนแจ้งลืมรหัสผ่าน (อยู่บนสุดของรายชื่อ) — กด “รีเซ็ตรหัสผ่าน” แล้วบอกผู้เรียนว่ารหัสชั่วคราวคือรหัสนักศึกษา
        </p>
        <div v-if="roster.length" class="flex flex-wrap items-center gap-2 text-sm" data-testid="roster-tools">
          <span class="text-slate-400">กลุ่มในวิชา:</span>
          <span v-for="(n, g) in groupsInCourse" :key="g" class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-white/15">
            <span class="text-slate-200">{{ g }}</span><span class="text-slate-500">{{ n }} คน</span>
            <button v-if="g !== '-'" class="text-xs text-red-300/80 hover:text-red-300" :disabled="busy" :title="`นำกลุ่ม ${g} ออกจากรายวิชา`" :data-testid="`remove-group-${g}`" @click="removeGroup(String(g))">นำออกทั้งกลุ่ม</button>
          </span>
          <span class="flex-1" />
          <button v-if="selected.size" class="btn-ghost !border-red-400/40 !py-1.5 text-sm !text-red-300" :disabled="busy" data-testid="remove-selected" @click="removeSelected">นำที่เลือกออก ({{ selected.size }} คน)</button>
        </div>
        <p v-if="!roster.length" class="text-sm text-slate-500">ยังไม่มีผู้เรียน — เพิ่มจากด้านบน</p>
        <div v-else class="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
              <tr><th class="w-10 px-3 py-2"><input type="checkbox" :checked="allShownSelected" title="เลือกทั้งหมดที่แสดง" data-testid="sel-all" @change="toggleAllShown"></th><th class="px-3 py-2">ที่</th><th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อ-สกุล</th><th class="px-3 py-2">กลุ่มเรียน</th><th class="px-3 py-2">แผนก</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in shownRoster" :key="s.id" class="border-t border-white/5" :class="selected.has(s.id) && 'bg-rune-400/5'">
                <td class="px-3 py-2"><input type="checkbox" :checked="selected.has(s.id)" :data-testid="`sel-${s.student_code}`" @change="toggleSel(s.id)"></td>
                <td class="px-3 py-2 text-slate-500">{{ i + 1 }}</td>
                <td class="px-3 py-2 text-slate-300">{{ s.student_code }}</td>
                <td class="px-3 py-2 text-slate-100">
                  {{ s.full_name }}
                  <span v-if="s.reset_requested" class="ml-1 rounded-full bg-rune-400/20 px-2 py-0.5 text-xs text-rune-200">ขอรีเซ็ตรหัสผ่าน</span>
                </td>
                <td class="px-3 py-2 text-slate-300">{{ s.class_group ?? '-' }}</td>
                <td class="px-3 py-2 text-slate-400">{{ s.department_name ?? '-' }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-right">
                  <button class="mr-3 text-xs" :class="s.reset_requested ? 'text-rune-200 hover:text-rune-100' : 'text-rune-300/70 hover:text-rune-300'" :disabled="busy" :data-testid="`reset-${s.student_code}`" @click="resetStudent(s)">รีเซ็ตรหัสผ่าน</button>
                  <button class="text-xs text-red-300/80 hover:text-red-300" :disabled="busy" @click="removeStudent(s)">นำออก</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
