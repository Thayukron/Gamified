import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

// Read source only. Does not bootstrap PHP, connect to MariaDB, or read secrets.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(resolve(root, path), 'utf8').replace(/\r\n/g, '\n')
const routesSource = read('backend/routes.php')
const background = [...(routesSource.match(/\$router->background\(([\s\S]*?)\);/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1])
const routes = []
for (const [index, line] of routesSource.split('\n').entries()) {
  const match = line.match(/^\$router->(get|post|put|delete)\('([^']+)'\s*,\s*(.*)\);$/)
  if (!match) continue
  const [, method, path, rest] = match
  const handler = rest.match(/\[([\w\\]+)::class,\s*'(\w+)'\]/)
  const roles = [...(rest.match(/,\s*\[([^\]]*)\]$/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1])
  let source = 'backend/routes.php'
  let sourceLine = index + 1
  let body = line
  let handlerName = 'inline'
  if (handler) {
    const className = handler[1].split('\\').at(-1)
    source = `backend/src/${className === 'BackgroundJob' ? 'Core' : 'Controllers'}/${className}.php`
    const content = read(source)
    const start = content.indexOf(`public static function ${handler[2]}(`)
    if (start < 0) throw new Error(`Missing handler: ${source}::${handler[2]}`)
    const next = content.slice(start + 1).search(/\n    (?:public|private|protected) (?:static )?function /)
    body = next < 0 ? content.slice(start) : content.slice(start, start + 1 + next)
    sourceLine = content.slice(0, start).split('\n').length
    handlerName = `${className}::${handler[2]}`
  }
  routes.push({
    method: method.toUpperCase(), path, roles,
    handler: handlerName, source, sourceLine,
    target: `frontend/server/api${path.replace(/\{(\w+)\}/g, '[$1]')}.${method}.ts`,
    background: method === 'post' && background.includes(path),
    // Direct field references only; shared helper/service inputs are also part of the contract.
    directBodyFields: [...new Set([...body.matchAll(/\$req->input\('([^']+)'/g)].map(m => m[1]))],
    directQueryFields: [...new Set([...body.matchAll(/\$req->query\('([^']+)'/g)].map(m => m[1]))],
  })
}
const declarations = [...routesSource.matchAll(/^\$router->(?:get|post|put|delete)\(/gm)].length
if (routes.length !== declarations || new Set(routes.map(r => `${r.method} ${r.path}`)).size !== routes.length) {
  throw new Error('Unparsed or duplicate routes')
}
const tables = [...read('backend/database/schema.sql').matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g)].map(m => m[1])
const schemaFiles = ['backend/database/schema.sql', ...readdirSync(resolve(root, 'backend/database/upgrades')).filter(f => f.endsWith('.sql')).sort().map(f => `backend/database/upgrades/${f}`)]
const manifest = { formatVersion: 1, prefix: '/api', routes, tables, migrationTrackingTable: 'schema_migrations', schemaHashes: Object.fromEntries(schemaFiles.map(f => [f, createHash('sha256').update(read(f)).digest('hex')])) }
const json = JSON.stringify(manifest, null, 2) + '\n'
const md = [
  '# API mapping: PHP → Nuxt 3', '',
  '> สร้างด้วย `node tools/migration-inventory.mjs` จาก source ปัจจุบัน ไม่เชื่อมฐานข้อมูล', '',
  `จำนวน ${routes.length} endpoints, ${tables.length} domain tables และ schema_migrations อีก 1 ตาราง`, '',
  'Path ทุกตัวอยู่ใต้ `/api`; public = ไม่ต้อง login, * = ทุก role ที่ login แล้ว', '',
  'รายการ field ใน JSON เป็นการอ้างอิงโดยตรงใน handler เท่านั้น ต้องตรวจ helper/service และ response ทุก branch ก่อนย้ายแต่ละ endpoint ไม่ถือเป็น OpenAPI หรือผลทดสอบ compatibility', '',
  '| Method | Path | Roles | PHP handler | Nuxt target | Async |',
  '|---|---|---|---|---|---|',
  ...routes.map(r => `| ${r.method} | \`${r.path}\` | ${r.roles.join(', ') || 'public'} | [${r.handler}](../../${r.source}#L${r.sourceLine}) | \`${r.target.replace('frontend/', '')}\` | ${r.background ? '202 + poll' : '—'} |`),
  '', '## Tables', '', ...tables.map(t => `- \`${t}\``), '',
].join('\n')
const outputs = { 'docs/migration/api-inventory.json': json, 'docs/migration/api-map.md': md }
if (process.argv.includes('--check')) {
  for (const [path, expected] of Object.entries(outputs)) {
    if (read(path) !== expected) throw new Error(`${path} differs; regenerate the inventory`)
  }
} else {
  mkdirSync(resolve(root, 'docs/migration'), { recursive: true })
  for (const [path, value] of Object.entries(outputs)) writeFileSync(resolve(root, path), value, 'utf8')
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Generated'} ${routes.length} routes, ${routes.filter(r => r.background).length} background routes, ${tables.length} domain tables + schema_migrations. No database access.`)
