import type { StaffRecord } from '../../shared/types/staff'
import { inputString } from '../utils/errors'
import { array, record, text } from '../utils/staff'
import { phpInt } from './scenarioEngine'
const str = (value: unknown, max = 600) => ['string', 'number', 'boolean'].includes(typeof value) ? text(value, max) : ''
const list = (value: unknown, max = 8) => value && typeof value === 'object' ? Object.values(value).slice(0, max) : []
export function normalizeGuideCourse(d: StaffRecord) {
  return { overview: str(d.overview, 1200), strategies: list(d.strategies).map(value => { const row = record(value); return { title: str(row.title, 120), detail: str(row.detail), for: str(row.for, 120) } }), tools: list(d.tools).map(value => { const row = record(value); return { name: str(row.name, 120), use: str(row.use) } }), misconceptions: list(d.misconceptions).map(value => { const row = record(value); return { topic: str(row.topic, 100), issue: str(row.issue), fix: str(row.fix) } }), assessment: list(d.assessment).map(value => str(value)), fixed_mindset: str(d.fixed_mindset, 800) }
}
export function normalizeGuideUnit(d: StaffRecord) {
  const diff = record(d.differentiation)
  return { objective: str(d.objective, 500), duration_minutes: phpInt(d.duration_minutes), steps: list(d.steps, 10).map(value => { const row = record(value), styles = array(row.styles).map(value => inputString(value).toUpperCase()); return { phase: str(row.phase, 120), minutes: phpInt(row.minutes), activity: str(row.activity, 800), styles: ['V', 'A', 'R', 'K'].filter(style => styles.includes(style)) } }), materials: list(d.materials).map(value => str(value, 200)), differentiation: Object.fromEntries(['V', 'A', 'R', 'K'].map(key => [key, str(diff[key])])), fixed_mindset_support: str(d.fixed_mindset_support), check_questions: list(d.check_questions).map(value => str(value, 300)) }
}
