import { logout } from '../../services/auth'
import { authenticated, requestToken } from '../../utils/auth'
import { database } from '../../utils/db'
import { apiHandler } from '../../utils/errors'

export default apiHandler(async event => {
  await authenticated(event)
  return logout(database(), requestToken(event)!)
})
