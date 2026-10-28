import type { Avatar, ScenarioContent } from '../../shared/types/game'
import type { SqlClient } from '../utils/db'
import { ApiError, inputString } from '../utils/errors'
import { currentTerm } from '../utils/settings'
import { evaluate, forPlayer, profile as scenarioProfile, recency, TAG_KEYS } from './scenarioEngine'
import { coreRarity, level, questRarity, rewards } from './progression'
import { ARCHETYPE_COLUMNS, combinedScores, LATEST, totalUniversal, type Archetype, type AssessmentRow } from './profiles'

interface ScenarioRow { id: number; title: string; description: string | null; cover_image: string | null; content: string }
export const bangkokNow = () => new Date(Date.now() + 7 * 3600000).toISOString().replace(/\.\d{3}Z$/, '+07:00')

async function playableScenario(db: SqlClient, id: number) {
  const scenario = (await db.rows<ScenarioRow>("SELECT id, title, description, cover_image, content FROM scenarios WHERE id = ? AND is_active = 1 AND status = 'published'", [id]))[0]
  if (!scenario) throw new ApiError(404, 'ไม่พบเควสต์นี้ หรือยังไม่เปิดให้เล่น')
  return scenario
}
async function termResultId(db: SqlClient, userId: number, scenarioId: number, term: { semester: number; academic_year: number }) {
  return (await db.rows<{ id: number }>('SELECT id FROM assessment_results WHERE user_id = ? AND scenario_id = ? AND semester = ? AND academic_year = ?', [userId, scenarioId, term.semester, term.academic_year]))[0]?.id ?? null
}
async function lockPlayer(db: SqlClient, userId: number) {
  // A real user row always exists, unlike player_progress before the first reward.
  // All progress/completion writes for one player serialize on this row.
  if (!(await db.rows<{ id: number }>('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]))[0]) throw new ApiError(401, 'กรุณาเข้าสู่ระบบ')
}

export async function quests(db: SqlClient, userId: number) {
  const term = await currentTerm(db)
  const rows = await db.rows<Record<string, unknown>>(`SELECT s.id, s.title, s.description, s.cover_image, s.is_universal,
    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.icon')) AS icon,
    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.color')) AS color,
    JSON_UNQUOTE(JSON_EXTRACT(s.content, '$.meta.subtitle')) AS subtitle,
    r.id AS result_id, gs.current_scene, gs.updated_at AS saved_at
    FROM scenarios s LEFT JOIN assessment_results r ON r.scenario_id = s.id AND r.user_id = ? AND r.semester = ? AND r.academic_year = ?
    LEFT JOIN game_sessions gs ON gs.scenario_id = s.id AND gs.user_id = ? AND gs.status = 'in_progress'
    WHERE s.is_active = 1 AND s.status = 'published' ORDER BY s.is_universal DESC, s.id`, [userId, term.semester, term.academic_year, userId])
  return { quests: rows.map(row => ({ ...row, status: row.result_id ? 'completed' : row.current_scene ? 'in_progress' : 'new' })), term }
}

export async function show(db: SqlClient, userId: number, id: number) {
  const scenario = await playableScenario(db, id)
  const resultId = await termResultId(db, userId, id, await currentTerm(db))
  if (resultId) return { completed: true, result_id: resultId }
  const session = (await db.rows<{ current_scene: string; choices_log: string; updated_at: string }>("SELECT current_scene, choices_log, updated_at FROM game_sessions WHERE user_id = ? AND scenario_id = ? AND status = 'in_progress'", [userId, id]))[0]
  return {
    completed: false,
    scenario: { ...scenario, content: forPlayer(JSON.parse(scenario.content)) },
    session: session ? { ...session, choices_log: JSON.parse(session.choices_log) || [] } : null,
  }
}

// These two services must run inside transaction() so the row lock covers every write.
export async function progress(db: SqlClient, userId: number, id: number, body: Record<string, unknown>) {
  await lockPlayer(db, userId)
  const scenario = await playableScenario(db, id)
  const content: ScenarioContent = JSON.parse(scenario.content)
  const sceneId = inputString(body.current_scene)
  const log = body.choices_log ?? []
  if (!Object.hasOwn(content.scenes, sceneId) || !Array.isArray(log)) throw new ApiError(422, 'ข้อมูลบันทึกไม่ถูกต้อง')
  if (await termResultId(db, userId, id, await currentTerm(db))) throw new ApiError(409, 'คุณเล่นเควสต์นี้จบแล้วในภาคเรียนนี้')
  // As in PHP, partial logs are stored here; final scoring replays the complete log.
  await db.execute("INSERT INTO game_sessions (user_id, scenario_id, current_scene, choices_log, status) VALUES (?, ?, ?, ?, 'in_progress') ON DUPLICATE KEY UPDATE current_scene = VALUES(current_scene), choices_log = VALUES(choices_log), status = 'in_progress'", [userId, id, sceneId, JSON.stringify(log)])
  return { saved: true, saved_at: bangkokNow() }
}

export async function complete(db: SqlClient, userId: number, id: number, body: Record<string, unknown>) {
  await lockPlayer(db, userId)
  const scenario = await playableScenario(db, id)
  const term = await currentTerm(db)
  const existingId = await termResultId(db, userId, id, term)
  if (existingId) return { result_id: existingId, already: true }
  const log = body.choices_log ?? []
  if (!Array.isArray(log)) throw new ApiError(422, 'ข้อมูลการเล่นไม่ถูกต้อง')
  const evaluated = evaluate(JSON.parse(scenario.content), log)
  const summary = scenarioProfile(evaluated.scores, recency(evaluated.tag_history))
  const archetypeId = (await db.rows<{ id: number }>('SELECT id FROM archetype_master WHERE riasec_key = ? LIMIT 1', [summary.archetype_key]))[0]?.id ?? null
  const gained = rewards(evaluated.stats, evaluated.items.length)
  const rarity = questRarity(evaluated.stats)
  const before = await playerProgress(db, userId)
  const columns = ['user_id', 'scenario_id', 'semester', 'academic_year', ...TAG_KEYS, 'dominant_vark', 'dominant_riasec', 'mindset_type', 'archetype_id', 'rarity', 'xp_gained', 'coins_gained', 'choices_log']
  await db.execute(`INSERT INTO assessment_results (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`, [
    userId, id, term.semester, term.academic_year, ...TAG_KEYS.map(key => evaluated.scores[key]),
    summary.dominant_vark, summary.dominant_riasec, summary.mindset_type, archetypeId, rarity, gained.xp, gained.coins, JSON.stringify(log),
  ])
  const resultId = (await db.rows<{ id: number }>('SELECT LAST_INSERT_ID() AS id'))[0]!.id
  await db.execute("UPDATE game_sessions SET status = 'completed', choices_log = ? WHERE user_id = ? AND scenario_id = ?", [JSON.stringify(log), userId, id])
  await db.execute('INSERT INTO player_progress (user_id,xp,coins) VALUES (?,?,?) ON DUPLICATE KEY UPDATE xp = xp + VALUES(xp), coins = coins + VALUES(coins)', [userId, gained.xp, gained.coins])
  return { result_id: resultId, already: false, rewards: { ...gained, rarity, level_before: level(before.xp).level, level_after: level(before.xp + gained.xp).level } }
}

async function playerProgress(db: SqlClient, userId: number) {
  const row = (await db.rows<{ xp: number; coins: number; avatar: string | null }>('SELECT xp, coins, avatar FROM player_progress WHERE user_id = ?', [userId]))[0]
  return { xp: Number(row?.xp ?? 0), coins: Number(row?.coins ?? 0), avatar: row?.avatar ? JSON.parse(row.avatar) : null }
}
export async function player(db: SqlClient, userId: number) {
  const data = await playerProgress(db, userId)
  return { player: { ...data, ...level(data.xp) } }
}
export async function saveAvatar(db: SqlClient, userId: number, body: Record<string, unknown>) {
  const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback
  const avatar: Avatar = {
    gender: body.gender === 'm' || body.gender === 'f' ? body.gender : 'f',
    hairStyle: body.hairStyle === 'long' || body.hairStyle === 'bob' || body.hairStyle === 'short' ? body.hairStyle : 'short',
    hair: color(body.hair, '#1f2937'), skin: color(body.skin, '#f1c7a5'), eyes: color(body.eyes, '#7c3aed'), robe: color(body.robe, '#4c1d95'),
  }
  if (typeof body.preset === 'string' && /^hero-[mf][1-9]$/.test(body.preset)) avatar.preset = body.preset
  await db.execute('INSERT INTO player_progress (user_id,avatar) VALUES (?,?) ON DUPLICATE KEY UPDATE avatar = VALUES(avatar)', [userId, JSON.stringify(avatar)])
  return { avatar }
}

const RESULT_QUERY = `SELECT r.*, s.title AS scenario_title, s.content AS scenario_content,
  a.code AS archetype_code, a.name AS archetype_name, a.title AS archetype_title,
  a.description AS archetype_description, a.strengths, a.tips, a.color, a.icon
  FROM assessment_results r LEFT JOIN scenarios s ON s.id = r.scenario_id LEFT JOIN archetype_master a ON a.id = r.archetype_id`

export function formatResult(row: Record<string, unknown>, withItems = false) {
  let items: unknown[] = []
  if (withItems && row.choices_log && row.scenario_content) {
    try { items = evaluate(JSON.parse(String(row.scenario_content)), JSON.parse(String(row.choices_log))).items }
    catch (error) { if (!(error instanceof ApiError)) throw error }
  }
  const result: Record<string, unknown> = { ...row, items, strengths: JSON.parse(String(row.strengths ?? '[]')), tips: JSON.parse(String(row.tips ?? '[]')) }
  delete result.choices_log
  delete result.scenario_content
  for (const key of TAG_KEYS) result[key] = Number(row[key])
  return result
}
export async function results(db: SqlClient, userId: number) {
  return { results: (await db.rows<Record<string, unknown>>(RESULT_QUERY + ' WHERE r.user_id = ? ORDER BY r.completed_at DESC', [userId])).map(row => formatResult(row)) }
}
export async function result(db: SqlClient, userId: number, id: number) {
  const row = (await db.rows<Record<string, unknown>>(RESULT_QUERY + ' WHERE r.id = ? AND r.user_id = ?', [id, userId]))[0]
  if (!row) throw new ApiError(404, 'ไม่พบผลลัพธ์')
  return { result: formatResult(row, true) }
}
export async function studentProfile(db: SqlClient, userId: number) {
  const term = await currentTerm(db)
  const rows = await db.rows<AssessmentRow>(`SELECT r.* FROM assessment_results r JOIN scenarios s ON s.id = r.scenario_id WHERE r.user_id = ? AND s.is_universal = 1 AND ${LATEST} ORDER BY r.completed_at, r.id`, [userId])
  const total = await totalUniversal(db)
  const base = { completed: rows.length, total, ...term }
  if (!rows.length) return { profile: null, ...base }
  const { scores, summary } = combinedScores(rows)
  const archetype = (await db.rows<Archetype>(`SELECT ${ARCHETYPE_COLUMNS} FROM archetype_master WHERE riasec_key = ? LIMIT 1`, [summary.archetype_key]))[0]
  return { profile: formatResult({
    ...scores, ...archetype, rarity: coreRarity(rows.length, total), id: 0,
    choices_log: null, scenario_content: null, scenario_title: 'Core Profile', ...term,
    completed_at: rows.at(-1)!.completed_at, dominant_vark: summary.dominant_vark,
    dominant_riasec: summary.dominant_riasec, mindset_type: summary.mindset_type,
  }), ...base }
}
