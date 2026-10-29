import { importData } from '../../../services/imports'
import { staffHandler } from '../../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => importData(db,body,false))
