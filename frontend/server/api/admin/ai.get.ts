import { adminAI } from '../../services/aiSettings'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["admin"], async ({ db }) => adminAI(db))
