import type { AuthUser } from '../../shared/types/auth'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from '../utils/db'
import { inputString } from '../utils/errors'
import { course } from '../utils/ownership'
import { aiStatus } from './aiSettings'
import { allCached, generateGuide } from './aiGeneration'
import { cachedInsight, classData } from './teacherDashboard'
export async function courseCached(db: SqlClient, user: AuthUser, id: number, query: StaffRecord) {
  const data = await course(db, user, id), dash = await classData(db, data), type = inputString(query.type ?? 'course'), topic = type === 'unit' ? inputString(query.topic) : null
  return { result: await cachedInsight(db, data, dash, type, topic), ai: await aiStatus(db, user.id) }
}
export async function courseCachedAll(db: SqlClient, user: AuthUser, id: number) {
  const data = await course(db, user, id)
  return allCached(db, user.id, data, await classData(db, data))
}
export async function courseGenerate(db: SqlClient, user: AuthUser, id: number, body: StaffRecord, signal?: AbortSignal) {
  const data = await course(db, user, id), type = inputString(body.type ?? 'course')
  return { result: await generateGuide(db, user.id, data, await classData(db, data), type, type === 'unit' ? inputString(body.topic) : null, signal) }
}
