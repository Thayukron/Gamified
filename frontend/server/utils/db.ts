import { createPool, type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise'
import { useRuntimeConfig } from '#imports'

export type SqlValue = string | number | boolean | null | Date | Buffer
export interface SqlClient {
  rows<T>(sql: string, values?: SqlValue[]): Promise<T[]>
  execute(sql: string, values?: SqlValue[]): Promise<void>
}

function client(connection: Pool | PoolConnection): SqlClient {
  return {
    async rows<T>(sql: string, values: SqlValue[] = []) {
      const [rows] = await connection.execute<RowDataPacket[]>(sql, values)
      return rows as T[]
    },
    async execute(sql: string, values: SqlValue[] = []) {
      await connection.execute<ResultSetHeader>(sql, values)
    },
  }
}

let pool: Pool | undefined
function getPool() {
  if (!pool) {
    const config = useRuntimeConfig()
    const password = process.env.DB_PASSWORD ?? config.db.password
    pool = createPool({
      host: process.env.DB_HOST || config.db.host,
      port: Number(process.env.DB_PORT || config.db.port),
      user: process.env.DB_USER || config.db.user,
      password,
      database: process.env.DB_NAME || config.db.name,
      connectionLimit: Number(config.db.connectionLimit),
      waitForConnections: true, queueLimit: 100, connectTimeout: 10000,
      charset: 'utf8mb4_unicode_ci', dateStrings: true, timezone: '+07:00', multipleStatements: false,
    })
    // Match the application's Bangkok dates even after moving MariaDB out of Docker.
    pool.on('connection', connection => { connection.query("SET time_zone = '+07:00'") })
  }
  return pool
}

export const database = (): SqlClient => client(getPool())
export async function transaction<T>(work: (db: SqlClient) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(client(connection))
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally { connection.release() }
}

export async function closeDatabase() {
  const current = pool
  pool = undefined
  await current?.end()
}
