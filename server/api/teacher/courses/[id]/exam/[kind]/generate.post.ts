import { generateExam } from '../../../../../../services/exams'
import { aiHandler } from '../../../../../../utils/aiHandler'

export default aiHandler(["teacher","admin"], async ({ db, user, body, params, raw, signal }) => generateExam(db,user,params.id!,raw.kind,body,signal), true)
