import { getHeader, getRequestURL, type H3Event } from 'h3'
import type { Role } from '../../shared/types/auth'
import { bearerToken, requireUser } from '../services/auth'
import { database } from './db'
import { ApiError } from './errors'

export const requestToken = (event: H3Event) => bearerToken(getHeader(event, 'authorization'))
export async function authenticated(event: H3Event, roles: (Role | '*')[] = ['*']) {
  const token = requestToken(event)
  if (!token) throw new ApiError(401, 'กรุณาเข้าสู่ระบบ')
  const path = getRequestURL(event).pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/'
  return requireUser(database(), token, roles, path)
}
