import { saveAvatar } from '../../../services/studentGame'
import { authenticated } from '../../../utils/auth'
import { database } from '../../../utils/db'
import { apiHandler, jsonBody } from '../../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['student'])
  return saveAvatar(database(), user.id, await jsonBody(event))
})
