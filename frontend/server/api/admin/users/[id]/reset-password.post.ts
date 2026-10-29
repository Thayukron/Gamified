import { resetPassword } from '../../../../services/admin'
import { staffHandler } from '../../../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => resetPassword(db,user,params.id!))
