import { saveTerm } from '../../services/admin'
import { staffHandler } from '../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => saveTerm(db,body))
