import { changePassword } from '../../services/account'
import { authenticated, requestToken } from '../../utils/auth'
import { transaction } from '../../utils/db'
import { apiHandler, jsonBody } from '../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event)
  const body = await jsonBody(event)
  return transaction(db => changePassword(db, user, requestToken(event)!, body))
})
