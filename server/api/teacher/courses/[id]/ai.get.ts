import { courseCached } from '../../../../services/aiCourses'
import { aiHandler } from '../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, query, params }) => courseCached(db,user,params.id!,query))
