import { index } from '../../../../services/lessonPlans'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => index(db,user,params.id!))
