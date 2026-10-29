import { draft } from '../../../../services/lessonPlans'
import { aiHandler } from '../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, params, signal }) => draft(db,user,params.pid!,body,signal), true)
