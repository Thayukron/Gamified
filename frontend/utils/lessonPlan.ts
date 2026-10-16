// Unit lesson plan (OVEC 2567 form) — content shape mirrors backend LessonPlanService::EMPTY.
export interface PlanContent {
  outcome: string
  standard: { occupation: string; sub_competency: string; criteria: string; method: string; performance_evidence: string; knowledge_evidence: string; career_integration: string }
  competency: { knowledge: string; practice: string; apply: string }
  objectives: { cognitive: string; psychomotor: string; affective: string; application: string }
  content: string
  activities: { motivation: string; information: string; application: string; progress: string }
  differentiation: string
  media: string
  evidence: { knowledge: string; performance: string }
  assessment: { criteria: string; methods: string; tools: string }
  after: { results: string; problems: string; solution_result: string; next_time: string }
}

/** Course-level part of the book — mirrors backend CoursePlanService::EMPTY. */
export interface CourseBook {
  curriculum: {
    program: string; field_type: string; occupation_group: string; major: string
    theory_hours: string; practice_hours: string; credits: string
    standards_ref: string; outcome: string; objectives: string; competencies: string; description: string
  }
  occupational: { agency: string; standard: string; occupation: string; level: string; rows: Record<string, string>[] }
  job_analysis: { job: string; rows: Record<string, string>[] }
  units: Record<string, string>[]
  final_eval: { hours_theory: string; hours_practice: string; percent: string }
  preface: string
  bibliography: string
  author: string
}

// ---- supporting sheets of a unit plan (ใบความรู้ ใบงาน ใบกิจกรรม ใบมอบหมายงาน แบบประเมิน)
export type SheetType = 'knowledge' | 'job' | 'activity' | 'assignment' | 'assessment'
export interface Sheet { id: number; type: SheetType; type_th: string; number: string; title: string; content: Record<string, any>; completeness: number; ai_model?: string | null }
/** one numbered section of a sheet; numbered = items become "<no>.1, <no>.2 …"; pageBreak = starts a new page (form rule) */
export interface SheetSection { key: string; no: number; title: string; rows?: number; numbered?: boolean; pageBreak?: boolean; hint?: string }

const shared = (outcomeTitle: string, competencyTitle: string): SheetSection[] => [
  { key: 'outcome', no: 1, title: outcomeTitle, rows: 2 },
  { key: 'standard', no: 2, title: 'อ้างอิงมาตรฐาน/เชื่อมโยงกลุ่มอาชีพ', rows: 2, hint: 'ว่างได้ถ้าไม่อ้างอิงมาตรฐานอาชีพ' },
  { key: 'competency', no: 3, title: competencyTitle, rows: 3, numbered: true },
  { key: 'objectives', no: 4, title: 'จุดประสงค์เชิงพฤติกรรม', rows: 4, numbered: true },
]

export const SHEET_TYPES: Record<SheetType, { th: string; nameLabel: string; desc: string; sections: SheetSection[] }> = {
  knowledge: {
    th: 'ใบความรู้', nameLabel: 'ชื่อเรื่อง', desc: 'เนื้อหาสาระให้ผู้เรียนอ่าน + แบบฝึกหัด/แบบทดสอบ + เฉลย',
    sections: [
      ...shared('ผลลัพธ์การเรียนรู้ระดับหน่วยการเรียน', 'สมรรถนะประจำหน่วย'),
      { key: 'content', no: 5, title: 'เนื้อหาสาระ', rows: 12 },
      { key: 'exercises', no: 6, title: 'แบบฝึกหัด/แบบทดสอบ', rows: 8 },
      { key: 'references', no: 7, title: 'เอกสารอ้างอิง', rows: 3, pageBreak: true },
      { key: 'appendix', no: 8, title: 'ภาคผนวก (เฉลยแบบฝึกหัด เฉลยแบบทดสอบ)', rows: 5 },
    ],
  },
  job: {
    th: 'ใบงาน', nameLabel: 'ชื่องาน', desc: 'งานปฏิบัติ: เครื่องมือ ข้อควรระวัง ขั้นตอนการปฏิบัติงาน',
    sections: [
      ...shared('ผลลัพธ์การเรียนรู้จากการปฏิบัติงาน', 'สมรรถนะการปฏิบัติงาน'),
      { key: 'tools', no: 5, title: 'เครื่องมือ วัสดุ และอุปกรณ์', rows: 4, numbered: true },
      { key: 'advice', no: 6, title: 'คำแนะนำ/ข้อควรระวัง', rows: 3 },
      { key: 'steps', no: 7, title: 'ขั้นตอนการปฏิบัติงาน', rows: 8 },
      { key: 'conclusion', no: 8, title: 'สรุปและวิจารณ์ผล', rows: 3 },
      { key: 'evaluation', no: 9, title: 'การประเมินผล', rows: 3 },
      { key: 'references', no: 10, title: 'เอกสารอ้างอิง/เอกสารค้นคว้าเพิ่มเติม', rows: 2 },
    ],
  },
  activity: {
    th: 'ใบกิจกรรม', nameLabel: 'ชื่องาน', desc: 'กิจกรรมกลุ่ม/คู่: ขั้นตอนการทำกิจกรรม สรุปและอภิปราย',
    sections: [
      ...shared('ผลลัพธ์การเรียนรู้การปฏิบัติกิจกรรม', 'สมรรถนะประจำกิจกรรม'),
      { key: 'tools', no: 5, title: 'เครื่องมือ วัสดุ และอุปกรณ์', rows: 4, numbered: true },
      { key: 'steps', no: 6, title: 'ขั้นตอนการทำกิจกรรม', rows: 8 },
      { key: 'conclusion', no: 7, title: 'สรุปและอภิปราย', rows: 3 },
      { key: 'evaluation', no: 8, title: 'การประเมินผล', rows: 3 },
      { key: 'references', no: 9, title: 'เอกสารอ้างอิง/เอกสารค้นคว้าเพิ่มเติม', rows: 2 },
    ],
  },
  assignment: {
    th: 'ใบมอบหมายงาน', nameLabel: 'ชื่องาน', desc: 'งานมอบหมาย: รายละเอียดงาน กำหนดส่ง แนวทางปฏิบัติ',
    sections: [
      ...shared('ผลงานหรือผลการปฏิบัติงาน', 'สมรรถนะการปฏิบัติงาน'),
      { key: 'details', no: 5, title: 'รายละเอียดของงาน', rows: 5, hint: 'อาจมีแบบ รูปภาพ หรืออื่น ๆ ประกอบ (แทรกเพิ่มใน Word ได้)' },
      { key: 'deadline', no: 6, title: 'กำหนดเวลาส่งงาน', rows: 1 },
      { key: 'guidelines', no: 7, title: 'แนวทางในการปฏิบัติงาน', rows: 4 },
      { key: 'sources', no: 8, title: 'แหล่งข้อมูลค้นคว้าเพิ่มเติม', rows: 2 },
      { key: 'evaluation', no: 9, title: 'การประเมินผล', rows: 3 },
    ],
  },
  assessment: {
    th: 'แบบประเมิน', nameLabel: 'ชื่อเรื่อง', desc: 'แบบประเมินความสามารถในการปฏิบัติงาน/ผลลัพธ์การเรียนรู้/สมรรถนะ (Rubric 4 ระดับ)',
    sections: [
      { key: 'instructions', no: 1, title: 'คำชี้แจง', rows: 2 },
      { key: 'pass', no: 2, title: 'เกณฑ์การผ่าน', rows: 2 },
    ],
  },
}
export const SHEET_ORDER: SheetType[] = ['knowledge', 'activity', 'job', 'assignment', 'assessment']

// ---- Word export selection
export interface ExportItem { key: string; label: string; hint?: string; checked: boolean; disabled?: boolean }
export interface ExportGroup { title: string; items: ExportItem[] }
/** What to put in the Word file. Keys: book parts, "plan", "sheet:<id>", "type:<sheetType>", "unit:<planId>", "appendix". */
export interface ExportInclude { keys: Set<string> }

/** Course-level parts of the book, in form order. */
export const BOOK_PARTS = [
  { key: 'cover', label: 'ปก' },
  { key: 'preface', label: 'คำนำ' },
  { key: 'toc', label: 'สารบัญ' },
  { key: 'curriculum', label: 'หลักสูตรรายวิชา' },
  { key: 'occupational', label: 'มาตรฐานอาชีพ (ถ้ามี)' },
  { key: 'job', label: 'ตารางวิเคราะห์หน่วยการเรียนรู้' },
  { key: 'behaviour', label: 'ตารางวิเคราะห์พฤติกรรมการเรียนรู้' },
  { key: 'units', label: 'หน่วยการเรียนรู้ (ตารางชั่วโมง)' },
] as const

/** Export picker for the whole course (book parts + units + forms per unit). */
export function courseExportGroups(plans: { id: number; unit_no: number; session_no: number; unit_name: string; title: string; sheets?: { type: SheetType }[] }[], learnersReady: boolean): ExportGroup[] {
  const types = new Set(plans.flatMap((p) => (p.sheets ?? []).map((s) => s.type)))
  return [
    { title: 'ส่วนหน้า · ระดับรายวิชา', items: BOOK_PARTS.map((b) => ({ key: b.key, label: b.label, checked: true })) },
    {
      title: 'หน่วยการเรียน',
      items: plans.map((p) => ({ key: `unit:${p.id}`, label: `หน่วยที่ ${p.unit_no} ${p.title || p.unit_name}`, hint: `สอนครั้งที่ ${p.session_no}`, checked: true })),
    },
    {
      title: 'ฟอร์มในแต่ละหน่วย',
      items: [
        { key: 'plan', label: 'แผนการจัดการเรียนรู้', checked: true },
        ...SHEET_ORDER.map((t) => ({ key: `type:${t}`, label: SHEET_TYPES[t].th, checked: types.has(t), disabled: !types.has(t), hint: types.has(t) ? undefined : 'ยังไม่มีในหน่วยใด' })),
      ],
    },
    {
      title: 'ท้ายเล่ม',
      items: [
        { key: 'bibliography', label: 'บรรณานุกรม', checked: true },
        { key: 'appendix', label: 'ภาคผนวก: ผลการวิเคราะห์ผู้เรียน', checked: true, disabled: !learnersReady },
      ],
    },
  ]
}

/** keys from the picker → include set ("…:none" keeps a filter active when nothing of that kind is ticked) */
export function toInclude(keys: string[]) {
  const set = new Set(keys)
  if (!keys.some((k) => k.startsWith('type:'))) set.add('type:none')
  if (!keys.some((k) => k.startsWith('unit:'))) set.add('unit:none')
  return set
}

interface Field { key: string; label: string; hint?: string; rows?: number }
export interface PlanSection { no: string; title: string; key: keyof PlanContent; hint: string; fields?: Field[]; rows?: number; adaptive?: boolean }

/** Editor layout — numbering, wording and hints follow the official form (คำอธิบาย). */
export const PLAN_SECTIONS: PlanSection[] = [
  { no: '1', title: 'ผลลัพธ์การเรียนรู้ระดับหน่วยการเรียน', key: 'outcome', rows: 3, hint: 'ผลลัพธ์นอกห้องเรียนที่เกิดจากการนำความรู้ ทักษะ ประสบการณ์ไปประยุกต์ใช้ในชีวิตประจำวันหรืองานอาชีพ' },
  {
    no: '2', title: 'อ้างอิงมาตรฐาน/เชื่อมโยงกลุ่มอาชีพ', key: 'standard', hint: 'อ้างอิงหน่วยสมรรถนะ/สมรรถนะย่อยที่เกี่ยวข้อง (วิชาที่ไม่อ้างอิงมาตรฐานอาชีพ เว้นข้อ 2.1 ได้)',
    fields: [
      { key: 'occupation', label: '2.1 มาตรฐานอาชีพ', rows: 1 },
      { key: 'sub_competency', label: 'สมรรถนะย่อย', rows: 1 },
      { key: 'criteria', label: '1) เกณฑ์การปฏิบัติงาน', rows: 2 },
      { key: 'method', label: '2) วิธีประเมิน', rows: 2 },
      { key: 'performance_evidence', label: '3) หลักฐานการปฏิบัติงาน (Performance Evidence)', rows: 2 },
      { key: 'knowledge_evidence', label: '4) หลักฐานความรู้ (Knowledge Evidence)', rows: 2 },
      { key: 'career_integration', label: '2.2 บูรณาการกลุ่มอาชีพ', rows: 2 },
    ],
  },
  {
    no: '3', title: 'สมรรถนะประจำหน่วย', key: 'competency', hint: 'รูปแบบ “กริยา + กรรม + เงื่อนไขหรือสถานการณ์”',
    fields: [
      { key: 'knowledge', label: '3.1 สมรรถนะทางปัญญา', rows: 2 },
      { key: 'practice', label: '3.2 สมรรถนะการฝึกและการปฏิบัติงาน', rows: 2, hint: 'กริยาการปฏิบัติงาน + งาน + เงื่อนไข (ข้อกำหนด มาตรฐาน ข้อตกลง)' },
      { key: 'apply', label: '3.3 ประยุกต์ใช้', rows: 2 },
    ],
  },
  {
    no: '4', title: 'จุดประสงค์เชิงพฤติกรรม', key: 'objectives', hint: 'เขียนให้ครบ 4 ด้าน รูปแบบ “พฤติกรรม + เงื่อนไข/เนื้อหา + เกณฑ์” · 1 บรรทัด = 1 ข้อ (ระบบใส่เลข 4.1, 4.2 … ให้)',
    fields: [
      { key: 'cognitive', label: 'ด้านพุทธิพิสัย', hint: 'บอก อธิบาย ยกตัวอย่าง คำนวณ จำแนก เปรียบเทียบ', rows: 3 },
      { key: 'psychomotor', label: 'ด้านทักษะพิสัย', hint: 'ทำตามขั้นตอน ทำ…ได้ถูกต้อง ทำ…ได้ด้วยความมั่นใจ', rows: 3 },
      { key: 'affective', label: 'ด้านจิตพิสัย', hint: 'ยึดถือ ริเริ่ม เปลี่ยนแปลง กิจนิสัย', rows: 2 },
      { key: 'application', label: 'ด้านความสามารถประยุกต์ใช้และรับผิดชอบ', rows: 2 },
    ],
  },
  { no: '5', title: 'สาระการเรียนรู้', key: 'content', rows: 5, hint: 'หัวข้อเนื้อหา 1 บรรทัดต่อ 1 หัวข้อ (รายละเอียดแยกไว้ในใบความรู้ได้)' },
  {
    no: '6', title: 'กิจกรรมการเรียนรู้ (MIAP)', key: 'activities', adaptive: true, hint: 'สิ่งที่ครูและผู้เรียนทำในแต่ละขั้น พร้อมเวลาโดยประมาณ',
    fields: [
      { key: 'motivation', label: 'ขั้นสนใจปัญหา (Motivation)', rows: 3 },
      { key: 'information', label: 'ขั้นศึกษาข้อมูล (Information)', rows: 4 },
      { key: 'application', label: 'ขั้นพยายาม (Application)', rows: 4 },
      { key: 'progress', label: 'ขั้นสำเร็จผล (Progress)', rows: 3 },
    ],
  },
  { no: '6.5', title: 'การจัดกิจกรรมตามผลการวิเคราะห์ผู้เรียน', key: 'differentiation', rows: 4, adaptive: true, hint: 'ปรับกิจกรรม/สื่อตามสไตล์การเรียนรู้ ความสนใจ และ Mindset ของห้อง — แสดงในแผนเป็นข้อ 6.5 และสรุปในภาคผนวก' },
  { no: '7', title: 'สื่อและแหล่งการเรียนรู้', key: 'media', rows: 4, adaptive: true, hint: '1 บรรทัดต่อ 1 รายการ (ระบบใส่เลข 7.1, 7.2 … ให้)' },
  {
    no: '8', title: 'หลักฐานการเรียนรู้', key: 'evidence', hint: 'หลักฐานการแสดงออกของผู้เรียน ทั้งความรู้ ทักษะ ผลงาน กิจนิสัย',
    fields: [{ key: 'knowledge', label: '8.1 หลักฐานความรู้', rows: 2 }, { key: 'performance', label: '8.2 หลักฐานการปฏิบัติงาน', rows: 2 }],
  },
  {
    no: '9', title: 'การวัดและประเมินผล', key: 'assessment', hint: 'วัดให้ครบตามผลลัพธ์ สมรรถนะประจำหน่วย และจุดประสงค์เชิงพฤติกรรมทุกข้อ',
    fields: [{ key: 'criteria', label: '9.1 เกณฑ์การปฏิบัติงาน', rows: 2 }, { key: 'methods', label: '9.2 วิธีการประเมิน', rows: 3 }, { key: 'tools', label: '9.3 เครื่องมือประเมิน', rows: 3 }],
  },
  {
    no: '10', title: 'บันทึกผลหลังการจัดการเรียนรู้', key: 'after', hint: 'กรอกหลังสอน — ถ้าเว้นว่าง ไฟล์ Word จะเว้นบรรทัดจุดไว้ให้เขียนด้วยมือ',
    fields: [
      { key: 'results', label: '10.1 ผลการจัดการเรียนรู้ที่เกิดขึ้นกับผู้เรียน', rows: 3 },
      { key: 'problems', label: '10.2 ปัญหา อุปสรรคที่พบ', rows: 2 },
      { key: 'solution_result', label: '10.3 1) ผลการแก้ไขปัญหาที่ส่งผลลัพธ์ที่ดีต่อผู้เรียน', rows: 2 },
      { key: 'next_time', label: '10.3 2) แนวทางแก้ปัญหาในครั้งต่อไป', rows: 2 },
    ],
  },
]
