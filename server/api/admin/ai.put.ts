import { adminSaveAI } from '../../services/aiSettings'
import { aiHandler } from '../../utils/aiHandler'

export default aiHandler(["admin"], async ({ db, body }) => adminSaveAI(db,body))
