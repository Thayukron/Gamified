import { inputString, phpTrim } from './errors'
import { phpInt } from '../services/scenarioEngine'
import type { StaffRecord } from '../../shared/types/staff'
import type { SqlClient, SqlValue } from './db'

export const text = (value: unknown, max = Infinity) => Array.from(phpTrim(inputString(value))).slice(0, max).join('')
export const clean = (value: unknown, max = Infinity) => text(inputString(value).replace(/\s+/gu, ' '), max)
export const bool = (value: unknown) => value != null && value !== false && value !== 0 && value !== '' && value !== '0' && (typeof value !== 'object' || Object.keys(value).length > 0)
export const optionalText = (value: unknown, max: number) => { const result = text(value, max); return bool(result) ? result : null }
export const array = (value: unknown): any[] => value == null ? [] : Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : [value]
export const record = (value: unknown): StaffRecord => value && typeof value === 'object' ? value as StaffRecord : {}
export const ids = (value: unknown) => [...new Set(array(value).map(phpInt).filter(Boolean))]
export const marks = (values: unknown[]) => values.map(() => '?').join(',')

// Call only with a transaction-bound SqlClient: these metadata belong to that connection.
export async function write(db: SqlClient, sql: string, values: SqlValue[] = []) {
  if (db.change) return db.change(sql, values)
  await db.execute(sql, values)
  return (await db.rows<{ affected: number; id: number }>('SELECT ROW_COUNT() AS affected, LAST_INSERT_ID() AS id'))[0]!
}
