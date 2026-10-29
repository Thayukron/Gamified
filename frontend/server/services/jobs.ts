import { randomBytes } from 'node:crypto'
import { database } from '../utils/db'
import { ApiError } from '../utils/errors'
const pending = new Set<Promise<void>>()
const controllers = new Map<string, AbortController>()
export async function startJob(userId: number, path: string, work: (signal: AbortSignal) => Promise<unknown>) {
  const db = database(), id = randomBytes(16).toString('hex')
  await db.execute("DELETE FROM background_jobs WHERE created_at<NOW()-INTERVAL 2 DAY AND (status<>'running' OR lease_until<NOW())")
  await db.execute("INSERT INTO background_jobs (id,user_id,path,status,lease_until) VALUES (?,?,?,'running',DATE_ADD(NOW(),INTERVAL 30 SECOND))", [id, userId, path.slice(0, 255)])
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
        const result = await db.change!("UPDATE background_jobs SET lease_until=DATE_ADD(NOW(),INTERVAL 30 SECOND) WHERE id=? AND status='running'", [id])
        if (!result.affected) controller.abort()
      } catch { /* polling detects an expired lease if the DB/process stays unavailable */ }
      finally { beating = false }
    }, 10000)
    heartbeat.unref()
    let deadline: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { deadline = setTimeout(() => { controller.abort(); reject(new ApiError(504, 'งาน AI ใช้เวลาเกินกำหนด กรุณาลองใหม่')) }, 600000); deadline.unref() })
      let status = 'done', code = 200, result: unknown
      try { result = await Promise.race([work(controller.signal), timeout]) }
      catch (error) { status = 'error'; code = error instanceof ApiError ? error.status : 500; result = { error: error instanceof ApiError ? error.message : 'เกิดข้อผิดพลาดภายในระบบ' } }
      await db.execute("UPDATE background_jobs SET status=?,http_status=?,result=?,lease_until=NULL WHERE id=? AND status='running'", [status, code, JSON.stringify(result), id])
    } finally { clearInterval(heartbeat); if (deadline) clearTimeout(deadline); controllers.delete(id) }
  })().catch(() => { console.error('Background job could not persist its result') })
  pending.add(task); void task.finally(() => pending.delete(task))
  return { response: { job_id: id, status: 'running' }, task }
}
export async function showJob(userId: number, id: string) {
  const db = database()
  await db.execute("UPDATE background_jobs SET status='error',http_status=503,result=?,lease_until=NULL WHERE id=? AND user_id=? AND status='running' AND (lease_until<NOW() OR (lease_until IS NULL AND updated_at<NOW()-INTERVAL 10 MINUTE))", [JSON.stringify({ error: 'งาน AI ถูกหยุดระหว่างประมวลผล กรุณากดสร้างใหม่อีกครั้ง' }), id, userId])
  const row = (await db.rows<{ status: string; http_status: number | null; result: string | null }>('SELECT status,http_status,result FROM background_jobs WHERE id=? AND user_id=?', [id, userId]))[0]
  if (!row) throw new ApiError(404, 'ไม่พบงานนี้ (อาจหมดอายุแล้ว) — กรุณากดใหม่อีกครั้ง')
  if (row.status === 'error') controllers.get(id)?.abort()
  return { status: row.status, http_status: Number(row.http_status ?? 0), result: row.result !== null ? JSON.parse(row.result) : null }
}
export async function drainJobs() { await Promise.allSettled([...pending]) }
