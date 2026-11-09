import type { StaffRecord } from '../../shared/types/staff'
import { calendarFor, formatSessions, teachingWeeks } from '../../shared/utils/teachingSchedule'

/**
 * Weekly teaching schedule on the server — the same rules as utils/teachingSchedule.ts (one session per week,
 * numbered straight through the course; exam weeks count as sessions with the normal hours).
 */
export const EXAM_NAME: Record<string, string> = { midterm: 'ทดสอบกลางภาค', final: 'ทดสอบปลายภาค' }
export interface Slot { sessions: string; first: number | null; weeks: number; hours_theory: number; hours_practice: number }

/** "1-3, 5" → [1, 2, 3, 5] */
export function expandSessions(sessions: string): number[] {
  return sessions.split(',').map(part => part.trim()).filter(Boolean).flatMap(part => {
    const [a, b = a] = part.split('-').map(Number)
    return Array.from({ length: Math.max(1, b! - a! + 1) }, (_, i) => a! + i)
  })
}

/** Sessions and hours of every unit and exam from the saved weeks per unit; null when no schedule was saved. */
export function computeSchedule(book: StaffRecord, higher: boolean): { units: Record<string, Slot>; midterm: Slot; final: Slot } | null {
  const rows: StaffRecord[] = book.schedule?.units ?? []
  if (!rows.length) return null
  const num = (value: unknown) => parseFloat(String(value ?? '').replace(/[^\d.]/g, '')) || 0
  const t = num(book.curriculum?.theory_hours), p = num(book.curriculum?.practice_hours)
  const calendar = calendarFor(higher), free = teachingWeeks(calendar)
  const units: Record<string, Slot> = {}
  let next = 0
  for (const row of rows) {
    const weeks = Math.max(0, parseInt(String(row.weeks)) || 0), list = free.slice(next, next + weeks)
    next += weeks
    units[String(row.no)] = { sessions: formatSessions(list), first: list[0] ?? null, weeks, hours_theory: weeks * t, hours_practice: weeks * p }
  }
  const exam = (week: number): Slot => ({ sessions: String(week), first: week, weeks: 1, hours_theory: t, hours_practice: p })
  return { units, midterm: exam(calendar.midterm), final: exam(calendar.final) }
}
