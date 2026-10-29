import { createConnection } from 'mysql2/promise'
import { readFileSync, readdirSync } from 'node:fs'
const directory = new URL('../database/upgrades/', import.meta.url)
const db = await createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'arcana', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'gamified', multipleStatements: true })
let locked = false
try {
  const [lock] = await db.execute("SELECT GET_LOCK('arcana-schema-upgrades',10) AS acquired")
  if (!lock[0].acquired) throw new Error('Another schema upgrade is running')
  locked = true
  const [rows] = await db.query('SELECT name FROM schema_migrations')
  const done = new Set(rows.map(row => row.name))
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    if (done.has(name)) continue
    const sql = readFileSync(new URL(name, directory), 'utf8')
    if (/\b(?:DROP\s+(?:TABLE|DATABASE)|TRUNCATE)\b/i.test(sql)) throw new Error(`Refusing destructive upgrade: ${name}`)
    await db.query(sql)
    await db.execute('INSERT INTO schema_migrations (name) VALUES (?)', [name])
    console.log(`Applied ${name}`)
  }
} finally {
  if (locked) await db.query("SELECT RELEASE_LOCK('arcana-schema-upgrades')")
  await db.end()
}
