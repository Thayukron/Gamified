import { randomBytes } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { useRuntimeConfig } from '#imports'
import type { SqlClient } from './db'
import { ApiError } from './errors'
import { encryptWithKey, decryptWithKey } from './cryptoFormat'
export { keyHint } from './cryptoFormat'
async function loadKey(db: SqlClient, create: boolean): Promise<Buffer> {
  const path = resolve(useRuntimeConfig().appKeyPath)
  try {
    const key = Buffer.from((await readFile(path, 'utf8')).trim(), 'base64')
    if (key.length !== 32) throw new ApiError(500, 'ไฟล์ app.key ไม่ถูกต้อง กรุณากู้คืนจากข้อมูลสำรอง')
    return key
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    if (!create) throw new ApiError(500, 'ไม่พบ app.key กรุณากู้คืนกุญแจเดิมก่อนใช้งาน AI')
    const existing = (await db.rows<{ n: number }>("SELECT (SELECT COUNT(*) FROM user_ai_settings WHERE api_key_enc IS NOT NULL AND api_key_enc<>'')+(SELECT COUNT(*) FROM settings WHERE setting_key='ai_central_key_enc' AND setting_value IS NOT NULL AND setting_value<>'') AS n"))[0]!.n
    if (Number(existing)) throw new ApiError(500, 'ไม่พบ app.key แต่มี API Key ที่เข้ารหัสอยู่ กรุณากู้คืนกุญแจเดิม')
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    try { await writeFile(path, randomBytes(32).toString('base64'), { flag: 'wx', mode: 0o600 }) }
    catch (writeError) { if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError }
    return loadKey(db, false)
  }
}
export async function encryptSecret(db: SqlClient, key: string) { return encryptWithKey(key, await loadKey(db, true)) }
export async function decryptSecret(db: SqlClient, value: string | null) { return value ? decryptWithKey(value, await loadKey(db, false)) : null }
