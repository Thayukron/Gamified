import { login } from '../../services/auth'
import { database } from '../../utils/db'
import { apiHandler, jsonBody, ApiError, inputString, phpTrim } from '../../utils/errors'

export default apiHandler(async event => {
  const body = await jsonBody(event)
  // Validate before opening a connection (also preserves 422 when DB is offline).
  if (!phpTrim(inputString(body.username)) || !inputString(body.password)) throw new ApiError(422, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
  return login(database(), body, Number(useRuntimeConfig(event).tokenTtlHours))
})
