<script setup lang="ts">
import { PLAN_SECTIONS, SHEET_ORDER, SHEET_TYPES, type PlanContent, type Sheet, type SheetType } from '~/utils/lessonPlan'
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const api = useApi()
const id = route.params.id as string
const pid = route.params.pid as string

const data = ref<any>(null)
const header = reactive({ unit_no: 1, session_no: 1, unit_name: '', title: '', hours_theory: 0, hours_practice: 0 })
const content = ref<PlanContent | null>(null)
const aiModel = ref<string | null>(null)
const dirty = ref(false)
const busy = ref<'' | 'save' | 'ai' | 'guide' | 'word'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
const loadError = ref('')

function apply(plan: any) {
  Object.assign(header, { unit_no: plan.unit_no, session_no: plan.session_no, unit_name: plan.unit_name, title: plan.title, hours_theory: plan.hours_theory, hours_practice: plan.hours_practice })
  content.value = JSON.parse(JSON.stringify(plan.content))
}
onMounted(async () => {
  try {
    data.value = await api(`/teacher/plans/${pid}`)
    apply(data.value.plan)
    await nextTick()
    dirty.value = false
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})
watch([content, header], () => (dirty.value = true), { deep: true })

const hasText = computed(() => !!content.value && JSON.stringify({ ...content.value, after: {} }).replace(/"[a-z_]+":|[{}",\s]/g, '').length > 0)

async function draft(source: 'ai' | 'guide') {
  if (hasText.value && !confirm(source === 'ai'
    ? 'ให้ AI ร่างแผนใหม่ทั้งหมด? ข้อความในข้อ 1–9 จะถูกแทนที่ (ข้อ 10 บันทึกหลังสอนไม่ถูกแตะ) — ยังไม่บันทึกจนกว่าจะกด “บันทึก”'
    : 'เติมร่างจากไกด์ใหม่? ข้อความในข้อ 1–9 จะถูกแทนที่ (ข้อ 10 ไม่ถูกแตะ)')) return
  busy.value = source
  msg.value = null
  try {
    const r = await api<any>(`/teacher/plans/${pid}/draft`, { method: 'POST', body: { ...header, source } })
    const after = content.value!.after
    content.value = { ...r.content, after }
    aiModel.value = r.model
    msg.value = { ok: true, text: source === 'ai' ? `AI (${r.model}) ร่างแผนแล้ว — ตรวจ แก้ไข แล้วกด “บันทึก”` : 'เติมร่างจากไกด์แล้ว — ตรวจ แก้ไข แล้วกด “บันทึก”' }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
  }
}

async function save() {
  busy.value = 'save'
  msg.value = null
  try {
    const r = await api<any>(`/teacher/plans/${pid}`, { method: 'PUT', body: { ...header, content: content.value, ai_model: aiModel.value } })
    data.value.plan = r.plan
    aiModel.value = null
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: `บันทึกแล้ว · ความครบถ้วน ${r.plan.completeness}%` }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
  }
}

async function word() {
  if (dirty.value) await save()
  if (dirty.value) return
  busy.value = 'word'
  try {
    await exportLessonPlansDocx({
      course: data.value.course,
      plans: [{ ...header, content: content.value!, sheets: sheets.value }],
      learners: data.value.learners,
      filename: `แผนการจัดการเรียนรู้-${data.value.course.code}-หน่วย${header.unit_no}-ครั้ง${header.session_no}.docx`,
    })
  } finally {
    busy.value = ''
  }
}

const L = computed(() => data.value?.learners)

// ---- supporting sheets (ใบความรู้ ใบงาน ใบกิจกรรม ใบมอบหมายงาน แบบประเมิน)
const sheets = computed<Sheet[]>(() => data.value?.plan.sheets ?? [])
async function addSheet(type: SheetType) {
  if (dirty.value) await save()
  const r = await api<any>(`/teacher/plans/${pid}/sheets`, { method: 'POST', body: { type } })
  await navigateTo(`/teacher/course/${id}/plans/${pid}/sheets/${r.id}`)
}
async function removeSheet(s: Sheet) {
  if (!confirm(`ลบ${s.type_th}ที่ ${s.number} “${s.title}”?`)) return
  await api(`/teacher/sheets/${s.id}`, { method: 'DELETE' })
  data.value.plan.sheets = data.value.plan.sheets.filter((x: Sheet) => x.id !== s.id)
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <NuxtLink :to="`/teacher/course/${id}/plans`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แผนการจัดการเรียนรู้ทั้งหมด</NuxtLink>
    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!data || !content" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header>
        <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} {{ data.course.name }} · {{ data.course.section }}</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">หน่วยที่ {{ header.unit_no }} · {{ header.title || header.unit_name }}</h1>
      </header>

      <!-- sticky actions -->
      <div class="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-abyss-900/90 px-4 py-3 backdrop-blur">
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="ai-draft" @click="draft('ai')">
          <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังร่างแผน… (30–60 วินาที)' : 'ให้ AI ร่างแผน' }}
        </button>
        <button class="btn-ghost !py-2 text-sm" :disabled="!!busy" data-testid="guide-draft" @click="draft('guide')">เติมจากไกด์ (ไม่ใช้ AI)</button>
        <span class="flex-1" />
        <span class="text-xs" :class="dirty ? 'text-rune-300' : 'text-slate-500'">{{ dirty ? '● ยังไม่ได้บันทึก' : 'บันทึกแล้ว' }}</span>
        <button class="btn-ghost !py-2 text-sm" :disabled="!!busy || !dirty" data-testid="save" @click="save"><AppIcon name="check" :size="16" /> บันทึก</button>
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="word" @click="word"><AppIcon name="download" :size="16" /> ดาวน์โหลด Word</button>
      </div>
      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="msg">{{ msg.text }}</p>

      <div class="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div class="space-y-4">
          <!-- header of the form -->
          <section class="card">
            <h2 class="mb-3 font-medium text-slate-50">หัวแผน</h2>
            <div class="grid gap-3 sm:grid-cols-6">
              <div><p class="label">หน่วยที่</p><input v-model.number="header.unit_no" type="number" min="1" class="input"></div>
              <div><p class="label">สอนครั้งที่</p><input v-model.number="header.session_no" type="number" min="1" class="input"></div>
              <div class="sm:col-span-4"><p class="label">ชื่อหน่วยการเรียนรู้</p><input v-model="header.unit_name" class="input"></div>
              <div class="sm:col-span-4"><p class="label">ชื่อเรื่อง/งาน</p><input v-model="header.title" class="input"></div>
              <div><p class="label">ทฤษฎี (ชม.)</p><input v-model.number="header.hours_theory" type="number" min="0" step="0.5" class="input"></div>
              <div><p class="label">ปฏิบัติ (ชม.)</p><input v-model.number="header.hours_practice" type="number" min="0" step="0.5" class="input"></div>
            </div>
          </section>

          <!-- sections 1–10 -->
          <section v-for="s in PLAN_SECTIONS" :key="s.no" class="card" :class="s.adaptive && 'border-sky-400/30'" :data-testid="`sec-${s.no}`">
            <div class="flex flex-wrap items-baseline gap-2">
              <h2 class="font-medium text-slate-50">{{ s.no }}. {{ s.title }}</h2>
              <span v-if="s.adaptive" class="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">ปรับตามผู้เรียน</span>
            </div>
            <p class="mb-3 mt-1 text-xs text-slate-500">{{ s.hint }}</p>
            <textarea v-if="!s.fields" v-model="(content as any)[s.key]" :rows="s.rows ?? 3" class="input leading-relaxed" />
            <div v-else class="space-y-3">
              <div v-for="f in s.fields" :key="f.key">
                <p class="label">{{ f.label }}<span v-if="f.hint" class="ml-2 normal-case tracking-normal text-slate-500">— {{ f.hint }}</span></p>
                <textarea v-model="(content as any)[s.key][f.key]" :rows="f.rows ?? 2" class="input leading-relaxed" />
              </div>
            </div>
          </section>

          <!-- supporting sheets -->
          <section class="card space-y-3 border-rune-400/30" data-testid="sheets">
            <h2 class="font-medium text-slate-50">เอกสารประกอบแผน</h2>
            <p class="text-xs text-slate-500">สร้างแล้วระบบเติมข้อ 1–4 จากแผนนี้ให้ · ใช้ AI ร่างเนื้อหา/ขั้นตอน/แบบฝึกหัด/Rubric ได้ · รวมอยู่ในไฟล์ Word ต่อท้ายแผนตามลำดับในแบบฟอร์ม</p>
            <div v-if="sheets.length" class="divide-y divide-white/5 rounded-xl ring-1 ring-white/10">
              <div v-for="s in sheets" :key="s.id" class="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <NuxtLink :to="`/teacher/course/${id}/plans/${pid}/sheets/${s.id}`" class="flex-1 text-slate-100 hover:text-rune-200">
                  {{ s.type_th }}ที่ {{ s.number }} <span class="text-slate-400">· {{ s.title }}</span>
                </NuxtLink>
                <span class="text-xs text-slate-400">{{ s.completeness }}%</span>
                <span v-if="s.ai_model" class="rounded-full bg-sky-500/15 px-2 text-xs text-sky-300">AI</span>
                <button class="text-xs text-red-300/80 hover:text-red-300" @click="removeSheet(s)">ลบ</button>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in SHEET_ORDER"
                :key="t"
                class="btn-ghost !px-3 !py-1.5 text-sm"
                :title="SHEET_TYPES[t].desc"
                :data-testid="`add-sheet-${t}`"
                @click="addSheet(t)"
              >+ {{ SHEET_TYPES[t].th }}</button>
            </div>
          </section>
        </div>

        <!-- learner analysis for reference -->
        <aside class="space-y-4">
          <section class="card sticky top-36 space-y-3 !p-4">
            <h2 class="font-medium text-slate-50">ผู้เรียนห้องนี้</h2>
            <template v-if="L.ready">
              <p class="text-xs text-slate-400">วิเคราะห์แล้ว {{ L.profiled }}/{{ L.enrolled }} คน · ใช้ปรับข้อ 6, 6.5, 7 และแนบเป็นภาคผนวกในไฟล์ Word</p>
              <div v-for="v in L.vark" :key="v.key" class="text-xs">
                <div class="flex justify-between text-slate-300"><span>{{ v.label }}</span><span>{{ v.pct }}%</span></div>
                <div class="mt-0.5 h-1.5 rounded-full bg-white/10"><div class="h-full rounded-full bg-[#3987e5]" :style="{ width: v.pct + '%' }" /></div>
              </div>
              <p class="text-xs text-slate-300">ความสนใจเด่น: {{ L.riasec.slice(0, 2).map((r: any) => r.label).join(', ') }}</p>
              <p class="text-xs text-slate-300">Mindset: Growth {{ L.mindset.growth }} · Mixed {{ L.mindset.mixed }} · Fixed {{ L.mindset.fixed }} คน</p>
              <ul class="space-y-1 border-t border-white/10 pt-2 text-xs text-slate-400">
                <li v-for="s in L.summary" :key="s">• {{ s }}</li>
              </ul>
            </template>
            <p v-else class="text-xs text-slate-500">ยังไม่มีผู้เรียนในรายวิชานี้เล่นเกม — ระบบจะร่างแผนแบบทั่วไป</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>
