import { classGroups } from '../../services/admin'
import { staffHandler } from '../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => classGroups(db))
