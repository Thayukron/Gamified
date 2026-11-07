<script setup lang="ts">
// Weekly teaching schedule of a course: how many weeks each unit takes; sessions and hours follow from that.
import type { CourseBook } from '~/utils/lessonPlan'
import { autoWeeks, buildSchedule, calendarFor, teachingWeeks, type ScheduleUnit } from '~/utils/teachingSchedule'

const route = useRoute()
const api = useApi()
const id = route.params.id as string

const data = ref<any>(null)
const book = ref<CourseBook | null>(null)
const units = ref<ScheduleUnit[]>([])
const theory = ref('')
const practice = ref('')
const dirty = ref(false)
const busy = ref(false)
const msg = ref<{ ok: boolean; text: string } | null>(null)
const loadError = ref('')

const num = (s: any) => parseFloat(String(s ?? '').replace(/[^\d.]/g, '')) || 0
const calendar = computed(() => calendarFor(!!data.value?.level_higher))
const perWeek = computed(() => num(theory.value) + num(practice.value))
const schedule = computed(() => buildSchedule(calendar.value, units.value, num(theory.value), num(practice.value)))
const over = computed(() => schedule.value.used - schedule.value.available)
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** units = the course's topics (the list the plans page uses), then any unit that only the book has */
function unitList(b: CourseBook, topics: string[]) {
  const list = topics.map((name, i) => ({ no: String(i + 1), name }))
  for (const r of b.units) if (r.no && !list.some((u) => u.no === r.no)) list.push({ no: r.no, name: r.name })
  return list
}
function unitHours() {
  return units.value.map((u) => {
    const r = book.value!.units.find((x) => x.no === u.no)
    return r ? num(r.hours_theory) + num(r.hours_practice) : 0
  })
}
function distribute() {
  const weeks = autoWeeks(unitHours(), teachingWeeks(calendar.value).length)
  units.value.forEach((u, i) => (u.weeks = weeks[i]))
  dirty.value = true
  msg.value = null
}
function step(no: string | undefined, by: number) {
  const u = units.value.find((x) => x.no === no)
  if (!u) return
  u.weeks = Math.max(0, u.weeks + by)
  dirty.value = true
  msg.value = null
}

onMounted(async () => {
  try {
    const [d, p] = await Promise.all([api<any>(`/teacher/courses/${id}/book`), api<any>(`/teacher/courses/${id}/plans`)])
    data.value = d
    book.value = JSON.parse(JSON.stringify(d.book))
    theory.value = book.value!.curriculum.theory_hours
    practice.value = book.value!.curriculum.practice_hours
    const saved = book.value!.schedule.units
    units.value = unitList(book.value!, p.topics).map((u) => ({ ...u, weeks: Math.max(0, parseInt(saved.find((s) => s.no === u.no)?.weeks ?? '0') || 0) }))
    if (!saved.length) distribute() // first visit: a draft for the teacher to check
  } catch (e) {
    loadError.value = apiErrorMessage(e)
  }
})

async function save() {
  busy.value = true
  msg.value = null
  try {
    const b = book.value!
    const [t, pr] = [num(theory.value), num(practice.value)]
    b.curriculum.theory_hours = theory.value
    b.curriculum.practice_hours = practice.value
    b.schedule = { units: units.value.map((u) => ({ no: u.no, weeks: String(u.weeks) })) }
    // hours of the units table in the book come from the schedule; K/S/A/Ap and percentages stay
    for (const u of units.value) {
      let row = b.units.find((x) => x.no === u.no)
      if (!row) b.units.push((row = { no: u.no, name: u.name, k: '', s: '', a: '', ap: '', hours_theory: '', hours_practice: '', percent: '' }))
      row.hours_theory = fmt(u.weeks * t)
      row.hours_practice = fmt(u.weeks * pr)
    }
    b.midterm_eval = { ...b.midterm_eval, hours_theory: fmt(t), hours_practice: fmt(pr) }
    b.final_eval = { ...b.final_eval, hours_theory: fmt(t), hours_practice: fmt(pr) }
    book.value = (await api<any>(`/teacher/courses/${id}/book`, { method: 'PUT', body: { content: b } })).book
    dirty.value = false
    msg.value = { ok: true, text: 'บันทึกตารางแล้ว ชั่วโมงในเล่มแผนและเลขสอนครั้งที่ของแผนที่สร้างจากตารางเปลี่ยนตามแล้ว' }
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
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
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">ตารางกำหนดการสอนรายสัปดาห์</h1>
        <p class="text-sm text-slate-400">{{ data.course.name }}</p>
      </header>

      <section class="card space-y-3">
        <p class="text-sm text-slate-300">
          ระดับ <b>{{ calendar.label }}</b> เรียน <b>{{ calendar.weeks }} สัปดาห์</b> สอนสัปดาห์ละ 1 ครั้ง · ทดสอบกลางภาคสัปดาห์ที่ {{ calendar.midterm }} · ทดสอบปลายภาคสัปดาห์ที่ {{ calendar.final }}
        </p>
        <div class="flex flex-wrap items-end gap-3">
          <div><p class="label">ทฤษฎี (ชม./สัปดาห์)</p><input v-model="theory" class="input !w-32" inputmode="decimal" data-testid="sc-theory" @input="dirty = true"></div>
          <div><p class="label">ปฏิบัติ (ชม./สัปดาห์)</p><input v-model="practice" class="input !w-32" inputmode="decimal" data-testid="sc-practice" @input="dirty = true"></div>
          <p class="pb-2 text-sm text-slate-300" data-testid="sc-total">
            {{ fmt(perWeek) }} ชม./สัปดาห์ × {{ calendar.weeks }} สัปดาห์ = <b>{{ fmt(schedule.totalHours) }} ชม.</b> (เนื้อหา {{ schedule.available }} สัปดาห์ · ทดสอบ 2 สัปดาห์)
          </p>
        </div>
        <p v-if="!perWeek" class="text-sm text-rune-300" data-testid="sc-no-hours">กรอกชั่วโมงทฤษฎีและปฏิบัติต่อสัปดาห์ของรายวิชาก่อน ระบบจึงจะคิดชั่วโมงของแต่ละหน่วยได้</p>
      </section>

      <section v-if="units.length" class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-400">กด − / + เพื่อกำหนดว่าแต่ละหน่วยสอนกี่สัปดาห์ เลขสอนครั้งที่และชั่วโมงจะคำนวณให้เอง โดยข้ามสัปดาห์ทดสอบ</p>
          <button class="btn-ghost !py-1.5 text-sm" data-testid="sc-auto" @click="distribute">จัดสรรสัปดาห์ให้อัตโนมัติ</button>
        </div>
        <div class="overflow-x-auto rounded-xl ring-1 ring-white/10">
          <table class="w-full min-w-[620px] text-sm" data-testid="sc-table">
            <thead class="text-left text-slate-400">
              <tr>
                <th class="px-3 py-2">สอนครั้งที่</th>
                <th class="px-3 py-2">เนื้อหา</th>
                <th class="px-3 py-2 text-center">จำนวนสัปดาห์</th>
                <th class="px-3 py-2 text-right">ท.</th>
                <th class="px-3 py-2 text-right">ป.</th>
                <th class="px-3 py-2 text-right">รวม ชม.</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in schedule.rows" :key="r.key" class="border-t border-white/5" :class="r.kind === 'midterm' || r.kind === 'final' ? 'bg-rune-400/10' : ''" :data-testid="`sc-row-${r.key}`">
                <td class="whitespace-nowrap px-3 py-2 font-medium text-slate-100" :data-testid="`sc-sessions-${r.key}`">{{ r.sessions || '—' }}</td>
                <td class="px-3 py-2" :class="r.kind === 'empty' ? 'text-rune-300' : 'text-slate-100'">
                  <template v-if="r.kind === 'unit'">หน่วยที่ {{ r.no }} {{ r.name }}</template>
                  <b v-else>{{ r.name }}</b>
                </td>
                <td class="px-3 py-2 text-center">
                  <span v-if="r.kind === 'unit'" class="inline-flex items-center gap-1">
                    <button type="button" class="btn-ghost !px-2 !py-0.5" :aria-label="`ลดสัปดาห์หน่วยที่ ${r.no}`" :data-testid="`sc-minus-${r.no}`" @click="step(r.no, -1)">−</button>
                    <span class="w-7 text-slate-100" :data-testid="`sc-weeks-${r.no}`">{{ r.weeks }}</span>
                    <button type="button" class="btn-ghost !px-2 !py-0.5" :aria-label="`เพิ่มสัปดาห์หน่วยที่ ${r.no}`" :data-testid="`sc-plus-${r.no}`" @click="step(r.no, 1)">+</button>
                  </span>
                  <span v-else class="text-slate-300">{{ r.weeks }}</span>
                </td>
                <td class="px-3 py-2 text-right text-slate-300">{{ fmt(r.theory) }}</td>
                <td class="px-3 py-2 text-right text-slate-300">{{ fmt(r.practice) }}</td>
                <td class="px-3 py-2 text-right text-slate-100">{{ fmt(r.theory + r.practice) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="over > 0" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300" data-testid="sc-over">จัดหน่วยเกินไป {{ over }} สัปดาห์ (มีสัปดาห์สำหรับเนื้อหา {{ schedule.available }} สัปดาห์) — ลดสัปดาห์ของบางหน่วยก่อนจึงจะบันทึกได้</p>
        <p v-else-if="over < 0" class="rounded-xl bg-rune-400/10 px-3 py-2 text-sm text-rune-200" data-testid="sc-under">ยังเหลืออีก {{ -over }} สัปดาห์ที่ไม่มีหน่วย — ชั่วโมงในตารางหน่วยจะยังไม่ครบ {{ fmt(schedule.totalHours) }} ชม.</p>
        <p v-else class="text-sm text-emerald-300" data-testid="sc-ok">จัดครบ {{ schedule.available }} สัปดาห์ ชั่วโมงรวม {{ fmt(schedule.totalHours) }} ชม. ✓</p>
        <p v-if="units.some((u) => !u.weeks)" class="text-sm text-rune-300">มีหน่วยที่ยังไม่ได้กำหนดสัปดาห์</p>
        <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="sc-msg">{{ msg.text }}</p>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs text-slate-500">บันทึกแล้ว ชั่วโมงในเล่มแผนและแผนที่สร้างจากตารางจะเปลี่ยนตาม (เนื้อหาในแผนไม่ถูกแก้) · แผนเดิมแบบแยกรายครั้งไม่เปลี่ยน</span>
          <button class="btn-primary !py-2 text-sm" :disabled="busy || over > 0 || !dirty" data-testid="sc-save" @click="save"><AppIcon name="check" :size="16" /> {{ busy ? 'กำลังบันทึก…' : 'บันทึกตาราง' }}</button>
        </div>
      </section>
      <NuxtLink v-else :to="`/teacher/course/${id}/students?edit=units`" class="card card-hover block text-sm text-slate-300" data-testid="sc-no-units">รายวิชานี้ยังไม่มีหน่วยการเรียน — <span class="text-rune-300">เพิ่มหน่วยการเรียนก่อน →</span></NuxtLink>
    </template>
  </div>
</template>
