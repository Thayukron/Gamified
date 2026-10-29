import { getRouterParam } from 'h3'
import { result } from '../../../services/studentGame'
import { phpInt } from '../../../services/scenarioEngine'
import { authenticated } from '../../../utils/auth'
import { database } from '../../../utils/db'
import { apiHandler } from '../../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['student'])
  return result(database(), user.id, phpInt(getRouterParam(event, 'id')))
})
