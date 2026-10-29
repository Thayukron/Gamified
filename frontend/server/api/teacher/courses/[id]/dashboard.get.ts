import { dashboard } from '../../../../services/teacherDashboard'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => dashboard(db,user,params.id!))
