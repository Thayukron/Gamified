import { create } from '../../../../services/lessonPlans'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, body, params }) => create(db,user,params.id!,body))
