import { closeDatabase } from '../utils/db'

export default defineNitroPlugin(app => {
  app.hooks.hook('close', closeDatabase)
})
