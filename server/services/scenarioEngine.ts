import type { GameStats, Reward, ScenarioContent, ScoredScene, ScoredChoice } from '../../shared/types/game'
import { ApiError } from '../utils/errors'

export const VARK = ['vark_v', 'vark_a', 'vark_r', 'vark_k'] as const
export const RIASEC = ['riasec_r', 'riasec_i', 'riasec_a', 'riasec_s', 'riasec_e', 'riasec_c'] as const
export const MINDSET = ['mindset_growth', 'mindset_fixed'] as const
export const TAG_KEYS = [...VARK, ...RIASEC, ...MINDSET]
export type TagKey = typeof TAG_KEYS[number]
export type Scores = Record<TagKey, number>
export const emptyScores = (): Scores => Object.fromEntries(TAG_KEYS.map(key => [key, 0])) as Scores

// JSON objects are associative arrays in the PHP engine; an empty one is falsey there.
const phpTruthy = (value: unknown) => value != null && value !== false && value !== 0 && value !== '' && value !== '0'
  && (typeof value !== 'object' || Object.keys(value).length > 0)

// PHP (int) accepts numeric prefixes and truncates toward zero.
export function phpInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0
  if (typeof value === 'boolean') return Number(value)
  if (typeof value === 'string') return Math.trunc(Number(value.trimStart().match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i)?.[0] || 0))
  return value && typeof value === 'object' ? Number(Object.keys(value).length > 0) : 0
}

export function forPlayer(content: ScenarioContent): ScenarioContent {
  const copy = structuredClone(content)
  for (const scene of Object.values(copy.scenes)) for (const choice of scene.choices ?? []) delete choice.tags
  // PHP json_decode(..., true) + json_encode emits empty associative objects as [].
  return JSON.parse(JSON.stringify(copy, (_key, value) => value && typeof value === 'object'
    && !Array.isArray(value) && Object.keys(value).length === 0 ? [] : value)) as ScenarioContent
}

export function evaluate(content: ScenarioContent, log: unknown[]) {
  const scores = emptyScores()
  const path: string[] = []
  const tag_history: TagKey[][] = []
  const items: Reward[] = []
  const stats: GameStats = { choices: 0, wins: 0, fails: 0 }
  let sceneId: string | null | undefined = content.start
  let logIndex = 0
  for (let step = 0; step < 500; step++) {
    const scene: ScoredScene | undefined = sceneId != null && Object.hasOwn(content.scenes ?? {}, sceneId) ? content.scenes[sceneId] : undefined
    if (!scene) throw new ApiError(422, `ไม่พบฉาก ${sceneId ?? ''}`)
    path.push(sceneId!)
    if (phpTruthy(scene.end)) {
      if (logIndex !== log.length) throw new ApiError(422, 'ข้อมูลการเล่นไม่ถูกต้อง (มีขั้นตอนเกิน)')
      return { scores, path, tag_history, items, stats }
    }
    if (scene.choices?.length) {
      if (logIndex >= log.length || log[logIndex] == null) throw new ApiError(422, 'ยังเล่นไม่จบเรื่อง')
      const entry = log[logIndex] as { scene?: unknown; choice?: unknown } | null
      const choice: ScoredChoice | undefined = scene.choices[phpInt(entry?.choice ?? -1)]
      if (entry?.scene !== sceneId || !choice) throw new ApiError(422, 'ข้อมูลการเล่นไม่ถูกต้อง')
      const applied: TagKey[] = []
      for (const [key, value] of Object.entries(choice.tags ?? {})) {
        if (Object.hasOwn(scores, key)) {
          scores[key as TagKey] += phpInt(value)
          applied.push(key as TagKey)
        }
      }
      tag_history.push(applied)
      stats.choices++
      if (choice.reward && phpTruthy(choice.reward.name)) items.push(choice.reward)
      logIndex++
      sceneId = choice.next ?? scene.next
    } else if (phpTruthy(scene.minigame)) {
      if (logIndex >= log.length || log[logIndex] == null) throw new ApiError(422, 'ยังเล่นไม่จบเรื่อง')
      const entry = log[logIndex] as { scene?: unknown; outcome?: unknown } | null
      if (entry?.scene !== sceneId || (entry?.outcome !== 'success' && entry?.outcome !== 'fail')) throw new ApiError(422, 'ข้อมูลการเล่นไม่ถูกต้อง')
      stats[entry?.outcome === 'fail' ? 'fails' : 'wins']++
      logIndex++
      sceneId = entry?.outcome === 'fail' ? (scene.fail_next ?? scene.next) : scene.next
    } else { sceneId = scene.next }
  }
  throw new ApiError(422, 'เนื้อเรื่องวนซ้ำไม่สิ้นสุด')
}

export function recency(tagHistory: string[][]) {
  const last: Record<string, number> = {}
  tagHistory.forEach((keys, index) => { for (const key of keys) last[key] = index })
  return last
}

export function profile(scores: Scores, recent: Record<string, number>) {
  const vark = Object.entries(scores).filter(([key]) => (VARK as readonly string[]).includes(key))
  const max = Math.max(...vark.map(([, value]) => value))
  const dominant_vark = max > 0 ? vark.filter(([, value]) => value === max).map(([key]) => key.at(-1)!.toUpperCase()).join('') : null
  const keys = Object.keys(scores).filter(key => (RIASEC as readonly string[]).includes(key)) as TagKey[]
  keys.sort((a, b) => scores[b] - scores[a] || (recent[b] ?? -1) - (recent[a] ?? -1))
  const dominant_riasec = keys.slice(0, 3).map(key => key.at(-1)!.toUpperCase()).join('')
  const g = scores.mindset_growth, f = scores.mindset_fixed
  return {
    dominant_vark, dominant_riasec,
    mindset_type: g > f ? 'growth' : f > g ? 'fixed' : 'mixed',
    archetype_key: dominant_riasec[0]!,
  }
}

export function validate(content: ScenarioContent): string[] {
  const errors: string[] = []
  const scenes = content.scenes
  if (!scenes || typeof scenes !== 'object' || !Object.keys(scenes).length) return ['ต้องมีอย่างน้อย 1 ฉาก']
  const exists = (id: string | null | undefined) => id != null && Object.hasOwn(scenes, id)
  if (!exists(content.start)) errors.push('ฉากเริ่มต้น (start) ไม่ถูกต้อง')
  let hasEnd = false
  for (const [id, scene] of Object.entries(scenes)) {
    hasEnd ||= phpTruthy(scene.end)
    if (!phpTruthy(scene.end) && !scene.choices?.length && !exists(scene.next)) errors.push(`ฉาก ${id} ไม่มีทางไปต่อ`)
    if (phpTruthy(scene.minigame) && scene.fail_next != null && !exists(scene.fail_next)) errors.push(`ฉาก ${id}: fail_next ชี้ไปฉากที่ไม่มีอยู่`)
    for (const [index, choice] of (scene.choices ?? []).entries()) {
      if (!exists(choice.next)) errors.push(`ฉาก ${id} ตัวเลือกที่ ${index + 1} ชี้ไปฉากที่ไม่มีอยู่`)
      for (const tag of Object.keys(choice.tags ?? {})) if (!(TAG_KEYS as string[]).includes(tag)) errors.push(`ฉาก ${id} มีแท็กคะแนนไม่รู้จัก: ${tag}`)
    }
  }
  if (!hasEnd) errors.push('ต้องมีฉากจบ (end) อย่างน้อย 1 ฉาก')
  return errors
}
