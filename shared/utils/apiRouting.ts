import routes from '../data/migrated-api.json'

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const patterns = routes.map(route => ({ method: route.method, pattern: new RegExp('^' + route.path.split('/').map(segment => /^\{\w+\}$/.test(segment) ? '[^/]+' : escape(segment)).join('/') + '$') }))
export function migratedMethods(path: string) {
  const pathname = path.split('?')[0]!.replace(/\/$/, '')
  const matches = patterns.filter(route => route.pattern.test(pathname)).map(route => route.method)
  return matches.length ? matches : undefined
}
export function apiBaseFor(path: string, legacyBase: string) {
  return migratedMethods(path) ? '/api' : legacyBase
}
