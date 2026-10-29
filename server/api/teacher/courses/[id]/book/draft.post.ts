import { bookDraft } from '../../../../../services/lessonPlans'
import { aiHandler } from '../../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, params, signal }) => bookDraft(db,user,params.id!,body,signal), true)
