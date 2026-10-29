import { updateSheet } from '../../../services/lessonPlans'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, body, params }) => updateSheet(db,user,params.sid!,body))
