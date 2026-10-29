import { full } from '../../../../../services/lessonPlans'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => full(db,user,params.id!))
