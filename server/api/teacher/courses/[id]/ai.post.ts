import { courseGenerate } from '../../../../services/aiCourses'
import { aiHandler } from '../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, params, signal }) => courseGenerate(db,user,params.id!,body,signal), true)
