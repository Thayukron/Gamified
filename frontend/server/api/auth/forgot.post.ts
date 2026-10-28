import { forgot } from '../../services/account'
import { database } from '../../utils/db'
import { apiHandler, jsonBody, ApiError, inputString, phpTrim } from '../../utils/errors'

export default apiHandler(async event => {
  const body = await jsonBody(event)
  if (!phpTrim(inputString(body.username))) throw new ApiError(422, 'กรุณากรอกชื่อผู้ใช้หรือรหัสนักศึกษา')
  return forgot(database(), body)
})
