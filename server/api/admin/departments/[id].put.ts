import { updateDepartment } from '../../../services/admin'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(['admin'], async ({ db, body, params }) => updateDepartment(db, params.id!, body))
