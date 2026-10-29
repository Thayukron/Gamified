import { useRuntimeConfig } from '#imports'
import type { SqlClient } from '../utils/db'
import { transaction } from '../utils/db'
import type { StaffRecord } from '../../shared/types/staff'
import { ApiError, inputString } from '../utils/errors'
import { bool, text } from '../utils/staff'
import { decryptSecret, encryptSecret, keyHint } from '../utils/crypto'
import { GeminiClient, pickDefault } from './gemini'

export const aiClient = (key: string, db: SqlClient, signal?: AbortSignal) => {
  const config = useRuntimeConfig()
  return new GeminiClient(key, db, { baseUrl: config.geminiBaseUrl, timeoutSeconds: Number(config.geminiTimeoutSeconds), signal })
}
export async function setting(db: SqlClient, key: string) { return (await db.rows<{ setting_value: string | null }>('SELECT setting_value FROM settings WHERE setting_key=?', [key]))[0]?.setting_value ?? null }
export const aiEnabled = async (db: SqlClient) => await setting(db, 'ai_enabled') === '1'
async function userSettings(db: SqlClient, userId: number): Promise<StaffRecord> {
  return (await db.rows<StaffRecord>('SELECT * FROM user_ai_settings WHERE user_id=?', [userId]))[0] ?? { user_id: userId, api_key_enc: null, key_hint: null, model: null, central_allowed: 0, verified_at: null }
}
export async function resolveAI(db: SqlClient, userId: number) {
  const own = await userSettings(db, userId), key = await decryptSecret(db, own.api_key_enc)
  if (key) return { source: 'own', key, model: own.model as string | null }
  const central = await decryptSecret(db, await setting(db, 'ai_central_key_enc'))
  if (Number(own.central_allowed) === 1 && central) return { source: 'central', key: central, model: await setting(db, 'ai_central_model') }
  return { source: null, key: null, model: null }
}
export async function aiStatus(db: SqlClient, userId: number) {
  const own = await userSettings(db, userId)
  return { enabled: await aiEnabled(db), provider: 'gemini', has_own_key: bool(own.api_key_enc), key_hint: own.key_hint, model: own.model, verified_at: own.verified_at, central_allowed: Number(own.central_allowed) === 1 && bool(await setting(db, 'ai_central_key_enc')), active_source: (await resolveAI(db, userId)).source }
}
export async function ownAIStatus(db: SqlClient, userId: number) { return { ai: await aiStatus(db, userId) } }
export async function saveKey(db: SqlClient, userId: number, body: StaffRecord) {
  const key = text(body.api_key)
  if (Buffer.byteLength(key) < 20 || /\s/.test(key)) throw new ApiError(422, 'รูปแบบ API Key ไม่ถูกต้อง')
  const models = await aiClient(key, db).listModels()
  if (!models.length) throw new ApiError(422, 'API Key นี้ไม่มีโมเดลที่ใช้สร้างข้อความได้')
  const model = models.includes(body.model) ? body.model : pickDefault(models)
  await db.execute("INSERT INTO user_ai_settings (user_id,provider,api_key_enc,key_hint,model,verified_at) VALUES (?,'gemini',?,?,?,NOW()) ON DUPLICATE KEY UPDATE api_key_enc=VALUES(api_key_enc),key_hint=VALUES(key_hint),model=VALUES(model),verified_at=NOW()", [userId, await encryptSecret(db, key), keyHint(key), model])
  return { ai: await aiStatus(db, userId), models }
}
export async function testKey(db: SqlClient, userId: number) {
  const resolved = await resolveAI(db, userId)
  if (!resolved.key) throw new ApiError(409, 'ยังไม่ได้กรอก API Key')
  const models = await aiClient(resolved.key, db).listModels()
  if (resolved.source === 'own') await db.execute('UPDATE user_ai_settings SET verified_at=NOW() WHERE user_id=?', [userId])
  return { ok: true, models, model: resolved.model, source: resolved.source }
}
export async function setModel(db: SqlClient, userId: number, body: StaffRecord) {
  const resolved = await resolveAI(db, userId)
  if (resolved.source !== 'own' || !resolved.key) throw new ApiError(409, 'เลือกรุ่นได้เมื่อใช้ API Key ของตนเอง')
  const model = inputString(body.model)
  if (!(await aiClient(resolved.key, db).listModels()).includes(model)) throw new ApiError(422, 'API Key นี้ใช้รุ่นดังกล่าวไม่ได้')
  await db.execute('UPDATE user_ai_settings SET model=? WHERE user_id=?', [model, userId])
  return { ai: await aiStatus(db, userId) }
}
export async function removeKey(db: SqlClient, userId: number) {
  await db.execute('UPDATE user_ai_settings SET api_key_enc=NULL,key_hint=NULL,model=NULL,verified_at=NULL WHERE user_id=?', [userId])
  return { ai: await aiStatus(db, userId) }
}
export async function adminAI(db: SqlClient) {
  const settings = Object.fromEntries((await db.rows<{ setting_key: string; setting_value: string }>("SELECT setting_key,setting_value FROM settings WHERE setting_key LIKE 'ai_%'")).map(row => [row.setting_key, row.setting_value]))
  const teachers = await db.rows<StaffRecord>("SELECT u.id,u.full_name,u.username,d.name AS department_name,(a.api_key_enc IS NOT NULL) AS has_own_key,a.key_hint,COALESCE(a.central_allowed,0) AS central_allowed,(SELECT COUNT(*) FROM ai_insights_cache c WHERE c.created_by=u.id) AS ai_requests,(SELECT COALESCE(SUM(c.prompt_tokens+c.output_tokens),0) FROM ai_insights_cache c WHERE c.created_by=u.id AND c.key_source='central') AS central_tokens FROM users u LEFT JOIN departments d ON d.id=u.department_id LEFT JOIN user_ai_settings a ON a.user_id=u.id WHERE u.role='teacher' ORDER BY u.full_name")
  return { enabled: settings.ai_enabled === '1', central: { has_key: bool(settings.ai_central_key_enc), key_hint: settings.ai_central_key_hint ?? null, model: settings.ai_central_model ?? null }, teachers }
}
async function set(db: SqlClient, key: string, value: string) { await db.execute('INSERT INTO settings (setting_key,setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)', [key, value]) }
export async function adminSaveAI(db: SqlClient, body: StaffRecord) {
  // Validate the remote key before persisting any part of this settings change.
  let central: string[] | null = null
  if (Object.hasOwn(body, 'central_key')) {
    const key = text(body.central_key)
    if (!key) central = ['', '', '']
    else {
      const models = await aiClient(key, db).listModels()
      if (!models.length) throw new ApiError(422, 'API Key นี้ไม่มีโมเดลที่ใช้สร้างข้อความได้')
      central = [await encryptSecret(db, key), keyHint(key), pickDefault(models)!]
    }
  }
  await transaction(async tx => {
    if (Object.hasOwn(body, 'enabled')) await set(tx, 'ai_enabled', bool(body.enabled) ? '1' : '0')
    if (central) for (const [index, key] of ['ai_central_key_enc', 'ai_central_key_hint', 'ai_central_model'].entries()) await set(tx, key, central[index]!)
  })
  return adminAI(db)
}
export async function allowCentral(db: SqlClient, id: number, body: StaffRecord) {
  if (!(await db.rows<{ id: number }>("SELECT id FROM users WHERE id=? AND role='teacher'", [id]))[0]) throw new ApiError(404, 'ไม่พบครูผู้สอน')
  await db.execute('INSERT INTO user_ai_settings (user_id,central_allowed) VALUES (?,?) ON DUPLICATE KEY UPDATE central_allowed=VALUES(central_allowed)', [id, Number(bool(body.central_allowed))])
  return adminAI(db)
}
export async function enabledKey(db: SqlClient, userId: number, message = 'กรุณากรอก API Key ของ Gemini ที่หน้า “ตั้งค่า AI ของฉัน” ก่อน') {
  if (!await aiEnabled(db)) throw new ApiError(403, 'ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่')
  const resolved = await resolveAI(db, userId)
  if (!resolved.key) throw new ApiError(409, message)
  return resolved as { source: string; key: string; model: string | null }
}
