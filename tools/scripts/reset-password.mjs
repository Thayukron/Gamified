// Emergency password reset (replaces backend/bin/reset-password.php).
// Usage:  node --env-file-if-exists=.env tools/scripts/reset-password.mjs <username> [new-password]
// Without new-password the password becomes the username itself and the user must change it on first login.
import { createConnection } from 'mysql2/promise'
import { hash } from 'bcryptjs'

const [, , username, newPassword] = process.argv
if (!username) {
  console.error('Usage: node tools/scripts/reset-password.mjs <username> [new-password]')
  process.exit(1)
}

const db = await createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'arcana',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gamified',
})

const [rows] = await db.execute('SELECT id, username FROM users WHERE username = ?', [username])
const user = rows[0]
if (!user) {
  console.error(`User not found: ${username}`)
  process.exit(1)
}

const password = newPassword || user.username
const hashValue = (await hash(password, 10)).replace(/^\$2b\$/, '$2y$')
await db.execute('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [hashValue, user.id])
await db.execute('DELETE FROM auth_tokens WHERE user_id = ?', [user.id])
await db.end()

if (newPassword) {
  console.log(`Password for "${user.username}" reset to the custom value you provided.`)
} else {
  console.log(`Password for "${user.username}" reset to the username itself — the user must change it on first login.`)
}
