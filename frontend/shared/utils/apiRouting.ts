const migratedAccountPaths = new Set([
  '/health', '/auth/login', '/auth/logout', '/auth/me', '/auth/forgot',
  '/me/profile', '/me/password', '/me/username',
])

// Incremental cutover: migrated auth/student APIs are native; staff/AI stay on PHP until migrated.
export function apiBaseFor(path: string, legacyBase: string) {
  const pathname = path.split('?')[0]!.replace(/\/$/, '')
  return migratedAccountPaths.has(pathname) || pathname.startsWith('/student/') ? '/api' : legacyBase
}
