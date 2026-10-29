import { show } from '../../../services/lessonPlans'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params }) => show(db,user,params.pid!))
