import { randomBytes } from 'node:crypto'
import { database } from '../utils/db'
import { ApiError } from '../utils/errors'
const pending = new Set<Promise<void>>()
// Heartbeat = updated_at (the schema is the same as main's): a running job touches it every 10 s; one not touched
// for 30 s is dead (process stopped) and is shown as an error instead of staying "running".
const ALIVE = 'updated_at>=NOW()-INTERVAL 30 SECOND'
const controllers = new Map<string, AbortController>()
export async function startJob(userId: number, path: string, work: (signal: AbortSignal) => Promise<unknown>) {
  const db = database(), id = randomBytes(16).toString('hex')
  await db.execute(`DELETE FROM background_jobs WHERE created_at<NOW()-INTERVAL 2 DAY AND (status<>'running' OR NOT ${ALIVE})`)
  await db.execute("INSERT INTO background_jobs (id,user_id,path,status) VALUES (?,?,?,'running')", [id, userId, path.slice(0, 255)])
  const controller = new AbortController()
  controllers.set(id, controller)
  const task = (async () => {
    // Yield so the 202 response is not held up by synchronous work in the handler.
    await new Promise<void>(resolve => setImmediate(resolve))
    let beating = false
    const heartbeat = setInterval(async () => {
      if (beating) return
      beating = true
      try {
        const result = await db.change!("UPDATE background_jobs SET updated_at=NOW() WHERE id=? AND status='running'", [id])
        if (!result.affected) controller.abort()
      } catch { /* polling detects a stale heartbeat if the DB/process stays unavailable */ }
      finally { beating = false }
    }, 10000)
    heartbeat.unref()
    let deadline: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { deadline = setTimeout(() => { controller.abort(); reject(new ApiError(504, 'งาน AI ใช้เวลาเกินกำหนด กรุณาลองใหม่')) }, 600000); deadline.unref() })
      let status = 'done', code = 200, result: unknown
      try { result = await Promise.race([work(controller.signal), timeout]) }
      catch (error) { status = 'error'; code = error instanceof ApiError ? error.status : 500; result = { error: error instanceof ApiError ? error.message : 'เกิดข้อผิดพลาดภายในระบบ' } }
      await db.execute("UPDATE background_jobs SET status=?,http_status=?,result=? WHERE id=? AND status='running'", [status, code, JSON.stringify(result), id])
    } finally { clearInterval(heartbeat); if (deadline) clearTimeout(deadline); controllers.delete(id) }
  })().catch(() => { console.error('Background job could not persist its result') })
  pending.add(task); void task.finally(() => pending.delete(task))
  return { response: { job_id: id, status: 'running' }, task }
}
export async function showJob(userId: number, id: string) {
  const db = database()
  await db.execute(`UPDATE background_jobs SET status='error',http_status=503,result=? WHERE id=? AND user_id=? AND status='running' AND NOT ${ALIVE}`, [JSON.stringify({ error: 'งาน AI ถูกหยุดระหว่างประมวลผล กรุณากดสร้างใหม่อีกครั้ง' }), id, userId])
  const row = (await db.rows<{ status: string; http_status: number | null; result: string | null }>('SELECT status,http_status,result FROM background_jobs WHERE id=? AND user_id=?', [id, userId]))[0]
  if (!row) throw new ApiError(404, 'ไม่พบงานนี้ (อาจหมดอายุแล้ว) — กรุณากดใหม่อีกครั้ง')
  if (row.status === 'error') controllers.get(id)?.abort()
  return { status: row.status, http_status: Number(row.http_status ?? 0), result: row.result !== null ? JSON.parse(row.result) : null }
}
export async function drainJobs() { await Promise.allSettled([...pending]) }
/**
 * The caller's newest AI result for a path made after the item was last saved: a draft that was never saved (page
 * left, browser closed) can be taken up again instead of asking the AI once more. Fills made without AI (model null)
 * are left out.
 */
export async function latestJob(userId: number, path: string, after: string) {
  const row = (await database().rows<{ id: string; created_at: string; result: string }>(
    `SELECT id,created_at,result FROM background_jobs WHERE user_id=? AND path=? AND status='done' AND created_at>? AND result NOT LIKE '%"model":null%' ORDER BY created_at DESC LIMIT 1`,
    [userId, path, after || '1970-01-01']))[0]
  return { job: row ? { id: row.id, created_at: row.created_at, result: JSON.parse(row.result) } : null }
}
/** AI requests of a user since the free tier's daily quota last came back (midnight Pacific time); fills without AI not counted. */
export async function aiUsage(userId: number) {
  const now = new Date(), pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const midnight = new Date(pacific); midnight.setHours(0, 0, 0, 0)
  const seconds = Math.floor((pacific.getTime() - midnight.getTime()) / 1000)
  const row = (await database().rows<{ used: number; failed: number | null }>(
    `SELECT COUNT(*) AS used, SUM(status='error') AS failed FROM background_jobs WHERE user_id=? AND created_at>=NOW()-INTERVAL ? SECOND AND (result IS NULL OR result NOT LIKE '%"model":null%')`,
    [userId, seconds]))[0]!
  const since = new Date(now.getTime() - seconds * 1000).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })
  return { used: Number(row.used), failed: Number(row.failed ?? 0), since }
}
