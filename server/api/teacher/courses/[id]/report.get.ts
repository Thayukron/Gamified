import { report } from '../../../../services/teacherDashboard'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => report(db,user,params.id!))
