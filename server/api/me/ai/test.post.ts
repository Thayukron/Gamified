import { testKey } from '../../../services/aiSettings'
import { aiHandler } from '../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user }) => testKey(db,user.id))
