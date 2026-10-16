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
