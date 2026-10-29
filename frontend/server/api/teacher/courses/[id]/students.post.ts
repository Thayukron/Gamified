import { add } from '../../../../services/teacherCourses'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => add(db,user,params.id!,body))
