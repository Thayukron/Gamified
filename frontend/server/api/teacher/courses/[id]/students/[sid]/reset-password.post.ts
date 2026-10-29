import { resetStudent } from '../../../../../../services/teacherCourses'
import { staffHandler } from '../../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => resetStudent(db,user,params.id!,params.sid!))
