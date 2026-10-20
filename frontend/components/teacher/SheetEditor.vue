<script setup lang="ts">
// One supporting sheet (ใบความรู้ ใบงาน ใบกิจกรรม ใบมอบหมายงาน แบบประเมิน) as a compact accordion.
import { SHEET_TYPES, type Sheet } from '~/utils/lessonPlan'

const props = defineProps<{ sheet: Sheet }>()
const emit = defineEmits<{ saved: [sheet: Sheet]; dirty: [value: boolean]; removed: [] }>()
const api = useApi()
const aiApi = useAiApi() // long AI calls run as background jobs (no Cloudflare 524)

const spec = SHEET_TYPES[props.sheet.type]
const header = reactive({ number: props.sheet.number, title: props.sheet.title })
const content = ref<Record<string, any>>(JSON.parse(JSON.stringify(props.sheet.content)))
const aiModel = ref<string | null>(null)
const dirty = ref(false)
const busy = ref<'' | 'save' | 'ai' | 'plan'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
onMounted(async () => {
  await nextTick()
  dirty.value = false
})
watch([content, header], () => (dirty.value = true), { deep: true })
watch(dirty, (v) => emit('dirty', v))

const sections = computed(() => [
  ...spec.sections.map((s) => ({
    id: s.key,
    title: `${s.no}. ${s.title}`,
    hint: [s.hint, s.numbered ? `1 บรรทัด = 1 ข้อ (ระบบใส่เลข ${s.no}.1, ${s.no}.2 … ให้)` : '', s.pageBreak ? 'ขึ้นหน้าใหม่ในไฟล์ Word ตามแบบฟอร์ม' : ''].filter(Boolean).join(' · '),
    fields: [{ path: [s.key], rows: s.rows }],
  })),
  ...(props.sheet.type === 'assessment' ? [{ id: 'rubric', title: '3. รายการประเมินและเกณฑ์การให้คะแนน (Rubric)', hint: '1 แถว = 1 รายการ ควรสอดคล้องกับจุดประสงค์ของแผน', fields: [], summary: `${content.value.rubric?.length ?? 0} รายการประเมิน` }] : []),
])

async function draft(source: 'ai' | 'plan') {
  if (!confirm(source === 'ai' ? 'ให้ AI ร่างเอกสารนี้ใหม่? ข้อความเดิมจะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกด “บันทึก”)' : 'เติมจากแผนใหม่? ข้อความเดิมจะถูกแทนที่')) return
  busy.value = source
  msg.value = null
  try {
    const r = await aiApi<any>(`/teacher/sheets/${props.sheet.id}/draft`, { method: 'POST', body: { ...header, source } })
    content.value = r.content
    aiModel.value = r.model
    msg.value = { ok: true, text: source === 'ai' ? `AI (${r.model}) ร่างแล้ว — ตรวจแล้วกด “บันทึก”` : 'เติมจากแผนแล้ว — ตรวจแล้วกด “บันทึก”' }
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
    const r = await api<any>(`/teacher/sheets/${props.sheet.id}`, { method: 'PUT', body: { ...header, content: content.value, ai_model: aiModel.value } })
    aiModel.value = null
    emit('saved', r.sheet)
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: `บันทึกแล้ว · ครบ ${r.sheet.completeness}%` }
    return true
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
    return false
  } finally {
    busy.value = ''
  }
}
async function remove() {
  if (!confirm(`ลบ${spec.th}ที่ ${header.number}?`)) return
  await api(`/teacher/sheets/${props.sheet.id}`, { method: 'DELETE' })
  emit('removed')
}
defineExpose({ save, isDirty: () => dirty.value })

const rubricCols = [
  { key: 'item', label: 'รายการประเมิน', width: '24%', multiline: true },
  { key: 'l4', label: '4 ดีมาก', multiline: true },
  { key: 'l3', label: '3 ดี', multiline: true },
  { key: 'l2', label: '2 พอใช้', multiline: true },
  { key: 'l1', label: '1 ปรับปรุง', multiline: true },
]
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-2">
      <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="sheet-ai" @click="draft('ai')">
        <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังเขียน… (30–60 วินาที)' : `ให้ AI ร่าง${spec.th}` }}
      </button>
      <button class="btn-ghost !py-2 text-sm" :disabled="!!busy" @click="draft('plan')">เติมจากแผน</button>
      <span class="flex-1" />
      <button class="text-xs text-red-300/70 hover:text-red-300" @click="remove">ลบเอกสารนี้</button>
      <button class="btn-primary !py-2 text-sm" :disabled="!!busy || !dirty" data-testid="sheet-save" @click="save">
        <AppIcon name="check" :size="16" /> {{ dirty ? 'บันทึก' : 'บันทึกแล้ว' }}
      </button>
    </div>
    <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="sheet-msg">{{ msg.text }}</p>

    <div class="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 px-4 py-2 text-sm ring-1 ring-white/10">
      <label class="flex items-center gap-2 text-slate-300">{{ spec.th }}ที่ <input v-model="header.number" class="input !w-20 !py-1"></label>
      <label class="flex flex-1 items-center gap-2 text-slate-300">{{ spec.nameLabel }} <input v-model="header.title" class="input !py-1"></label>
    </div>

    <TeacherSectionAccordion v-model="content" :sections="sections">
      <template #rubric>
        <TeacherRowTable v-model="content.rubric" :columns="rubricCols" add-label="เพิ่มรายการประเมิน" />
      </template>
    </TeacherSectionAccordion>
  </div>
</template>
