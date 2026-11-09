import { ownAIStatus } from '../../services/aiSettings'
import { aiUsage } from '../../services/jobs'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user }) => ({ ...await ownAIStatus(db,user.id), usage: await aiUsage(user.id) }))
