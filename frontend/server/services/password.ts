import { compare, hash } from 'bcryptjs'
import { ApiError, charLength } from '../utils/errors'

export function assertStrong(password: string, username: string) {
  if (charLength(password) < 6) throw new ApiError(422, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร')
  if (password.toLowerCase() === username.toLowerCase()) throw new ApiError(422, 'รหัสผ่านใหม่ต้องไม่เหมือนชื่อผู้ใช้/รหัสนักศึกษา')
  if (charLength(password) > 72) throw new ApiError(422, 'รหัสผ่านยาวเกินไป (ไม่เกิน 72 ตัวอักษร)')
}

export async function verifyPassword(password: string, encoded: string) {
  // PHP bcrypt is $2y$; bcryptjs accepts the same format. NUL is rejected by PHP.
  if (password.includes('\0') || !/^\$2[aby]\$/.test(encoded)) return false
  try { return await compare(password, encoded) } catch { return false }
}

export async function hashPassword(password: string) {
  if (password.includes('\0')) throw new ApiError(422, 'รหัสผ่านมีอักขระที่ไม่รองรับ')
  // PHP 8.2 PASSWORD_DEFAULT uses bcrypt cost 10; keep PHP-compatible output.
  return (await hash(password, 10)).replace(/^\$2b\$/, '$2y$')
}
