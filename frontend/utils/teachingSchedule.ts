// Weekly teaching schedule: one session per week, numbered straight through the course. Exam weeks count as
// sessions with the course's normal hours but hold no unit. Plain calculations, used by the schedule page.
export interface TeachingCalendar { label: string; weeks: number; midterm: number; final: number }
export interface ScheduleUnit { no: string; name: string; weeks: number }
export interface ScheduleRow { key: string; kind: 'unit' | 'midterm' | 'final' | 'empty'; no?: string; name: string; weeks: number; sessions: string; first: number; theory: number; practice: number }

export const calendarFor = (higher: boolean): TeachingCalendar =>
  higher ? { label: 'ปวส.', weeks: 15, midterm: 7, final: 15 } : { label: 'ปวช.', weeks: 18, midterm: 9, final: 18 }

/** weeks that hold units: everything but the two exam weeks */
export const teachingWeeks = (c: TeachingCalendar) => Array.from({ length: c.weeks }, (_, i) => i + 1).filter((w) => w !== c.midterm && w !== c.final)

/** [1,2,3,5,6,8] → "1-3, 5-6, 8" */
export function formatSessions(list: number[]) {
  const parts: string[] = []
  for (let i = 0; i < list.length; ) {
    let j = i
    while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++
    parts.push(j > i ? `${list[i]}-${list[j]}` : String(list[i]))
    i = j + 1
  }
  return parts.join(', ')
}

/** Share out the teaching weeks by the units' hours, equally unless every unit has hours: at least 1 each while weeks last. */
export function autoWeeks(hours: number[], total: number): number[] {
  const n = hours.length
  if (!n) return []
  const base = hours.every((h) => h > 0) ? hours : hours.map(() => 1)
  const sum = base.reduce((a, b) => a + b, 0)
  const exact = base.map((h) => (h / sum) * total)
  const floor = total >= n ? 1 : 0
  const out = exact.map((x) => Math.max(floor, Math.floor(x)))
  let left = total - out.reduce((a, b) => a + b, 0)
  // what is left goes to the largest remainders; an excess (from the minimum of 1) comes off the smallest remainders
  const order = exact.map((x, i) => [x - out[i], i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)
  for (let k = 0; left > 0; k = (k + 1) % n, left--) out[order[k]]++
  for (let k = n - 1; left < 0; k = k === 0 ? n - 1 : k - 1) {
    if (out[order[k]] > floor) {
      out[order[k]]--
      left++
    }
  }
  return out
}

/** Week by week: which unit (or exam) each week holds — the teaching schedule table of the book. */
export function weekPlan(c: TeachingCalendar, units: ScheduleUnit[]) {
  const free = teachingWeeks(c)
  const owner = new Map<number, ScheduleUnit>()
  let next = 0
  for (const u of units) for (const w of free.slice(next, (next += u.weeks))) owner.set(w, u)
  return Array.from({ length: c.weeks }, (_, i) => {
    const week = i + 1
    if (week === c.midterm) return { week, kind: 'midterm' as const, label: 'ทดสอบกลางภาค' }
    if (week === c.final) return { week, kind: 'final' as const, label: 'ทดสอบปลายภาค (ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา)' }
    const u = owner.get(week)
    return u ? { week, kind: 'unit' as const, label: `หน่วยที่ ${u.no} ${u.name}` } : { week, kind: 'empty' as const, label: '' }
  })
}

/** Place the units on the teaching weeks in order, with the exam weeks in session order among them. */
export function buildSchedule(c: TeachingCalendar, units: ScheduleUnit[], theory: number, practice: number) {
  const free = teachingWeeks(c)
  let next = 0
  const rows: ScheduleRow[] = units.map((u) => {
    const sessions = free.slice(next, next + u.weeks)
    next += u.weeks
    return { key: `u${u.no}`, kind: 'unit', no: u.no, name: u.name, weeks: u.weeks, sessions: formatSessions(sessions), first: sessions[0] ?? free[next] ?? c.weeks, theory: u.weeks * theory, practice: u.weeks * practice }
  })
  const exam = (kind: 'midterm' | 'final', week: number): ScheduleRow =>
    ({ key: kind, kind, name: kind === 'midterm' ? 'ทดสอบกลางภาค' : 'ทดสอบปลายภาค (ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา)', weeks: 1, sessions: String(week), first: week, theory, practice })
  rows.push(exam('midterm', c.midterm), exam('final', c.final))
  const empty = free.slice(next)
  if (empty.length) rows.push({ key: 'empty', kind: 'empty', name: 'ยังไม่ได้จัดหน่วย', weeks: empty.length, sessions: formatSessions(empty), first: empty[0], theory: 0, practice: 0 })
  rows.sort((a, b) => a.first - b.first)
  const used = units.reduce((s, u) => s + u.weeks, 0)
  return { rows, used, available: free.length, totalHours: c.weeks * (theory + practice) }
}
