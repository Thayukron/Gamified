import { getRouterParam } from 'h3'
import { apiHandler } from '../../utils/errors'
import { authenticated } from '../../utils/auth'
import { showJob } from '../../services/jobs'
export default apiHandler(async event => {
  const user = await authenticated(event, ['teacher', 'admin'])
  return showJob(user.id, getRouterParam(event, 'id') ?? '')
})
