<script setup lang="ts">
// AI exam questions for the midterm/final week — a service for the teacher, separate from the plan book.
// The teacher ticks the units actually taught (nothing is ticked in advance); the set is saved and can be edited.
import { exportExamDocx, type ExamQuestion } from '~/utils/examDocx'

const route = useRoute()
const api = useApi()
const aiApi = useAiApi()
const id = route.params.id as string
const kind = route.params.kind as 'midterm' | 'final'
const EXAM = { midterm: 'ทดสอบกลางภาค', final: 'ทดสอบปลายภาค' }[kind] ?? ''
const LETTERS = ['ก', 'ข', 'ค', 'ง']

const data = ref<any>(null)
const loadError = ref('')
const picked = ref<number[]>([])
const options = reactive({ mcq: 20, essay: 2, mcq_points: 1, essay_points: 5 })
const questions = ref<ExamQuestion[]>([])
const dirty = ref(false)
const busy = ref<'' | 'ai' | 'save' | 'word'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
const usage = ref<any>(null)

onMounted(async () => {
  try {
    data.value = await api(`/teacher/courses/${id}/exam/${kind}`)
    const set = data.value.set
    Object.assign(options, set?.options ?? data.value.defaults)
    if (set) {
      picked.value = [...set.units] // the last set's units, so the teacher sees what it was made from
      questions.value = set.questions
    }
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})
watch(questions, () => (dirty.value = true), { deep: true, flush: 'sync' })

const thin = computed(() => (data.value?.units ?? []).filter((u: any) => picked.value.includes(u.no) && !u.has_plan && !u.has_knowledge))
const mcq = computed(() => questions.value.filter((q) => q.type === 'mcq'))
const essay = computed(() => questions.value.filter((q) => q.type === 'essay'))
const unitName = (no: number) => data.value?.units.find((u: any) => u.no === no)?.name ?? ''

async function generate() {
  if (questions.value.length && !confirm('ให้ AI ออกแนวข้อสอบชุดใหม่? ชุดเดิมจะถูกแทนที่')) return
  busy.value = 'ai'
  msg.value = null
  try {
    const r = await aiApi<any>(`/teacher/courses/${id}/exam/${kind}/generate`, { method: 'POST', body: { units: picked.value, options } })
    questions.value = r.questions
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: `AI (${r.model}) ออกแนวข้อสอบ ${r.questions.length} ข้อแล้ว และบันทึกไว้ให้ — ตรวจทุกข้อก่อนใช้` }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
    usage.value?.refresh()
  }
}

async function save() {
  busy.value = 'save'
  try {
    questions.value = (await api<any>(`/teacher/courses/${id}/exam/${kind}`, { method: 'PUT', body: { questions: questions.value } })).set.questions
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: 'บันทึกการแก้ไขแล้ว' }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
  }
}
function remove(q: ExamQuestion) {
  questions.value = questions.value.filter((x) => x !== q)
}

async function word(part: 'paper' | 'key') {
  if (dirty.value) await save()
  busy.value = 'word'
  try {
    const c = data.value.course
    await exportExamDocx({
      course: c, institution: data.value.institution, examName: EXAM.replace('ทดสอบ', ''), term: `${c.semester}/${c.academic_year}`,
      questions: questions.value, options, units: data.value.units,
    }, part, `${part === 'paper' ? 'แบบ' : 'เฉลยแบบ'}${EXAM}-${c.code}.docx`)
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-5">
    <NuxtLink :to="`/teacher/course/${id}/plans`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แผนการจัดการเรียนรู้</NuxtLink>
    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header>
        <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} · {{ data.course.section }}</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">แนวข้อสอบ{{ EXAM }}</h1>
        <p class="text-sm text-slate-400">{{ data.course.name }} · บริการเสริมสำหรับครู ไม่อยู่ในเล่มแผน — AI ร่างจากเนื้อหาในแผนและใบความรู้ของหน่วยที่เลือก ครูตรวจทุกข้อก่อนใช้</p>
      </header>

      <!-- 1 units actually taught -->
      <section class="card space-y-3">
        <p class="font-medium text-slate-100">1. เลือกหน่วยที่สอนไปแล้วจริง</p>
        <p class="text-xs text-slate-400">ระบบไม่ติ๊กให้ล่วงหน้า เพราะครูอาจสอนไม่ตรงตามลำดับในแผน ข้อสอบจะถามเฉพาะหน่วยที่เลือก</p>
        <label v-for="u in data.units" :key="u.no" class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
          <input v-model="picked" type="checkbox" :value="u.no" class="mt-1" :data-testid="`unit-${u.no}`">
          <span class="min-w-0 flex-1">
            <span class="text-slate-100">หน่วยที่ {{ u.no }} {{ u.name }}</span>
            <span class="block text-xs" :class="u.has_plan || u.has_knowledge ? 'text-slate-500' : 'text-rune-300'">
              {{ [u.has_plan && 'มีแผน', u.has_knowledge && 'มีใบความรู้', u.has_exercises && 'มีแบบทดสอบท้ายหน่วย'].filter(Boolean).join(' · ') || 'ยังไม่มีแผนหรือใบความรู้ — ข้อสอบของหน่วยนี้จะกว้างกว่าที่สอนจริง' }}
            </span>
          </span>
        </label>
      </section>

      <!-- 2 how many -->
      <section class="card space-y-3">
        <p class="font-medium text-slate-100">2. จำนวนข้อและคะแนน</p>
        <div class="grid gap-3 sm:grid-cols-4">
          <div><p class="label">ปรนัย 4 ตัวเลือก (ข้อ)</p><input v-model.number="options.mcq" type="number" min="0" max="60" class="input" data-testid="opt-mcq"></div>
          <div><p class="label">คะแนนต่อข้อ</p><input v-model.number="options.mcq_points" type="number" min="0.5" step="0.5" class="input"></div>
          <div><p class="label">อัตนัย (ข้อ)</p><input v-model.number="options.essay" type="number" min="0" max="10" class="input" data-testid="opt-essay"></div>
          <div><p class="label">คะแนนต่อข้อ</p><input v-model.number="options.essay_points" type="number" min="1" class="input"></div>
        </div>
        <p class="text-xs text-slate-400">คะแนนเต็ม {{ options.mcq * options.mcq_points + options.essay * options.essay_points }} คะแนน · AI ออกข้อใหม่ในแนวเดียวกับแบบทดสอบท้ายหน่วย ไม่คัดลอกข้อเดิม · ใช้ AI 1 ครั้ง</p>
        <p v-if="thin.length" class="rounded-xl bg-rune-400/10 px-3 py-2 text-xs text-rune-200">หน่วยที่ {{ thin.map((u: any) => u.no).join(', ') }} ยังไม่มีแผนหรือใบความรู้ AI จะออกจากชื่อหน่วยและคำอธิบายรายวิชา</p>
        <div class="flex flex-wrap items-center gap-3">
          <button class="btn-primary !py-2 text-sm" :disabled="!!busy || !picked.length" data-testid="exam-generate" @click="generate">
            <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังออกข้อสอบ… (30–90 วินาที)' : 'ให้ AI ออกแนวข้อสอบ' }}
          </button>
          <span v-if="!picked.length" class="text-xs text-slate-400">เลือกหน่วยอย่างน้อย 1 หน่วยก่อน</span>
          <TeacherAiUsage ref="usage" />
        </div>
      </section>

      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="exam-msg">{{ msg.text }}</p>

      <!-- 3 the questions -->
      <section v-if="questions.length" class="card space-y-4" data-testid="exam-questions">
        <div class="flex flex-wrap items-center gap-2">
          <p class="flex-1 font-medium text-slate-100">3. ตรวจและแก้ไข ({{ mcq.length }} ปรนัย · {{ essay.length }} อัตนัย)</p>
          <button class="btn-ghost !py-1.5 text-sm" :disabled="!!busy || !dirty" data-testid="exam-save" @click="save"><AppIcon name="check" :size="16" /> {{ dirty ? 'บันทึก' : 'บันทึกแล้ว' }}</button>
          <button class="btn-primary !py-1.5 text-sm" :disabled="!!busy" data-testid="exam-word-paper" @click="word('paper')"><AppIcon name="download" :size="16" /> แบบทดสอบ (ไม่มีเฉลย)</button>
          <button class="btn-ghost !py-1.5 text-sm" :disabled="!!busy" data-testid="exam-word-key" @click="word('key')"><AppIcon name="download" :size="16" /> เฉลย + ตารางวิเคราะห์</button>
        </div>
        <p class="text-xs text-slate-400">ข้อสอบกับเฉลยดาวน์โหลดแยกไฟล์ จะได้ส่งต่อหรือพิมพ์แบบทดสอบโดยไม่ติดเฉลย</p>
        <div v-for="(q, i) in questions" :key="i" class="space-y-2 rounded-xl bg-white/5 p-3 ring-1 ring-white/10" :data-testid="`q-${i}`">
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span class="rounded-full bg-white/10 px-2 py-0.5">{{ q.type === 'mcq' ? `ปรนัย ข้อ ${mcq.indexOf(q) + 1}` : `อัตนัย ข้อ ${essay.indexOf(q) + 1}` }}</span>
            <span>หน่วยที่ {{ q.unit_no }} {{ unitName(q.unit_no) }} · {{ q.level }}</span>
            <span class="flex-1" />
            <button class="text-red-300/70 hover:text-red-300" @click="remove(q)">ลบข้อนี้</button>
          </div>
          <textarea v-model="q.question" rows="2" class="input" />
          <div v-if="q.type === 'mcq'" class="grid gap-2 sm:grid-cols-2">
            <label v-for="(c, j) in q.choices" :key="j" class="flex items-center gap-2 text-sm">
              <input v-model="q.answer" type="radio" :value="LETTERS[j]" :name="`a${i}`" :title="'คำตอบที่ถูก'">
              <span class="w-4 text-slate-300">{{ LETTERS[j] }}.</span>
              <input v-model="q.choices[j]" class="input !py-1.5" :class="q.answer === LETTERS[j] ? 'ring-1 ring-emerald-400/60' : ''">
            </label>
          </div>
          <template v-else>
            <p class="label">แนวคำตอบ</p><textarea v-model="q.answer" rows="3" class="input" />
          </template>
          <p class="label">{{ q.type === 'mcq' ? 'เหตุผลของเฉลย' : 'เกณฑ์การให้คะแนน' }}</p>
          <textarea v-model="q.guide" rows="2" class="input" />
        </div>
      </section>
    </template>
  </div>
</template>
