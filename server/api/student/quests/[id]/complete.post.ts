import { getRouterParam } from 'h3'
import { complete } from '../../../../services/studentGame'
import { phpInt } from '../../../../services/scenarioEngine'
import { authenticated } from '../../../../utils/auth'
import { transaction } from '../../../../utils/db'
import { apiHandler, jsonBody } from '../../../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['student'])
  const body = await jsonBody(event)
  return transaction(db => complete(db, user.id, phpInt(getRouterParam(event, 'id')), body))
})
