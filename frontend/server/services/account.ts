import type { AccountProfile, AuthUser } from '../../shared/types/auth'
import type { SqlClient } from '../utils/db'
import { ApiError, charLength, inputString, phpTrim } from '../utils/errors'
import { tokenHash } from './auth'
import { assertStrong, hashPassword, verifyPassword } from './password'

export async function profile(db: SqlClient, user: AuthUser) {
  const row = (await db.rows<AccountProfile>(
    'SELECT u.id, u.username, u.full_name, u.role, u.student_code, u.class_group, u.must_change_password, u.created_at, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id WHERE u.id = ?', [user.id],
  ))[0]
  if (!row) throw new ApiError(401, 'กรุณาเข้าสู่ระบบ')
  return { profile: { ...row, must_change_password: Boolean(row.must_change_password), can_edit_name: row.role !== 'student' } }
}

export async function updateProfile(db: SqlClient, user: AuthUser, body: Record<string, unknown>) {
  if (user.role === 'student') throw new ApiError(403, 'ชื่อ-สกุลของนักศึกษาแก้ไขได้โดยผู้ดูแลระบบ (ตามข้อมูลทะเบียน)')
  const fullName = phpTrim(inputString(body.full_name).replace(/\s+/gu, ' '))
  if (!fullName || charLength(fullName) > 150) throw new ApiError(422, 'กรุณากรอกชื่อ-สกุล (ไม่เกิน 150 ตัวอักษร)')
  await db.execute('UPDATE users SET full_name = ? WHERE id = ?', [fullName, user.id])
  return profile(db, user)
}

async function credentials(db: SqlClient, user: AuthUser, password: unknown) {
  const row = (await db.rows<{ username: string; password_hash: string }>('SELECT username, password_hash FROM users WHERE id = ?', [user.id]))[0]
  if (!row || !await verifyPassword(inputString(password), row.password_hash)) throw new ApiError(422, 'รหัสผ่านปัจจุบันไม่ถูกต้อง')
  return row
}

export async function changeUsername(db: SqlClient, user: AuthUser, body: Record<string, unknown>) {
  if (user.role === 'student') throw new ApiError(403, 'ชื่อผู้ใช้ของนักศึกษาคือรหัสนักศึกษา แก้ไขได้โดยผู้ดูแลระบบ')
  const password = inputString(body.current_password)
  const row = await credentials(db, user, password)
  const username = phpTrim(inputString(body.username))
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new ApiError(422, 'ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ ตัวเลข หรือ . _ - ยาว 3–50 ตัว (ไม่มีช่องว่าง)')
  if (username === row.username) throw new ApiError(422, 'ชื่อผู้ใช้ใหม่เหมือนชื่อเดิม')
  if (username.toLowerCase() === password.toLowerCase()) throw new ApiError(422, 'ชื่อผู้ใช้ต้องไม่เหมือนรหัสผ่าน')
  const duplicate = (await db.rows<{ count: number }>('SELECT COUNT(*) AS count FROM users WHERE (username = ? OR student_code = ?) AND id <> ?', [username, username, user.id]))[0]
  const conflict = () => new ApiError(409, `ชื่อผู้ใช้ ${username} มีผู้ใช้แล้ว — ลองชื่ออื่น`)
  if (Number(duplicate?.count)) throw conflict()
  try { await db.execute('UPDATE users SET username = ? WHERE id = ?', [username, user.id]) }
  catch (error) {
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw conflict()
    throw error
  }
  return { ...await profile(db, user), message: `เปลี่ยนชื่อผู้ใช้เป็น ${username} แล้ว — ครั้งต่อไปเข้าสู่ระบบด้วยชื่อนี้` }
}

// Caller runs this service in one transaction, so password and token revocations are atomic.
export async function changePassword(db: SqlClient, user: AuthUser, token: string, body: Record<string, unknown>) {
  const row = await credentials(db, user, body.current_password)
  const password = inputString(body.new_password)
  assertStrong(password, row.username)
  if (await verifyPassword(password, row.password_hash)) throw new ApiError(422, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม')
  await db.execute('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [await hashPassword(password), user.id])
  await db.execute('DELETE FROM auth_tokens WHERE user_id = ? AND token_hash <> ?', [user.id, tokenHash(token)])
  return { ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อย · อุปกรณ์อื่นที่เคยเข้าสู่ระบบถูกออกจากระบบแล้ว' }
}

export async function forgot(db: SqlClient, body: Record<string, unknown>) {
  const username = phpTrim(inputString(body.username))
  if (!username) throw new ApiError(422, 'กรุณากรอกชื่อผู้ใช้หรือรหัสนักศึกษา')
  const user = (await db.rows<{ id: number }>('SELECT id FROM users WHERE (username = ? OR student_code = ?) AND is_active = 1 LIMIT 1', [username, username]))[0]
  if (user) {
    const pending = (await db.rows<{ count: number }>("SELECT COUNT(*) AS count FROM password_reset_requests WHERE user_id = ? AND status = 'pending'", [user.id]))[0]
    if (!Number(pending?.count)) {
      const note = Array.from(phpTrim(inputString(body.note))).slice(0, 200).join('')
      await db.execute('INSERT INTO password_reset_requests (user_id, note) VALUES (?, ?)', [user.id, note === '' || note === '0' ? null : note])
    }
  }
  return { ok: true, message: 'ส่งคำขอแล้ว — ผู้ดูแลระบบหรือครูประจำวิชาจะรีเซ็ตให้ จากนั้นเข้าสู่ระบบด้วยรหัสผ่านชั่วคราว = ชื่อผู้ใช้/รหัสนักศึกษา แล้วตั้งรหัสผ่านใหม่ (แจ้งครูในชั้นเรียนเพื่อให้เร็วขึ้น)' }
}
