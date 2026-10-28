import { apiHandler } from '../utils/errors'

export default apiHandler(() => ({
  status: 'ok',
  time: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '+07:00'),
}))
