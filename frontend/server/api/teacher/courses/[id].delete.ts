import { removeCourse } from '../../../services/teacherCourses'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => removeCourse(db,user,params.id!))
