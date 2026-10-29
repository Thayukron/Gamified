import { defineEventHandler, readBody, setResponseStatus, type H3Event } from 'h3'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function apiHandler(handler: (event: H3Event) => unknown | Promise<unknown>) {
  return defineEventHandler(async event => {
    try {
      return await handler(event)
    } catch (error) {
      if (error instanceof ApiError) {
        setResponseStatus(event, error.status)
        return { error: error.message }
      }
      // Do not log driver errors: SQL/bind values may contain secrets.
      console.error('API internal error:', error instanceof Error ? error.name : 'UnknownError')
      setResponseStatus(event, 500)
      return { error: 'เกิดข้อผิดพลาดภายในระบบ' }
    }
  })
}

export async function jsonBody(event: H3Event): Promise<Record<string, unknown>> {
  try {
    const body = await readBody(event)
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  } catch { return {} } // PHP Request::body treats malformed JSON as an empty body.
}

// Match PHP's scalar string casts and trim (including "0" and boolean inputs).
export function inputString(value: unknown): string {
  if (value == null || value === false) return ''
  if (value === true) return '1'
  return typeof value === 'object' ? 'Array' : String(value)
}
export const phpTrim = (value: string) => value.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')
export const charLength = (value: string) => Array.from(value).length
