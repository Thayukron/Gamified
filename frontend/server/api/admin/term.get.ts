import { currentTerm } from '../../utils/settings'
import { staffHandler } from '../../utils/staffHandler'

export default staffHandler(["admin"], async ({ db,user,body,query,params }) => currentTerm(db))
