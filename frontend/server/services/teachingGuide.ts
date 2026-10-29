import knowledge from '../data/knowledge.json'
import type { Course, DashboardStudent, StaffRecord } from '../../shared/types/staff'

export const KNOWLEDGE: StaffRecord = knowledge
const K = KNOWLEDGE
export const VARK_TH: Record<string, string> = { V: 'การเห็นภาพ (Visual)', A: 'การฟัง-พูดคุย (Aural)', R: 'การอ่าน-เขียน (Read/Write)', K: 'การลงมือทำ (Kinesthetic)' }
export const RIASEC_TH: Record<string, string> = { R: 'นักปฏิบัติ (Realistic)', I: 'นักคิดวิเคราะห์ (Investigative)', A: 'นักสร้างสรรค์ (Artistic)', S: 'นักช่วยเหลือ (Social)', E: 'นักริเริ่ม (Enterprising)', C: 'นักจัดระบบ (Conventional)' }
const TYPE_TH: Record<string, string> = { theory: 'ทฤษฎี', practice: 'ปฏิบัติ', mixed: 'ทฤษฎี+ปฏิบัติ' }
export function topicKey(...names: string[]) {
  for (let name of names) {
    name = name.trim(); if (!name) continue
    for (const key of Object.keys(K.TOPICS)) {
      let other = name
      for (const word of K.NOT_TOPIC[key] ?? []) other = other.split(word).join('')
      if (other.includes(key) || key.includes(name)) return key
    }
  }
  return null
}
function topicActivity(topic: string, modality: string) {
  for (const [key, acts] of Object.entries(K.TOPICS) as [string, StaffRecord][]) if (topic.includes(key) || key.includes(topic)) return acts[modality]
  return K.TOPIC_TEMPLATE[modality].split('{topic}').join(topic)
}
function supportGroups(students: DashboardStudent[]) {
  const byVark: Record<string, StaffRecord[]> = { V: [], A: [], R: [], K: [], multi: [] }, fixed: StaffRecord[] = [], notStarted: StaffRecord[] = []
  for (const student of students) {
    const name = { id: student.id, code: student.student_code, name: student.full_name }, p = student.profile
    if (!p) { notStarted.push(name); continue }
    const vark = p.dominant_vark
    byVark[vark && vark.length === 1 ? vark : 'multi']!.push(name)
    if (p.mindset_type === 'fixed') fixed.push(name)
  }
  const groups: StaffRecord[] = []
  if (fixed.length) groups.push({ key: 'fixed', title: 'กลุ่มควรดูแลเป็นพิเศษ: Fixed Mindset', advice: K.MINDSET.fixed, students: fixed, tone: 'care' })
  for (const key of ['K', 'V', 'A', 'R']) if (byVark[key]!.length) groups.push({ key: `vark_${key}`, title: 'กลุ่ม' + VARK_TH[key], advice: [K.REMEDIAL[key]], students: byVark[key], tone: 'vark' })
  if (byVark.multi!.length) groups.push({ key: 'vark_multi', title: 'กลุ่มเรียนรู้หลายช่องทาง (Multimodal)', advice: ['ใช้สื่อผสมหลายรูปแบบ ปรับตัวได้ดีกับทุกกิจกรรม'], students: byVark.multi, tone: 'vark' })
  if (notStarted.length) groups.push({ key: 'not_started', title: 'ยังไม่มีข้อมูล (ยังไม่เล่นเกม)', advice: ['นัดให้เล่นเควสต์ในคาบถัดไป (ใช้เวลาประมาณ 10–15 นาทีต่อเควสต์) เพื่อให้ไกด์ครอบคลุมทุกคน'], students: notStarted, tone: 'muted' })
  return groups
}
export function teachingGuide(course: Course, dash: StaffRecord) {
  const profiled = dash.summary.profiled, domain = K.DOMAIN_BY_DEPARTMENT[course.department_code ?? ''] ?? 'general', type = course.course_type ?? 'mixed', topics = JSON.parse(course.topics ?? '[]') || []
  const meta = { domain, course_type: type, course_type_th: TYPE_TH[type], topics, profiled, enrolled: dash.summary.enrolled }
  if (profiled === 0) return { meta, ready: false }
  const vark = dash.average.vark, riasec = dash.average.riasec
  const varkRank = Object.keys(vark).sort((a, b) => vark[b] - vark[a]), riasecRank = Object.keys(riasec).sort((a, b) => riasec[b] - riasec[a])
  const primary = varkRank[0]!, secondary = varkRank[1]!, fixedPct = Math.round(dash.distribution.mindset.fixed / profiled * 100), summary: string[] = []
  summary.push(vark[primary] < 35 ? 'ผู้เรียนห้องนี้มีสไตล์การเรียนรู้หลากหลาย ไม่มีแบบใดโดดเด่นชัด → ควรสลับสื่อหลายรูปแบบในทุกคาบ' : `ผู้เรียนห้องนี้เรียนรู้ได้ดีผ่าน${VARK_TH[primary]} (${Math.round(vark[primary])}%) รองลงมาคือ${VARK_TH[secondary]} (${Math.round(vark[secondary])}%)`)
  summary.push(`ความสนใจเด่นของห้องคือ${RIASEC_TH[riasecRank[0]!]} และ${RIASEC_TH[riasecRank[1]!]} → เหมาะกับ${K.RIASEC_METHODS[riasecRank[0]!].method}`)
  summary.push(fixedPct >= 30 ? `มีผู้เรียน Fixed Mindset ถึง ${fixedPct}% → ต้องให้ความสำคัญกับการเสริมแรงเชิงบวกและงานที่สำเร็จได้เร็ว` : `ผู้เรียนส่วนใหญ่มี Growth Mindset (Fixed ${fixedPct}%) → ท้าทายด้วยโจทย์ที่ยากขึ้นได้`)
  if (K.CONTEXT_RULES[type]?.[primary]) summary.push(K.CONTEXT_RULES[type][primary])
  return {
    meta, ready: true, summary, principles: K.PRINCIPLES,
    modalities: varkRank.map((key, index) => ({ key, label: VARK_TH[key], share: vark[key], priority: index === 0 ? 'หลัก' : index === 1 ? 'รอง' : 'เสริม', ...K.MODALITY[domain][key] })),
    methods: riasecRank.slice(0, 2).map(key => ({ key, label: RIASEC_TH[key], share: riasec[key], ...K.RIASEC_METHODS[key] })),
    group_roles: Object.keys(K.RIASEC_METHODS).map(key => ({ key, label: RIASEC_TH[key], role: K.RIASEC_METHODS[key].role })),
    units: topics.map((topic: string, index: number) => ({ no: index + 1, topic, activities: [primary, secondary].map(key => ({ key, label: VARK_TH[key], text: topicActivity(topic, key) })), check: `ควิซสั้นต้นคาบถัดไปทบทวนเรื่อง “${topic}” (Retrieval Practice)` })),
    mindset: { fixed_pct: fixedPct, class: K.MINDSET.class, fixed: K.MINDSET.fixed }, groups: supportGroups(dash.students), evaluation: K.EVALUATION,
    caveat: 'สไตล์การเรียนรู้ (VARK) ใช้เป็นข้อมูลประกอบการเลือกสื่อเพื่อเพิ่มความสนใจและการมีส่วนร่วม งานวิจัยปัจจุบันไม่ยืนยันว่าการสอนตรงสไตล์เพียงแบบเดียวทำให้ผลสัมฤทธิ์สูงขึ้น จึงแนะนำให้สอนหลายรูปแบบ โดยเน้นแบบที่ห้องถนัด ร่วมกับหลักการสอนที่มีหลักฐานรองรับ',
  }
}
