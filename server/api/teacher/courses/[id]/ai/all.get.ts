import { courseCachedAll } from '../../../../../services/aiCourses'
import { aiHandler } from '../../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, params }) => courseCachedAll(db,user,params.id!))
