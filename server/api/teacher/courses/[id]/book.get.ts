import { book } from '../../../../services/lessonPlans'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => book(db,user,params.id!))
