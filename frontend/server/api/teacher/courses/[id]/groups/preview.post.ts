import { groupsPreview } from '../../../../../services/teacherDashboard'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db,user,body,query,params }) => groupsPreview(db,user,params.id!,body))
