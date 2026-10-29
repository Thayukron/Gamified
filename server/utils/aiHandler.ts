import { getHeader, getQuery, getRequestURL, getRouterParams, setResponseStatus } from 'h3'
import type { AuthUser, Role } from '../../shared/types/auth'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from './db'
import { database } from './db'
import { apiHandler, jsonBody } from './errors'
import { authenticated } from './auth'
import { phpInt } from '../services/scenarioEngine'
import { startJob } from '../services/jobs'
interface Context { db: SqlClient; user: AuthUser; body: StaffRecord; query: StaffRecord; params: Record<string, number>; signal?: AbortSignal }
export function aiHandler(roles: Role[], handler: (context: Context) => Promise<unknown>, background = false) {
  return apiHandler(async event => {
    const user = await authenticated(event, roles), body = event.method === 'GET' ? {} : await jsonBody(event)
    const context = { db: database(), user, body, query: getQuery(event), params: Object.fromEntries(Object.entries(getRouterParams(event)).map(([key, value]) => [key, phpInt(value)])) }
    if (background && getHeader(event, 'x-async-job') === '1') {
      const job = await startJob(user.id, getRequestURL(event).pathname.replace(/^\/api/, ''), signal => handler({ ...context, signal }))
      event.waitUntil(job.task)
      setResponseStatus(event, 202)
      return job.response
    }
    // External AI calls never hold a DB transaction/pooled connection while waiting on Google.
    return handler(context)
  })
}
