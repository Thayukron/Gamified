import { ownAIStatus } from '../../services/aiSettings'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user }) => ownAIStatus(db,user.id))
