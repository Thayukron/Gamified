import { createConnection } from 'mysql2/promise'
import { readFileSync, readdirSync } from 'node:fs'
const directory = new URL('../../docs/database/upgrades/', import.meta.url)
const db = await createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'arcana', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'gamified', multipleStatements: true })
let locked = false
try {
  const [lock] = await db.execute("SELECT GET_LOCK('arcana-schema-upgrades',10) AS acquired")
  if (!lock[0].acquired) throw new Error('Another schema upgrade is running')
  locked = true
  // Databases created by the former PHP installer may have no migration ledger.
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB')
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
  // Repair older installations whose migration ledger does not match the schema.
  const [lease] = await db.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='background_jobs' AND COLUMN_NAME='lease_until'")
  if (!lease.length) {
    await db.query(readFileSync(new URL('2026-10-29_job_lease.sql', directory), 'utf8'))
    console.log('Repaired background_jobs.lease_until')
  }
  console.log('Database upgrade complete: background_jobs.lease_until verified')
} finally {
  if (locked) await db.query("SELECT RELEASE_LOCK('arcana-schema-upgrades')")
  await db.end()
}
