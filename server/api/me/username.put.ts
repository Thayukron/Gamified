import { changeUsername } from '../../services/account'
import { authenticated } from '../../utils/auth'
import { database } from '../../utils/db'
import { apiHandler, jsonBody } from '../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['teacher', 'admin'])
  return changeUsername(database(), user, await jsonBody(event))
})
