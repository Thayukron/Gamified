import { showSheet } from '../../../services/lessonPlans'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => showSheet(db,user,params.sid!))
