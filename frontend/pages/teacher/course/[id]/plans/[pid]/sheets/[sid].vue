<script setup lang="ts">
import { SHEET_TYPES } from '~/utils/lessonPlan'
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const api = useApi()
const { id, pid, sid } = route.params as Record<string, string>

const data = ref<any>(null)
const header = reactive({ number: '', title: '' })
const content = ref<Record<string, any> | null>(null)
const aiModel = ref<string | null>(null)
const dirty = ref(false)
const busy = ref<'' | 'save' | 'ai' | 'plan' | 'word'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
const loadError = ref('')

const spec = computed(() => (data.value ? SHEET_TYPES[data.value.sheet.type as keyof typeof SHEET_TYPES] : null))

onMounted(async () => {
  try {
    data.value = await api(`/teacher/sheets/${sid}`)
    Object.assign(header, { number: data.value.sheet.number, title: data.value.sheet.title })
    content.value = JSON.parse(JSON.stringify(data.value.sheet.content))
    await nextTick()
    dirty.value = false
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})
watch([content, header], () => (dirty.value = true), { deep: true })

async function draft(source: 'ai' | 'plan') {
  if (!confirm(source === 'ai' ? 'ให้ AI ร่างเอกสารนี้ใหม่ทั้งหมด? ข้อความเดิมจะถูกแทนที่ (ยังไม่บันทึกจนกว่าจะกด “บันทึก”)' : 'เติมจากแผนใหม่? ข้อความเดิมจะถูกแทนที่')) return
  busy.value = source
  msg.value = null
  try {
    const r = await api<any>(`/teacher/sheets/${sid}/draft`, { method: 'POST', body: { ...header, source } })
    content.value = r.content
    aiModel.value = r.model
    msg.value = { ok: true, text: source === 'ai' ? `AI (${r.model}) ร่างแล้ว — ตรวจ แก้ไข แล้วกด “บันทึก”` : 'เติมจากแผนแล้ว — ตรวจ แก้ไข แล้วกด “บันทึก”' }
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
    const r = await api<any>(`/teacher/sheets/${sid}`, { method: 'PUT', body: { ...header, content: content.value, ai_model: aiModel.value } })
    data.value.sheet = r.sheet
    aiModel.value = null
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: `บันทึกแล้ว · ความครบถ้วน ${r.sheet.completeness}%` }
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
    const s = data.value.sheet
    await exportLessonPlansDocx({
      course: data.value.course,
      plans: [{ ...data.value.plan, sheets: [{ ...s, ...header, content: content.value }] }],
      learners: null,
      sheetsOnly: true,
      filename: `${s.type_th}ที่${header.number}-${data.value.course.code}.docx`,
    })
  } finally {
    busy.value = ''
  }
}

const rubricCols = [
  { key: 'item', label: 'รายการประเมิน', width: '24%', multiline: true },
  { key: 'l4', label: '4 ดีมาก', multiline: true },
  { key: 'l3', label: '3 ดี', multiline: true },
  { key: 'l2', label: '2 พอใช้', multiline: true },
  { key: 'l1', label: '1 ปรับปรุง', multiline: true },
]
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5">
    <NuxtLink :to="`/teacher/course/${id}/plans/${pid}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> กลับไปแผนการจัดการเรียนรู้</NuxtLink>
    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!data || !content || !spec" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header>
        <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} · หน่วยที่ {{ data.plan.unit_no }} {{ data.plan.unit_name }} · สอนครั้งที่ {{ data.plan.session_no }}</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">{{ spec.th }}ที่ {{ header.number }}</h1>
        <p class="text-sm text-slate-400">{{ spec.desc }}</p>
      </header>

      <div class="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-abyss-900/90 px-4 py-3 backdrop-blur">
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="sheet-ai" @click="draft('ai')">
          <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังเขียน… (30–60 วินาที)' : 'ให้ AI ร่าง' }}
        </button>
        <button class="btn-ghost !py-2 text-sm" :disabled="!!busy" @click="draft('plan')">เติมจากแผน (ไม่ใช้ AI)</button>
        <span class="flex-1" />
        <span class="text-xs" :class="dirty ? 'text-rune-300' : 'text-slate-500'">{{ dirty ? '● ยังไม่ได้บันทึก' : 'บันทึกแล้ว' }}</span>
        <button class="btn-ghost !py-2 text-sm" :disabled="!!busy || !dirty" data-testid="sheet-save" @click="save"><AppIcon name="check" :size="16" /> บันทึก</button>
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="sheet-word" @click="word"><AppIcon name="download" :size="16" /> ดาวน์โหลด Word</button>
      </div>
      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="sheet-msg">{{ msg.text }}</p>

      <section class="card grid gap-3 sm:grid-cols-4">
        <div><p class="label">{{ spec.th }}ที่</p><input v-model="header.number" class="input"></div>
        <div class="sm:col-span-3"><p class="label">{{ spec.nameLabel }}</p><input v-model="header.title" class="input"></div>
      </section>

      <section v-for="s in spec.sections" :key="s.key" class="card" :data-testid="`ss-${s.key}`">
        <h2 class="font-medium text-slate-50">{{ s.no }}. {{ s.title }}</h2>
        <p v-if="s.hint || s.numbered || s.pageBreak" class="mb-2 mt-1 text-xs text-slate-500">
          {{ s.hint }}{{ s.numbered ? ` 1 บรรทัด = 1 ข้อ (ระบบใส่เลข ${s.no}.1, ${s.no}.2 … ให้)` : '' }}{{ s.pageBreak ? ' · ขึ้นหน้าใหม่ในไฟล์ Word ตามแบบฟอร์ม' : '' }}
        </p>
        <textarea v-model="content[s.key]" :rows="s.rows ?? 3" class="input mt-2 leading-relaxed" />
      </section>

      <section v-if="data.sheet.type === 'assessment'" class="card space-y-3" data-testid="rubric">
        <h2 class="font-medium text-slate-50">3. รายการประเมินและเกณฑ์การให้คะแนน (Rubric)</h2>
        <p class="text-xs text-slate-500">1 แถว = 1 รายการประเมิน (ควรสอดคล้องกับจุดประสงค์เชิงพฤติกรรมของแผน) · ในไฟล์ Word จะมีทั้งตารางให้ทำเครื่องหมาย ✓ และตารางเกณฑ์</p>
        <TeacherRowTable v-model="content.rubric" :columns="rubricCols" add-label="เพิ่มรายการประเมิน" />
      </section>
    </template>
  </div>
</template>
