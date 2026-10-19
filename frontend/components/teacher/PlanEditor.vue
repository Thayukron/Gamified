<script setup lang="ts">
// Unit lesson plan (form sections 1–10) as a compact accordion. Saves through the API; the parent page owns tabs/export.
import { PLAN_SECTIONS, type PlanContent } from '~/utils/lessonPlan'

const props = defineProps<{ plan: any; learners: any }>()
const emit = defineEmits<{ saved: [plan: any]; dirty: [value: boolean] }>()
const api = useApi()

const header = reactive({ unit_no: 1, session_no: 1, unit_name: '', title: '', hours_theory: 0, hours_practice: 0 })
const content = ref<PlanContent>(JSON.parse(JSON.stringify(props.plan.content)))
Object.assign(header, { unit_no: props.plan.unit_no, session_no: props.plan.session_no, unit_name: props.plan.unit_name, title: props.plan.title, hours_theory: props.plan.hours_theory, hours_practice: props.plan.hours_practice })
const aiModel = ref<string | null>(null)
const dirty = ref(false)
const busy = ref<'' | 'save' | 'ai' | 'guide'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
const editHeader = ref(false)
const showLearners = ref(false)
onMounted(async () => {
  await nextTick()
  dirty.value = false
})
watch([content, header], () => (dirty.value = true), { deep: true })
watch(dirty, (v) => emit('dirty', v))

// accordion spec from the form sections
const sections = computed(() => PLAN_SECTIONS.map((s) => ({
  id: s.no,
  title: `${s.no}. ${s.title}`,
  hint: s.hint,
  badge: s.adaptive ? 'ปรับตามผู้เรียน' : undefined,
  fields: s.fields ? s.fields.map((f) => ({ path: [s.key, f.key], label: f.label, hint: f.hint, rows: f.rows })) : [{ path: [s.key], rows: s.rows }],
})))
const filled = computed(() => sections.value.filter((s) => s.fields.some((f) => String(f.path.reduce((o: any, k) => o?.[k], content.value) ?? '').trim())).length)

const hasText = computed(() => JSON.stringify({ ...content.value, after: {} }).replace(/"[a-z_]+":|[{}",\s]/g, '').length > 0)
async function draft(source: 'ai' | 'guide') {
  if (hasText.value && !confirm(source === 'ai'
    ? 'ให้ AI ร่างแผนใหม่? ข้อความในข้อ 1–9 จะถูกแทนที่ (ข้อ 10 ไม่ถูกแตะ) — ยังไม่บันทึกจนกว่าจะกด “บันทึก”'
    : 'เติมร่างจากไกด์ใหม่? ข้อความในข้อ 1–9 จะถูกแทนที่ (ข้อ 10 ไม่ถูกแตะ)')) return
  busy.value = source
  msg.value = null
  try {
    const r = await api<any>(`/teacher/plans/${props.plan.id}/draft`, { method: 'POST', body: { ...header, source } })
    content.value = { ...r.content, after: content.value.after }
    aiModel.value = r.model
    msg.value = { ok: true, text: source === 'ai' ? `AI (${r.model}) ร่างแล้ว — เปิดดูทีละข้อ แก้ไข แล้วกด “บันทึก”` : 'เติมจากไกด์แล้ว — ตรวจแล้วกด “บันทึก”' }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
  }
}

// section 2: occupational standard (TPQI) looked up by AI — fills the fields, the teacher reviews and saves
const std = ref<{ busy: boolean; result: any; error: string }>({ busy: false, result: null, error: '' })
const STD_SLOT = '2-top' // accordion slot above the fields of section 2
const STD_KEYS = ['occupation', 'sub_competency', 'criteria', 'method', 'performance_evidence', 'knowledge_evidence', 'career_integration'] as const
async function findStandard() {
  const has = STD_KEYS.some((k) => String(content.value.standard[k] ?? '').trim())
  if (has && !confirm('ค้นหามาตรฐานอาชีพใหม่? ถ้าพบ ข้อความในข้อ 2 จะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกด “บันทึก”)')) return
  std.value = { busy: true, result: null, error: '' }
  try {
    const r = await api<any>(`/teacher/plans/${props.plan.id}/standard`, { method: 'POST', body: { ...header, competency: content.value.competency } })
    if (r.found) content.value.standard = { ...content.value.standard, ...r.standard }
    std.value = { busy: false, result: r, error: '' }
  } catch (e) {
    std.value = { busy: false, result: null, error: apiErrorMessage(e) }
  }
}

async function save() {
  busy.value = 'save'
  msg.value = null
  try {
    const r = await api<any>(`/teacher/plans/${props.plan.id}`, { method: 'PUT', body: { ...header, content: content.value, ai_model: aiModel.value } })
    aiModel.value = null
    emit('saved', r.plan)
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: `บันทึกแล้ว · ครบ ${r.plan.completeness}%` }
    return true
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
    return false
  } finally {
    busy.value = ''
  }
}
defineExpose({ save, isDirty: () => dirty.value })
</script>

<template>
  <div class="space-y-3">
    <!-- action bar -->
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="ai-draft" @click="draft('ai')">
        <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังร่าง… (30–60 วินาที)' : 'ให้ AI ร่างแผน' }}
      </button>
      <button class="btn-ghost !py-2 text-sm" :disabled="!!busy" data-testid="guide-draft" @click="draft('guide')">เติมจากไกด์</button>
      <span class="flex-1" />
      <span class="text-xs text-slate-400">กรอกแล้ว {{ filled }}/{{ sections.length }} ข้อ</span>
      <button class="btn-primary !py-2 text-sm" :disabled="!!busy || !dirty" data-testid="save" @click="save">
        <AppIcon name="check" :size="16" /> {{ dirty ? 'บันทึก' : 'บันทึกแล้ว' }}
      </button>
    </div>
    <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="msg">{{ msg.text }}</p>

    <!-- compact header -->
    <div class="rounded-xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="text-slate-300">หน่วยที่ <b class="text-slate-100">{{ header.unit_no }}</b> · ครั้งที่ <b class="text-slate-100">{{ header.session_no }}</b></span>
        <span class="text-slate-300">เรื่อง <b class="text-slate-100">{{ header.title || header.unit_name }}</b></span>
        <span class="text-slate-400">ท {{ header.hours_theory }} · ป {{ header.hours_practice }} ชม.</span>
        <span class="flex-1" />
        <button class="text-xs text-sky-300 hover:text-sky-200" data-testid="edit-header" @click="editHeader = !editHeader">{{ editHeader ? 'ปิด' : 'แก้ไขหัวแผน' }}</button>
        <button v-if="learners?.ready" class="text-xs text-sky-300 hover:text-sky-200" @click="showLearners = !showLearners">{{ showLearners ? 'ซ่อนข้อมูลผู้เรียน' : 'ดูข้อมูลผู้เรียนห้องนี้' }}</button>
      </div>
      <div v-if="editHeader" class="mt-3 grid gap-3 pb-1 sm:grid-cols-6">
        <div><p class="label">หน่วยที่</p><input v-model.number="header.unit_no" type="number" min="1" class="input"></div>
        <div><p class="label">สอนครั้งที่</p><input v-model.number="header.session_no" type="number" min="1" class="input"></div>
        <div class="sm:col-span-4"><p class="label">ชื่อหน่วยการเรียนรู้</p><input v-model="header.unit_name" class="input"></div>
        <div class="sm:col-span-4"><p class="label">ชื่อเรื่อง/งาน</p><input v-model="header.title" class="input"></div>
        <div><p class="label">ทฤษฎี (ชม.)</p><input v-model.number="header.hours_theory" type="number" min="0" step="0.5" class="input"></div>
        <div><p class="label">ปฏิบัติ (ชม.)</p><input v-model.number="header.hours_practice" type="number" min="0" step="0.5" class="input"></div>
      </div>
      <div v-if="showLearners && learners?.ready" class="mt-2 space-y-1 border-t border-white/10 pt-2 text-xs text-slate-400">
        <p>วิเคราะห์แล้ว {{ learners.profiled }}/{{ learners.enrolled }} คน · {{ learners.vark.map((v: any) => `${v.label} ${v.pct}%`).join(' · ') }}</p>
        <p>Mindset: Growth {{ learners.mindset.growth }} · Mixed {{ learners.mindset.mixed }} · Fixed {{ learners.mindset.fixed }} คน</p>
        <p v-for="s in learners.summary" :key="s">• {{ s }}</p>
      </div>
    </div>

    <TeacherSectionAccordion v-model="content" :sections="sections">
      <template #[STD_SLOT]>
        <div class="rounded-xl bg-indigo-500/5 p-3 ring-1 ring-rune-400/20" data-testid="std-box">
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="btn-ghost !py-1.5 text-sm" :disabled="std.busy || !!busy" data-testid="std-find" @click="findStandard">
              <AppIcon name="sparkle" :size="16" /> {{ std.busy ? 'AI กำลังค้นหามาตรฐานอาชีพ… (20–60 วินาที)' : 'ค้นหามาตรฐานอาชีพ (TPQI) ด้วย AI' }}
            </button>
            <p class="flex-1 text-xs text-slate-400">ค้นจากมาตรฐานอาชีพของสถาบันคุณวุฒิวิชาชีพที่สอดคล้องกับหน่วยนี้ · ถ้าไม่พบ ระบบจะไม่ใส่ข้อมูล (เว้นข้อ 2.1 ได้ตามแบบฟอร์ม)</p>
          </div>
          <p v-if="std.error" class="mt-2 text-sm text-red-300">{{ std.error }}</p>
          <div v-else-if="std.result" class="mt-3 space-y-2 text-sm" data-testid="std-result">
            <p v-if="std.result.found" class="text-emerald-300"><AppIcon name="check" :size="14" class="inline" /> พบมาตรฐานที่สอดคล้อง และใส่ในช่องด้านล่างแล้ว — ตรวจแล้วกด “บันทึก”</p>
            <p v-else class="text-slate-300">ไม่พบมาตรฐานอาชีพที่สอดคล้องกับหน่วยนี้โดยตรง — ไม่ได้ใส่ข้อมูล (เว้นว่างไว้)</p>
            <p v-if="std.result.note" class="text-xs text-slate-400">เหตุผล: {{ std.result.note }}</p>
            <p v-if="std.result.found && !std.result.grounded" class="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200" data-testid="std-unverified">
              ⚠ API Key นี้ใช้การค้นหา Google ไม่ได้ (ต้องเปิดการเรียกเก็บเงินของ Google AI) ข้อมูลนี้มาจากความรู้ของ AI จึง <b>ต้องตรวจกับเว็บไซต์สถาบันคุณวุฒิวิชาชีพก่อนใช้</b> ·
              <a href="https://tpqi-net.tpqi.go.th/" target="_blank" rel="noopener" class="underline">tpqi-net.tpqi.go.th</a>
            </p>
            <ul v-if="std.result.sources?.length" class="space-y-0.5 text-xs">
              <li class="text-slate-500">แหล่งที่ค้นพบ:</li>
              <li v-for="s in std.result.sources" :key="s.url"><a :href="s.url" target="_blank" rel="noopener" class="text-rune-300 underline">{{ s.title || s.url }}</a></li>
            </ul>
          </div>
        </div>
      </template>
    </TeacherSectionAccordion>
  </div>
</template>
