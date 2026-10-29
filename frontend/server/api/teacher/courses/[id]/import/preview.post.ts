import { importRoster } from '../../../../../services/teacherCourses'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => importRoster(db,user,params.id!,body,false))
