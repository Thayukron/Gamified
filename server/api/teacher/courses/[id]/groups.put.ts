import { groupsSave } from '../../../../services/teacherDashboard'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => groupsSave(db,user,params.id!,body))
