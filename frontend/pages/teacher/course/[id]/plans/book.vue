<script setup lang="ts">
import type { CourseBook } from '~/utils/lessonPlan'
import { exportLessonPlansDocx } from '~/utils/lessonPlanDocx'

const route = useRoute()
const api = useApi()
const id = route.params.id as string

const data = ref<any>(null)
const book = ref<CourseBook | null>(null)
const aiModel = ref<string | null>(null)
const dirty = ref(false)
const busy = ref<'' | 'save' | 'ai' | 'word'>('')
const msg = ref<{ ok: boolean; text: string } | null>(null)
const loadError = ref('')
const tab = ref('cover')

const TABS = [
  { k: 'cover', th: '1. ปก · คำนำ' },
  { k: 'curriculum', th: '2. หลักสูตรรายวิชา' },
  { k: 'occupational', th: '3. มาตรฐานอาชีพ' },
  { k: 'job', th: '4. วิเคราะห์หน่วย' },
  { k: 'units', th: '5. หน่วย · พฤติกรรม · ชั่วโมง' },
  { k: 'biblio', th: '6. บรรณานุกรม' },
]
const PROGRAMS = ['ประกาศนียบัตรวิชาชีพ พุทธศักราช 2567', 'ประกาศนียบัตรวิชาชีพชั้นสูง พุทธศักราช 2567']

onMounted(async () => {
  try {
    data.value = await api(`/teacher/courses/${id}/book`)
    book.value = JSON.parse(JSON.stringify(data.value.book))
    await nextTick()
    dirty.value = false
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})
watch(book, () => (dirty.value = true), { deep: true })

// ---- totals / checks for the units table (form rule: ปวช. ≥ 18 weeks incl. assessment, ปวส. ≥ 15 weeks excl.)
const n = (s: any) => parseFloat(String(s ?? '').replace(/[^\d.]/g, '')) || 0
const totals = computed(() => {
  const u = book.value?.units ?? []
  const f = book.value?.final_eval
  const t = u.reduce((s, r) => s + n(r.hours_theory), 0) + n(f?.hours_theory)
  const p = u.reduce((s, r) => s + n(r.hours_practice), 0) + n(f?.hours_practice)
  const pct = u.reduce((s, r) => s + n(r.percent), 0) + n(f?.percent)
  const weeks = data.value?.level_higher ? 15 : 18
  const perWeek = n(book.value?.curriculum.theory_hours) + n(book.value?.curriculum.practice_hours)
  return { t, p, pct, weeks, expected: perWeek * weeks }
})

async function save() {
  busy.value = 'save'
  msg.value = null
  try {
    const r = await api<any>(`/teacher/courses/${id}/book`, { method: 'PUT', body: { content: book.value, ai_model: aiModel.value } })
    book.value = r.book
    data.value.saved = true
    aiModel.value = null
    await nextTick()
    dirty.value = false
    msg.value = { ok: true, text: 'บันทึกข้อมูลระดับรายวิชาแล้ว' }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = ''
  }
}

async function aiDraft() {
  if (!confirm('ให้ AI ร่าง “ตารางวิเคราะห์หน่วยการเรียนรู้ · ระดับพฤติกรรม K/S/A/Ap · ชั่วโมงและร้อยละ · คำนำ” จากข้อมูลหลักสูตรรายวิชาที่กรอกไว้?\nข้อมูลเดิมในส่วนเหล่านี้จะถูกแทนที่ (หลักสูตรรายวิชาไม่ถูกแตะ) — ยังไม่บันทึกจนกว่าจะกด “บันทึก”')) return
  busy.value = 'ai'
  msg.value = null
  try {
    const r = await api<any>(`/teacher/courses/${id}/book/draft`, { method: 'POST', body: { content: book.value } })
    Object.assign(book.value!, r.parts)
    aiModel.value = r.model
    tab.value = 'job'
    msg.value = { ok: true, text: `AI (${r.model}) ร่างตารางวิเคราะห์และคำนำแล้ว — ตรวจ แก้ไข แล้วกด “บันทึก”` }
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
      course: data.value.course, plans: data.value.plans, learners: data.value.learners,
      book: book.value!, institution: data.value.institution,
      filename: `แผนการจัดการเรียนรู้-${data.value.course.code}-ฉบับเต็ม.docx`,
    })
  } finally {
    busy.value = ''
  }
}

const jobCols = [
  { key: 'duty', label: 'งานหลัก (Duty)', width: '20%', multiline: true, placeholder: 'งานหลัก 1 …' },
  { key: 'task', label: 'งานย่อย (Task)', width: '20%', multiline: true, placeholder: '1.1 …' },
  { key: 'sub_competency', label: 'สมรรถนะย่อย (มาตรฐานอาชีพ)', width: '16%', multiline: true, placeholder: 'ว่างได้' },
  { key: 'knowledge', label: 'ความรู้ในการปฏิบัติงาน', multiline: true },
  { key: 'skill', label: 'ทักษะในการปฏิบัติงาน', multiline: true },
]
const occCols = [
  { key: 'unit_code', label: 'หน่วยสมรรถนะ: รหัส', width: '11%' },
  { key: 'unit_desc', label: 'คำอธิบาย', multiline: true },
  { key: 'sub_code', label: 'สมรรถนะย่อย: รหัส', width: '11%' },
  { key: 'sub_desc', label: 'คำอธิบาย', multiline: true },
  { key: 'criteria', label: 'เกณฑ์การปฏิบัติงาน', multiline: true },
  { key: 'method', label: 'วิธีประเมิน', multiline: true },
]
const unitCols = [
  { key: 'no', label: 'หน่วย', width: '6%' },
  { key: 'name', label: 'หน่วยการเรียนรู้', width: '28%' },
  { key: 'k', label: 'พุทธิพิสัย (K)', placeholder: 'K1,K2' },
  { key: 's', label: 'ทักษะพิสัย (S)', placeholder: 'S2' },
  { key: 'a', label: 'จิตพิสัย (A)', placeholder: 'A2' },
  { key: 'ap', label: 'ประยุกต์ใช้ (Ap)', placeholder: 'Ap1' },
  { key: 'hours_theory', label: 'ชม. ท' },
  { key: 'hours_practice', label: 'ชม. ป' },
  { key: 'percent', label: 'ร้อยละ' },
]
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5">
    <NuxtLink :to="`/teacher/course/${id}/plans`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> แผนการจัดการเรียนรู้ทั้งหมด</NuxtLink>
    <p v-if="loadError" class="card text-red-300">{{ loadError }}</p>
    <p v-else-if="!data || !book" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <header>
        <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} {{ data.course.name }} · {{ data.level_higher ? 'ปวส.' : 'ปวช.' }}</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">เล่มแผนการจัดการเรียนรู้ (ระดับรายวิชา)</h1>
        <p class="text-sm text-slate-400">ปก · คำนำ · สารบัญ · หลักสูตรรายวิชา · มาตรฐานอาชีพ · ตารางวิเคราะห์ · หน่วยการเรียนรู้ → รวมกับแผนรายหน่วย {{ data.plans.length }} แผน + บรรณานุกรม + ภาคผนวก เป็นไฟล์ Word เล่มเดียว</p>
        <p v-if="!data.saved" class="mt-2 text-xs text-rune-300">ยังไม่เคยบันทึก — ระบบเติมค่าเริ่มต้นจากข้อมูลรายวิชาให้แล้ว</p>
      </header>

      <div class="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-abyss-900/90 px-4 py-3 backdrop-blur">
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="book-ai" @click="aiDraft">
          <AppIcon name="orb" :size="16" /> {{ busy === 'ai' ? 'AI กำลังวิเคราะห์… (30–60 วินาที)' : 'ให้ AI ร่างตารางวิเคราะห์ + คำนำ' }}
        </button>
        <span class="flex-1" />
        <span class="text-xs" :class="dirty ? 'text-rune-300' : 'text-slate-500'">{{ dirty ? '● ยังไม่ได้บันทึก' : 'บันทึกแล้ว' }}</span>
        <button class="btn-ghost !py-2 text-sm" :disabled="!!busy || !dirty" data-testid="book-save" @click="save"><AppIcon name="check" :size="16" /> บันทึก</button>
        <button class="btn-primary !py-2 text-sm" :disabled="!!busy" data-testid="book-word" @click="word"><AppIcon name="download" :size="16" /> ดาวน์โหลดเล่ม Word</button>
      </div>
      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="book-msg">{{ msg.text }}</p>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="t in TABS"
          :key="t.k"
          class="rounded-full px-4 py-1.5 text-sm ring-1 transition"
          :class="tab === t.k ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
          :data-testid="`tab-${t.k}`"
          @click="tab = t.k"
        >{{ t.th }}</button>
      </div>

      <!-- 1 cover + preface -->
      <section v-if="tab === 'cover'" class="card space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <p class="label">หลักสูตร</p>
            <input v-model="book.curriculum.program" class="input" list="programs">
            <datalist id="programs"><option v-for="pg in PROGRAMS" :key="pg" :value="pg" /></datalist>
          </div>
          <div><p class="label">ประเภทวิชา</p><input v-model="book.curriculum.field_type" class="input" placeholder="เช่น อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ"></div>
          <div><p class="label">กลุ่มอาชีพ</p><input v-model="book.curriculum.occupation_group" class="input"></div>
          <div><p class="label">สาขาวิชา</p><input v-model="book.curriculum.major" class="input"></div>
          <div><p class="label">ผู้จัดทำ (แสดงบนปกและท้ายคำนำ)</p><input v-model="book.author" class="input"></div>
        </div>
        <p class="text-xs text-slate-500">บนปกจะแสดงตรา สอศ. รหัส/ชื่อวิชา ภาคเรียน และชื่อวิทยาลัย “{{ data.institution.name || 'ยังไม่ได้ตั้งค่า (ผู้ดูแลระบบ)' }}” ให้อัตโนมัติ</p>
        <div><p class="label">คำนำ (1 บรรทัด = 1 ย่อหน้า)</p><textarea v-model="book.preface" rows="7" class="input leading-relaxed" data-testid="preface" /></div>
      </section>

      <!-- 2 curriculum (copy from the official curriculum) -->
      <section v-if="tab === 'curriculum'" class="card space-y-4">
        <p class="rounded-xl bg-rune-400/10 px-3 py-2 text-sm text-rune-100">ตามคำอธิบายของแบบฟอร์ม: ข้อมูลส่วนนี้ <b>ให้คัดลอกจากหลักสูตร ปวช./ปวส. พุทธศักราช 2567 ที่ สอศ. เผยแพร่เท่านั้น</b> — AI จะไม่แก้ไขส่วนนี้</p>
        <div class="grid gap-3 sm:grid-cols-3">
          <div><p class="label">ทฤษฎี (ชม./สัปดาห์)</p><input v-model="book.curriculum.theory_hours" class="input" data-testid="cur-t"></div>
          <div><p class="label">ปฏิบัติ (ชม./สัปดาห์)</p><input v-model="book.curriculum.practice_hours" class="input" data-testid="cur-p"></div>
          <div><p class="label">หน่วยกิต</p><input v-model="book.curriculum.credits" class="input"></div>
        </div>
        <div><p class="label">อ้างอิงมาตรฐาน</p><textarea v-model="book.curriculum.standards_ref" rows="2" class="input" /></div>
        <div><p class="label">ผลลัพธ์การเรียนรู้ระดับรายวิชา</p><textarea v-model="book.curriculum.outcome" rows="2" class="input" /></div>
        <div><p class="label">จุดประสงค์รายวิชา (1 บรรทัด = 1 ข้อ)</p><textarea v-model="book.curriculum.objectives" rows="4" class="input" /></div>
        <div><p class="label">สมรรถนะรายวิชา (1 บรรทัด = 1 ข้อ)</p><textarea v-model="book.curriculum.competencies" rows="4" class="input" /></div>
        <div><p class="label">คำอธิบายรายวิชา</p><textarea v-model="book.curriculum.description" rows="6" class="input" data-testid="cur-desc" /></div>
      </section>

      <!-- 3 occupational standard -->
      <section v-if="tab === 'occupational'" class="card space-y-4">
        <p class="text-sm text-slate-400">รายวิชาที่ <b>ไม่อ้างอิงมาตรฐานอาชีพ เว้นว่างทั้งหน้า</b> — หน้านี้จะไม่ถูกพิมพ์ · ถ้าอ้างอิงไม่ครบทั้งมาตรฐาน ให้คัดลอกเฉพาะหน่วยสมรรถนะที่อ้างอิงในรายวิชา</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><p class="label">หน่วยงานรับรองมาตรฐานอาชีพ</p><input v-model="book.occupational.agency" class="input" placeholder="เช่น สถาบันคุณวุฒิวิชาชีพ (องค์การมหาชน)"></div>
          <div><p class="label">มาตรฐานอาชีพ สาขาวิชาชีพ</p><input v-model="book.occupational.standard" class="input"></div>
          <div><p class="label">อาชีพ</p><input v-model="book.occupational.occupation" class="input"></div>
          <div><p class="label">ระดับ</p><input v-model="book.occupational.level" class="input"></div>
        </div>
        <TeacherRowTable v-model="book.occupational.rows" :columns="occCols" add-label="เพิ่มสมรรถนะย่อย" />
      </section>

      <!-- 4 unit analysis -->
      <section v-if="tab === 'job'" class="card space-y-4">
        <p class="text-sm text-slate-400">ขั้นที่ 1 วิเคราะห์ผลลัพธ์ระดับรายวิชา → งานหลัก (Duty) / งานย่อย (Task) · ขั้นที่ 2–4 เติมสมรรถนะย่อย (ถ้ามี) ความรู้ และทักษะของแต่ละงานย่อย · แถวที่งานหลักเหมือนกันติดกันจะรวมเซลล์ให้เหมือนแบบฟอร์ม</p>
        <div><p class="label">ผลลัพธ์การเรียนรู้ระดับรายวิชา (Job)</p><input v-model="book.job_analysis.job" class="input"></div>
        <TeacherRowTable v-model="book.job_analysis.rows" :columns="jobCols" add-label="เพิ่มงานย่อย" testid="job-table" />
      </section>

      <!-- 5 units: behaviour levels + hours + weights -->
      <section v-if="tab === 'units'" class="card space-y-4">
        <p class="text-sm text-slate-400">ใช้สร้าง <b>ตารางวิเคราะห์พฤติกรรมการเรียนรู้ (แบบ 2)</b> และ <b>ตารางหน่วยการเรียนรู้</b> · K ใส่ได้หลายระดับ (เช่น K1,K2,K3) · S / A / Ap ใส่ระดับเดียว</p>
        <TeacherRowTable v-model="book.units" :columns="unitCols" add-label="เพิ่มหน่วย" testid="units-table" />
        <div class="grid gap-3 sm:grid-cols-4">
          <p class="text-sm text-slate-300 sm:col-span-4">ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา (เมื่อเรียนรายวิชานี้สำเร็จแล้วทำอะไรได้)</p>
          <div><p class="label">ชม. ทฤษฎี</p><input v-model="book.final_eval.hours_theory" class="input"></div>
          <div><p class="label">ชม. ปฏิบัติ</p><input v-model="book.final_eval.hours_practice" class="input"></div>
          <div><p class="label">ร้อยละ</p><input v-model="book.final_eval.percent" class="input"></div>
        </div>
        <div class="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-white/5 px-4 py-3 text-sm" data-testid="unit-totals">
          <span class="text-slate-300">รวมทั้งรายวิชา: ทฤษฎี {{ totals.t }} · ปฏิบัติ {{ totals.p }} · รวม {{ totals.t + totals.p }} ชม.</span>
          <span v-if="totals.expected" :class="totals.t + totals.p >= totals.expected ? 'text-emerald-300' : 'text-rune-300'">
            เกณฑ์ {{ data.level_higher ? 'ปวส.' : 'ปวช.' }} ≥ {{ totals.weeks }} สัปดาห์ × {{ totals.expected / totals.weeks }} ชม. = {{ totals.expected }} ชม. {{ totals.t + totals.p >= totals.expected ? '✓' : '(ยังไม่ครบ)' }}
          </span>
          <span :class="totals.pct === 100 ? 'text-emerald-300' : 'text-rune-300'">ร้อยละประเมินผลรวม {{ totals.pct }} {{ totals.pct === 100 ? '✓' : '(ควรรวมเป็น 100)' }}</span>
        </div>
      </section>

      <!-- 6 bibliography -->
      <section v-if="tab === 'biblio'" class="card space-y-3">
        <p class="text-sm text-slate-400">1 บรรทัด = 1 รายการ (รูปแบบ APA หรือตามที่วิทยาลัยกำหนด)</p>
        <textarea v-model="book.bibliography" rows="10" class="input leading-relaxed" />
      </section>
    </template>
  </div>
</template>
