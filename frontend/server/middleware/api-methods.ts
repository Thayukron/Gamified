import { defineEventHandler, getHeader, getRequestURL, setHeader, setResponseStatus } from 'h3'

// Limit compatibility handling to migrated routes; never intercept the SPA or future routes.
const methods: Record<string, string[]> = {
  '/api/health': ['GET'], '/api/auth/login': ['POST'], '/api/auth/logout': ['POST'],
  '/api/auth/me': ['GET'], '/api/auth/forgot': ['POST'],
  '/api/me/profile': ['GET', 'PUT'], '/api/me/password': ['PUT'], '/api/me/username': ['PUT'],
  '/api/student/quests': ['GET'], '/api/student/results': ['GET'],
  '/api/student/profile': ['GET'], '/api/student/player': ['GET'], '/api/student/player/avatar': ['PUT'],
}
const dynamicMethods: [RegExp, string[]][] = [
  [/^\/api\/student\/quests\/[^/]+$/, ['GET']],
  [/^\/api\/student\/quests\/[^/]+\/progress$/, ['PUT']],
  [/^\/api\/student\/quests\/[^/]+\/complete$/, ['POST']],
  [/^\/api\/student\/results\/[^/]+$/, ['GET']],
]
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname.replace(/\/$/, '')
  const allowed = methods[path] ?? dynamicMethods.find(([pattern]) => pattern.test(path))?.[1]
  if (allowed) {
    const origin = getHeader(event, 'origin') || ''
    const origins = useRuntimeConfig(event).corsOrigins.split(',').map((value: string) => value.trim())
    if (origins.includes(origin)) {
      setHeader(event, 'Access-Control-Allow-Origin', origin)
      setHeader(event, 'Vary', 'Origin')
      setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Async-Job')
      setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    }
  }
  if (allowed && event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }
  if (allowed && !allowed.includes(event.method)) {
    setResponseStatus(event, 405)
    return { error: 'Method not allowed' }
  }
})
