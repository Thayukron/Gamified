import { getQuery } from 'h3'
import { apiHandler } from '../../utils/errors'
import { authenticated } from '../../utils/auth'
import { latestJob } from '../../services/jobs'
// before /jobs/{id}: an unsaved AI draft of an item, to take up again without using the AI quota
export default apiHandler(async event => {
  const user = await authenticated(event, ['teacher', 'admin']), query = getQuery(event)
  return latestJob(user.id, String(query.path ?? ''), String(query.after ?? ''))
})
