import { allowCentral } from '../../../../services/aiSettings'
import { aiHandler } from '../../../../utils/aiHandler'

export default aiHandler(["admin"], async ({ db, body, params }) => allowCentral(db,params.id!,body))
