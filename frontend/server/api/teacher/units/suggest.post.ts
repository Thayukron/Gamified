import { suggestUnits } from '../../../services/aiGeneration'
import { aiHandler } from '../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, signal }) => suggestUnits(db,user.id,body,signal), true)
