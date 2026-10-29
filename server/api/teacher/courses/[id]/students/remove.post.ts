import { removeMany } from '../../../../../services/teacherCourses'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => removeMany(db,user,params.id!,body))
