import { groupsSaved } from '../../../../services/teacherDashboard'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => groupsSaved(db,user,params.id!))
