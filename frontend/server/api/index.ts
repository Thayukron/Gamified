import { apiHandler, ApiError } from '../utils/errors'
export default apiHandler(() => { throw new ApiError(404, 'Not found') })
