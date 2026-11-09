import { saveExam } from '../../../../../services/exams'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, body, params, raw }) => saveExam(db,user,params.id!,raw.kind,body))
