import { saveKey } from '../../services/aiSettings'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body }) => saveKey(db,user.id,body))
