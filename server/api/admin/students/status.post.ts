import { setStatus } from '../../../services/admin'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => setStatus(db,body))
