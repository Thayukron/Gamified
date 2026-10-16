<script setup lang="ts">
// Unit workspace: every form of one unit/session in tabs (review one form at a time),
// exported together as ONE Word file with a picker for which forms to include.
import { SHEET_ORDER, SHEET_TYPES, type ExportGroup, type Sheet, type SheetType } from '~/utils/lessonPlan'
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const router = useRouter()
const api = useApi()
const id = route.params.id as string
const pid = route.params.pid as string

const data = ref<any>(null)
const loadError = ref('')
const tab = ref<string>((route.query.tab as string) || 'plan')
const dirty = ref(false)
const editor = ref<any>(null)
const addOpen = ref(false)
const exportOpen = ref(false)
const exporting = ref(false)

async function load() {
  data.value = await api(`/teacher/plans/${pid}`)
}
onMounted(() => load().catch((e) => (loadError.value = apiErrorMessage(e))))

const sheets = computed<Sheet[]>(() => data.value?.plan.sheets ?? [])
const tabs = computed(() => [
  { key: 'plan', label: 'แผนการจัดการเรียนรู้', pct: data.value?.plan.completeness ?? 0 },
  ...sheets.value.map((s) => ({ key: `s${s.id}`, label: `${s.type_th} ${s.number}`, pct: s.completeness })),
])
const activeSheet = computed(() => sheets.value.find((s) => `s${s.id}` === tab.value) ?? null)

/** leaving a tab with unsaved changes: offer to save first */
async function guard(): Promise<boolean> {
  if (!dirty.value) return true
  if (confirm('มีการแก้ไขที่ยังไม่บันทึก — บันทึกก่อนไหม?\n(OK = บันทึก · Cancel = อยู่หน้านี้ต่อ)')) {
    return !!(await editor.value?.save())
  }
  return false
}
async function go(key: string) {
  if (key === tab.value || !(await guard())) return
  dirty.value = false
  tab.value = key
  router.replace({ query: { tab: key } })
}

async function addSheet(type: SheetType) {
  addOpen.value = false
  if (!(await guard())) return
  const r = await api<any>(`/teacher/plans/${pid}/sheets`, { method: 'POST', body: { type } })
  await load()
  dirty.value = false
  tab.value = `s${r.id}`
  router.replace({ query: { tab: tab.value } })
}

function onPlanSaved(plan: any) {
  data.value.plan = { ...plan, sheets: data.value.plan.sheets }
}
function onSheetSaved(s: Sheet) {
  data.value.plan.sheets = data.value.plan.sheets.map((x: Sheet) => (x.id === s.id ? s : x))
}
function onSheetRemoved() {
  const gone = tab.value
  data.value.plan.sheets = data.value.plan.sheets.filter((x: Sheet) => `s${x.id}` !== gone)
  dirty.value = false
  tab.value = 'plan'
  router.replace({ query: { tab: 'plan' } })
}

// ---- export: one Word file for the unit, pick forms
const exportGroups = computed<ExportGroup[]>(() => [
  {
    title: `หน่วยที่ ${data.value.plan.unit_no} · สอนครั้งที่ ${data.value.plan.session_no}`,
    items: [
      { key: 'plan', label: 'แผนการจัดการเรียนรู้ (ข้อ 1–10)', checked: true },
      ...sheets.value.map((s) => ({ key: `sheet:${s.id}`, label: `${s.type_th}ที่ ${s.number}`, hint: s.title, checked: true })),
    ],
  },
  { title: 'ท้ายไฟล์', items: [{ key: 'appendix', label: 'ภาคผนวก: ผลการวิเคราะห์ผู้เรียน', hint: 'สถิติรวมของห้อง ไม่ระบุชื่อ', checked: true, disabled: !data.value.learners?.ready }] },
])
async function openExport() {
  if (await guard()) exportOpen.value = true
}
async function doExport(keys: string[]) {
  exporting.value = true
  try {
    await load() // export what is saved
    const p = data.value.plan
    await exportLessonPlansDocx({
      course: data.value.course,
      plans: [p],
      learners: data.value.learners,
      include: new Set([...keys, ...(keys.some((k) => k.startsWith('sheet:')) ? [] : ['sheet:none'])]),
      filename: `หน่วย${p.unit_no}-ครั้ง${p.session_no}-${data.value.course.code}.docx`,
    })
    exportOpen.value = false
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4">
    <NuxtLink :to="`/teacher/course/${id}/plans`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> หน่วยการเรียนทั้งหมด</NuxtLink>
    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} {{ data.course.name }}</p>
          <h1 class="title-glow mt-1 text-2xl">หน่วยที่ {{ data.plan.unit_no }} · {{ data.plan.title || data.plan.unit_name }}</h1>
          <p class="text-sm text-slate-400">สอนครั้งที่ {{ data.plan.session_no }} · ตรวจทีละฟอร์มด้วยแท็บด้านล่าง แล้วส่งออกรวมเป็นไฟล์เดียว</p>
        </div>
        <button class="btn-primary !py-2 text-sm" data-testid="unit-export" @click="openExport"><AppIcon name="download" :size="16" /> ส่งออก Word (เลือกฟอร์ม)</button>
      </header>

      <!-- form tabs -->
      <nav class="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3" data-testid="form-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="rounded-full px-4 py-1.5 text-sm ring-1 transition"
          :class="tab === t.key ? 'bg-rune-400/20 text-rune-100 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
          :data-testid="`tab-${t.key}`"
          @click="go(t.key)"
        >
          {{ t.label }} <span class="ml-1 text-xs" :class="t.pct >= 100 ? 'text-emerald-300' : 'text-slate-500'">{{ t.pct }}%</span>
        </button>
        <div class="relative">
          <button class="rounded-full px-4 py-1.5 text-sm text-rune-300 ring-1 ring-dashed ring-rune-400/40 hover:bg-rune-400/10" data-testid="add-form" @click="addOpen = !addOpen">+ เพิ่มเอกสารประกอบ</button>
          <div v-if="addOpen" class="absolute left-0 top-10 z-20 w-72 rounded-xl border border-white/10 bg-abyss-900 p-1 shadow-xl">
            <button v-for="t in SHEET_ORDER" :key="t" class="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/5" :data-testid="`add-sheet-${t}`" @click="addSheet(t)">
              <span class="text-sm text-slate-100">{{ SHEET_TYPES[t].th }}</span>
              <span class="block text-xs text-slate-500">{{ SHEET_TYPES[t].desc }}</span>
            </button>
          </div>
        </div>
      </nav>

      <TeacherPlanEditor v-if="tab === 'plan'" :key="'plan'" ref="editor" :plan="data.plan" :learners="data.learners" @saved="onPlanSaved" @dirty="dirty = $event" />
      <TeacherSheetEditor v-else-if="activeSheet" :key="tab" ref="editor" :sheet="activeSheet" @saved="onSheetSaved" @dirty="dirty = $event" @removed="onSheetRemoved" />

      <TeacherExportDialog v-if="exportOpen" :title="`ส่งออกหน่วยที่ ${data.plan.unit_no}`" :groups="exportGroups" :busy="exporting" @close="exportOpen = false" @export="doExport" />
    </template>
  </div>
</template>
