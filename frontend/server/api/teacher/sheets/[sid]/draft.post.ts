import { sheetDraft } from '../../../../services/lessonPlans'
import { aiHandler } from '../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, params, signal }) => sheetDraft(db,user,params.sid!,body,signal), true)
