import type { SqlClient } from '../utils/db'
import { emptyScores, TAG_KEYS, phpInt, profile, type Scores } from './scenarioEngine'
import { coreRarity } from './progression'

export const LATEST = '(r.academic_year * 10 + r.semester) = (SELECT MAX(r2.academic_year * 10 + r2.semester) FROM assessment_results r2 WHERE r2.user_id = r.user_id AND r2.scenario_id = r.scenario_id)'
export type AssessmentRow = Scores & {
  id: number; user_id: number; scenario_id: number | null
  semester: number; academic_year: number; completed_at: string
  dominant_riasec: string; choices_log: string | null
  [key: string]: unknown
}
export interface Archetype {
  archetype_code: string; archetype_name: string; archetype_title: string
  archetype_description: string; strengths: string | null; tips: string | null
  color: string; icon: string
}
export const ARCHETYPE_COLUMNS = 'code AS archetype_code, name AS archetype_name, title AS archetype_title, description AS archetype_description, strengths, tips, color, icon'

export function combinedScores(rows: AssessmentRow[]) {
  const scores = emptyScores()
  const recent: Record<string, number> = {}
  rows.forEach((row, index) => {
    for (const key of TAG_KEYS) scores[key] += phpInt(row[key])
    Array.from(row.dominant_riasec ?? '').forEach((letter, position) => { recent['riasec_' + letter.toLowerCase()] = index * 10 + (3 - position) })
  })
  return { scores, summary: profile(scores, recent) }
}

export async function totalUniversal(db: SqlClient) {
  return Number((await db.rows<{ count: number }>("SELECT COUNT(*) AS count FROM scenarios WHERE is_universal = 1 AND is_active = 1 AND status = 'published'"))[0]?.count ?? 0)
}

// Shared by the teacher dashboard in phase 4; preserve PHP's map keyed by student id.
export async function coreProfiles(db: SqlClient, userIds: number[]) {
  if (!userIds.length) return {}
  const rows = await db.rows<AssessmentRow>(`SELECT r.* FROM assessment_results r JOIN scenarios s ON s.id = r.scenario_id WHERE r.user_id IN (${userIds.map(() => '?').join(',')}) AND s.is_universal = 1 AND ${LATEST} ORDER BY r.user_id, r.completed_at, r.id`, userIds)
  const archetypes = await db.rows<Archetype & { riasec_key: string }>(`SELECT riasec_key, ${ARCHETYPE_COLUMNS} FROM archetype_master`)
  const total = await totalUniversal(db)
  const byUser = new Map<number, AssessmentRow[]>()
  for (const row of rows) { const group = byUser.get(row.user_id) ?? []; group.push(row); byUser.set(row.user_id, group) }
  return Object.fromEntries([...byUser].map(([id, results]) => {
    const { scores, summary } = combinedScores(results)
    const found = archetypes.find(a => a.riasec_key === summary.archetype_key)
    const { riasec_key: _, ...archetype } = found ?? { riasec_key: '' }
    return [id, {
      ...scores, ...archetype,
      ...(found ? { strengths: JSON.parse(found.strengths ?? 'null'), tips: JSON.parse(found.tips ?? '[]') } : {}),
      dominant_vark: summary.dominant_vark, dominant_riasec: summary.dominant_riasec, mindset_type: summary.mindset_type,
      quests_completed: results.length, quests_total: total, rarity: coreRarity(results.length, total), completed_at: results.at(-1)!.completed_at,
    }]
  }))
}
