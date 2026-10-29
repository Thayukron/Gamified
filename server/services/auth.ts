import { createHash, randomBytes } from 'node:crypto'
import type { AuthUser, Role } from '../../shared/types/auth'
import type { SqlClient } from '../utils/db'
import { ApiError, inputString, phpTrim } from '../utils/errors'
import { verifyPassword } from './password'

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const bearerToken = (header = '') => header.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null

export async function requireUser(db: SqlClient, token: string | null, roles: (Role | '*')[], path: string) {
  const user = token ? (await db.rows<AuthUser>(
    'SELECT u.id, u.username, u.full_name, u.role, u.department_id, u.student_code, u.must_change_password FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.expires_at > NOW() AND u.is_active = 1',
    [tokenHash(token)],
  ))[0] : undefined
  if (!user) throw new ApiError(401, 'กรุณาเข้าสู่ระบบ')
  if (!roles.includes('*') && !roles.includes(user.role)) throw new ApiError(403, 'ไม่มีสิทธิ์เข้าถึง')
  assertPasswordGate(user, path)
  return user
}

export function assertPasswordGate(user: AuthUser, path: string) {
  if (user.must_change_password && !['/auth/me', '/auth/logout', '/me/profile', '/me/password'].includes(path)) {
    throw new ApiError(403, 'กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน')
  }
}

export async function login(db: SqlClient, body: Record<string, unknown>, ttlHours = 168) {
  const username = phpTrim(inputString(body.username))
  const password = inputString(body.password)
  if (!username || !password) throw new ApiError(422, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
  const row = (await db.rows<AuthUser & { password_hash: string }>(
    'SELECT id, username, password_hash, full_name, role, department_id, student_code, must_change_password FROM users WHERE username = ? AND is_active = 1', [username],
  ))[0]
  if (!row || !await verifyPassword(password, row.password_hash)) throw new ApiError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
  const { password_hash: _, ...user } = row
  user.must_change_password = Boolean(user.must_change_password)
  const token = randomBytes(32).toString('hex')
  await db.execute('INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))', [user.id, tokenHash(token), ttlHours])
  return { token, user }
}

export async function logout(db: SqlClient, token: string) {
  await db.execute('DELETE FROM auth_tokens WHERE token_hash = ?', [tokenHash(token)])
  return { ok: true }
}
