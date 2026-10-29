import { createDepartment } from '../../../services/admin'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(['admin'], async ({ db, body }) => createDepartment(db, body))
