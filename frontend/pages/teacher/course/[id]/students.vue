<script setup lang="ts">
import { courseToForm, formToBody, type CourseFormValue } from '~/utils/courseForm'

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
const TABS = [{ k: 'group', th: 'ทั้งกลุ่มเรียน' }, { k: 'search', th: 'ค้นหารายคน' }, { k: 'paste', th: 'วางรหัสนักศึกษา' }] as const
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
          <TeacherCourseForm v-model="form" :departments="meta.departments" :initial-step="route.query.edit === 'content' ? 'content' : 'basic'" />
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
        <p v-if="!roster.length" class="text-sm text-slate-500">ยังไม่มีผู้เรียน — เพิ่มจากด้านบน</p>
        <div v-else class="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
              <tr><th class="px-3 py-2">ที่</th><th class="px-3 py-2">รหัส</th><th class="px-3 py-2">ชื่อ-สกุล</th><th class="px-3 py-2">กลุ่มเรียน</th><th class="px-3 py-2">แผนก</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in shownRoster" :key="s.id" class="border-t border-white/5">
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
