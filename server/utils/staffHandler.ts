import { getQuery, getRouterParams, type H3Event } from 'h3'
import type { AuthUser, Role } from '../../shared/types/auth'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient } from './db'
import { authenticated } from './auth'
import { database, transaction } from './db'
import { apiHandler, ApiError, jsonBody } from './errors'
import { phpInt } from '../services/scenarioEngine'

interface Context { db: SqlClient; user: AuthUser; body: StaffRecord; query: StaffRecord; params: Record<string, number> }
export function staffHandler(roles: Role[], handler: (context: Context) => Promise<unknown>, rosterCommit = false) {
  return apiHandler(async (event: H3Event) => {
    const user = await authenticated(event, roles)
    const body = event.method === 'GET' ? {} : await jsonBody(event)
    const context = { user, body, query: getQuery(event), params: Object.fromEntries(Object.entries(getRouterParams(event)).map(([key, value]) => [key, phpInt(value)])) }
    try {
      return event.method === 'GET' ? await handler({ ...context, db: database() }) : await transaction(db => handler({ ...context, db }))
    } catch (error) {
      if (rosterCommit && !(error instanceof ApiError)) throw new ApiError(500, 'นำเข้าไม่สำเร็จ — ไม่มีข้อมูลใดถูกบันทึก')
      throw error
    }
  })
}
