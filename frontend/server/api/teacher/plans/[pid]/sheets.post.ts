import { createSheet } from '../../../../services/lessonPlans'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, body, params }) => createSheet(db,user,params.pid!,body))
