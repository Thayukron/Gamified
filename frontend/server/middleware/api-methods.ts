import { defineEventHandler, getHeader, getRequestURL, setHeader, setResponseStatus } from 'h3'
import { migratedMethods } from '../../shared/utils/apiRouting'

// Limit compatibility handling to migrated routes; never intercept the SPA or future routes.
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.replace(/\/$/, '')
  const allowed = path.startsWith('/api/') ? migratedMethods(path.slice(4)) : undefined
  if (path === '/api' || path.startsWith('/api/')) {
    const origin = getHeader(event, 'origin') || ''
    const origins = useRuntimeConfig(event).corsOrigins.split(',').map((value: string) => value.trim())
    if (origins.includes(origin)) {
      setHeader(event, 'Access-Control-Allow-Origin', origin)
      setHeader(event, 'Vary', 'Origin')
      setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Async-Job')
      setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    }
  }
  if ((path === '/api' || path.startsWith('/api/')) && event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
  if (allowed && !allowed.includes(event.method)) {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }
})
