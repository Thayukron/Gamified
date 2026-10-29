import { search } from '../../services/teacherCourses'
import { staffHandler } from '../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => search(db,query))
