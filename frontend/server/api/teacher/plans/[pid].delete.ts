import { remove } from '../../../services/lessonPlans'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => remove(db,user,params.pid!))
