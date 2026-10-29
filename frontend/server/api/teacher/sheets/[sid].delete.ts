import { deleteSheet } from '../../../services/lessonPlans'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => deleteSheet(db,user,params.sid!))
