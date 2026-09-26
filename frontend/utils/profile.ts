// Display metadata for profile dimensions. Wording is intentionally positive.

export const VARK = {
  V: { name: 'Visual', th: 'นักเรียนรู้ผ่านภาพ', desc: 'เข้าใจได้ไวเมื่อเห็นภาพ แผนผัง สี และสัญลักษณ์' },
  A: { name: 'Aural', th: 'นักเรียนรู้ผ่านเสียง', desc: 'จำได้ดีจากการฟัง พูดคุย และแลกเปลี่ยนความคิด' },
  R: { name: 'Read/Write', th: 'นักอ่าน-นักเขียน', desc: 'เข้าใจลึกซึ้งผ่านการอ่านและจดบันทึกด้วยตัวเอง' },
  K: { name: 'Kinesthetic', th: 'นักลงมือทำ', desc: 'เรียนรู้ได้ดีที่สุดเมื่อได้ลองทำและสัมผัสจริง' },
} as const

export const RIASEC = {
  R: { name: 'Realistic', th: 'นักปฏิบัติ' },
  I: { name: 'Investigative', th: 'นักคิดวิเคราะห์' },
  A: { name: 'Artistic', th: 'นักสร้างสรรค์' },
  S: { name: 'Social', th: 'นักช่วยเหลือ' },
  E: { name: 'Enterprising', th: 'นักริเริ่ม' },
  C: { name: 'Conventional', th: 'นักจัดระบบ' },
} as const

export const MINDSET = {
  growth: { name: 'Growth Mindset', th: 'จิตใจแห่งการเติบโต', desc: 'มองความท้าทายเป็นโอกาส และเชื่อว่าความพยายามพาไปได้ไกลเสมอ' },
  mixed: { name: 'Balanced Mindset', th: 'จิตใจที่กำลังเบ่งบาน', desc: 'รู้จักทั้งจุดแข็งและขีดจำกัดของตัวเอง และพร้อมก้าวข้ามไปทีละขั้น' },
  fixed: { name: 'Steady Mindset', th: 'ผู้มั่นคงในจุดแข็ง', desc: 'รู้ว่าตัวเองถนัดอะไร และมีโอกาสค้นพบพลังใหม่เมื่อเปิดใจลองสิ่งที่ท้าทาย' },
} as const

export function varkLabel(code: string | null) {
  if (!code) return { name: '-', th: 'ยังไม่ระบุ', desc: '' }
  if (code.length > 1) {
    return {
      name: `Multimodal (${code})`,
      th: 'นักเรียนรู้หลายช่องทาง',
      desc: 'ปรับตัวเก่ง เรียนรู้ได้ดีจากหลายรูปแบบผสมผสานกัน',
    }
  }
  return VARK[code as keyof typeof VARK]
}

export interface AssessmentResult {
  id: number
  scenario_title: string
  completed_at: string
  semester: number
  academic_year: number
  vark_v: number; vark_a: number; vark_r: number; vark_k: number
  riasec_r: number; riasec_i: number; riasec_a: number; riasec_s: number; riasec_e: number; riasec_c: number
  mindset_growth: number; mindset_fixed: number
  dominant_vark: string | null
  dominant_riasec: string
  mindset_type: keyof typeof MINDSET
  archetype_code: string
  archetype_name: string
  archetype_title: string
  archetype_description: string
  strengths: string[]
  tips: string[]
  color: string
  icon: string
  items?: { name: string; icon: string }[]
}
