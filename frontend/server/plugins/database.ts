import { closeDatabase } from '../utils/db'
import { drainJobs } from '../services/jobs'

export default defineNitroPlugin(app => {
  app.hooks.hook('close', async () => { await drainJobs(); await closeDatabase() })
})
