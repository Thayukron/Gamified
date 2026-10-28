import { authenticated } from '../../utils/auth'
import { apiHandler } from '../../utils/errors'

export default apiHandler(async event => {
  const user = await authenticated(event)
  return { user: { ...user, must_change_password: Boolean(user.must_change_password) } }
})
