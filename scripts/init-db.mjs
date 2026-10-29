import { createConnection } from 'mysql2/promise'
import { hash } from 'bcryptjs'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Fresh installation only. Existing databases are never reset or silently upgraded.
if (!process.argv.includes('--create-empty')) throw new Error('Use --create-empty to explicitly initialize an empty database')
const name = process.env.DB_NAME || 'gamified'
if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Invalid database name')
const schema = readFileSync(new URL('../docs/database/schema.sql', import.meta.url), 'utf8')
const start = schema.indexOf('-- แผนกวิชา')
if (start < 0) throw new Error('Unrecognized schema layout; refusing to execute')
const tablesOnly = schema.slice(start)
if (/\b(?:DROP\s+TABLE|DROP\s+DATABASE|TRUNCATE|USE\s+gamified)\b/i.test(tablesOnly)) throw new Error('Destructive schema statement detected')
const seeds = JSON.parse(readFileSync(new URL('./base-seed.json', import.meta.url), 'utf8'))
const scenarios = seeds.universal.map(([file, title, description]) => ({ title, description, content: JSON.parse(readFileSync(new URL(`../docs/database/scenarios/${file}.json`, import.meta.url), 'utf8')) }))
const db = await createConnection({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'arcana', password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4_unicode_ci', multipleStatements: true,
})
try {
  const [tables] = await db.execute('SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ?', [name])
  if (Number(tables[0].count) !== 0) throw new Error('Database contains tables; refusing to initialize. Use reviewed upgrades instead.')
  await db.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await db.changeUser({ database: name })
  await db.query("SET time_zone = '+07:00'")
  await db.query(tablesOnly)
  await db.query('CREATE TABLE schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB')
  await db.beginTransaction()
  try {
    const password = process.env.ADMIN_PASSWORD || 'admin1234'
    await db.execute('INSERT INTO users (username,password_hash,full_name,role,must_change_password) VALUES (?,?,?,?,?)', ['admin', (await hash(password, 10)).replace(/^\$2b\$/, '$2y$'), 'ผู้ดูแลระบบ', 'admin', process.env.ADMIN_PASSWORD ? 0 : 1])
    const [admins] = await db.execute("SELECT id FROM users WHERE username = 'admin'")
    for (const archetype of seeds.archetypes) {
      const values = [...archetype]
      values[4] = JSON.stringify(values[4])
      values[5] = JSON.stringify(values[5])
      await db.execute('INSERT INTO archetype_master (code,name,title,description,strengths,tips,riasec_key,color,icon) VALUES (?,?,?,?,?,?,?,?,?)', values)
    }
    for (const scenario of scenarios) {
      await db.execute("INSERT INTO scenarios (title,description,owner_id,is_universal,is_active,status,content) VALUES (?,?,?,1,1,'published',?)", [scenario.title, scenario.description, admins[0].id, JSON.stringify(scenario.content)])
    }
    const settings = { ai_enabled: '1', ai_central_key_enc: '', ai_central_key_hint: '', ai_central_model: '', institution_name: 'วิทยาลัยการอาชีพศรีสะเกษ', institution_affiliation: 'สำนักงานคณะกรรมการการอาชีวศึกษา กระทรวงศึกษาธิการ' }
    for (const [key, value] of Object.entries(settings)) await db.execute('INSERT INTO settings (setting_key,setting_value) VALUES (?,?)', [key, value])
    for (const file of readdirSync(fileURLToPath(new URL('../docs/database/upgrades/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
      await db.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file])
    }
    await db.commit()
  } catch (error) { await db.rollback(); throw error }
  console.log('Initialized empty database: 20 tables, admin account, 6 archetypes, 3 quests. No demo users. Existing databases are never reset.')
} finally { await db.end() }
