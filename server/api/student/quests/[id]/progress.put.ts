import { getRouterParam } from 'h3'
import { progress } from '../../../../services/studentGame'
import { phpInt } from '../../../../services/scenarioEngine'
import { authenticated } from '../../../../utils/auth'
import { transaction } from '../../../../utils/db'
import { apiHandler, jsonBody } from '../../../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['student'])
  const body = await jsonBody(event)
  return transaction(db => progress(db, user.id, phpInt(getRouterParam(event, 'id')), body))
})
