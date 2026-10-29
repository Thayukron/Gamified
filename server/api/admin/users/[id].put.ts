import { updateUser } from '../../../services/admin'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => updateUser(db,user,params.id!,body))
