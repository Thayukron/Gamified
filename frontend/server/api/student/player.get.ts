import { player } from '../../services/studentGame'
import { authenticated } from '../../utils/auth'
import { database } from '../../utils/db'
import { apiHandler } from '../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event, ['student'])
  return player(database(), user.id)
})
