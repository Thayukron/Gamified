import { removeKey } from '../../services/aiSettings'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user }) => removeKey(db,user.id))
