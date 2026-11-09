import { showExam } from '../../../../../services/exams'
import { staffHandler } from '../../../../../utils/staffHandler'

export default staffHandler(["teacher","admin"], async ({ db, user, params, raw }) => showExam(db,user,params.id!,raw.kind))
