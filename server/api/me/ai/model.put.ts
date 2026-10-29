import { setModel } from '../../../services/aiSettings'
import { aiHandler } from '../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body }) => setModel(db,user.id,body))
