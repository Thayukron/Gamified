// Word files of an AI-drafted exam: the paper for students (no answers) and, separately, the answer key with the
// table of questions per unit and level. Same font and page as the lesson-plan book (TH SarabunPSK 16 pt, A4).
export interface ExamQuestion { type: 'mcq' | 'essay'; unit_no: number; level: string; question: string; choices: string[]; answer: string; guide: string }
export interface ExamExport {
  course: { code: string; name: string; section?: string }
  institution: string
  examName: string // กลางภาค / ปลายภาค
  term: string // e.g. 2/2569
  questions: ExamQuestion[]
  options: { mcq_points: number; essay_points: number }
  units: { no: number; name: string }[]
}

const FONT = 'TH SarabunPSK'
const PT = (n: number) => n * 2
const LETTERS = ['ก', 'ข', 'ค', 'ง']
const W = 9354

export async function exportExamDocx(e: ExamExport, part: 'paper' | 'key', filename: string) {
  const d = await import('docx')
  const { AlignmentType, Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = d
  const run = (text: string, o: { bold?: boolean; size?: number } = {}) =>
    new TextRun({ text, font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT }, size: PT(o.size ?? 16), sizeComplexScript: PT(o.size ?? 16), bold: o.bold, boldComplexScript: o.bold, language: { value: 'th-TH', bidirectional: 'th-TH' } })
  const p = (children: any[], o: { center?: boolean; left?: number; hanging?: number; before?: number; after?: number; keepNext?: boolean } = {}) =>
    new Paragraph({ children, alignment: o.center ? AlignmentType.CENTER : AlignmentType.LEFT, indent: { left: o.left ?? 0, hanging: o.hanging }, spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 240 }, keepNext: o.keepNext, keepLines: true })
  const lines = (s: string) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const cell = (text: string, width: number, o: { bold?: boolean; center?: boolean } = {}) =>
    new TableCell({ width: { size: width, type: WidthType.DXA }, margins: { top: 40, bottom: 40, left: 100, right: 100 }, children: (lines(text).length ? lines(text) : ['']).map((l) => p([run(l, { bold: o.bold, size: 14 })], { center: o.center })) })

  const mcq = e.questions.filter((q) => q.type === 'mcq')
  const essay = e.questions.filter((q) => q.type === 'essay')
  const total = mcq.length * e.options.mcq_points + essay.length * e.options.essay_points
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  const head = (title: string) => [
    p([run(e.institution || 'วิทยาลัย……………………………', { bold: true, size: 18 })], { center: true }),
    p([run(`${title}${e.examName} ภาคเรียนที่ ${e.term}`, { bold: true, size: 18 })], { center: true }),
    p([run(`รหัสวิชา ${e.course.code}  ชื่อวิชา ${e.course.name}${e.course.section ? `  กลุ่ม ${e.course.section}` : ''}`)], { center: true, after: 120 }),
  ]

  const children: any[] = []
  if (part === 'paper') {
    children.push(
      ...head('แบบทดสอบ'),
      p([run('ชื่อ-สกุล ………………………………………………………… รหัสนักศึกษา ……………………… เลขที่ ……………')], { after: 120 }),
      p([run('คำชี้แจง', { bold: true })]),
      p([run(`1. แบบทดสอบมี ${[mcq.length && `ตอนที่ 1 ปรนัย ${mcq.length} ข้อ`, essay.length && `ตอนที่ ${mcq.length ? 2 : 1} อัตนัย ${essay.length} ข้อ`].filter(Boolean).join(' และ ')} คะแนนเต็ม ${fmt(total)} คะแนน`)], { left: 567 }),
      p([run('2. ปรนัย ให้เลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว อัตนัย ให้ตอบตามที่โจทย์กำหนด')], { left: 567, after: 120 }),
    )
    if (mcq.length) {
      children.push(p([run(`ตอนที่ 1 ปรนัย (${mcq.length} ข้อ ข้อละ ${fmt(e.options.mcq_points)} คะแนน)`, { bold: true })], { before: 120, after: 80, keepNext: true }))
      mcq.forEach((q, i) => {
        children.push(p([run(`${i + 1}. ${q.question}`)], { left: 425, hanging: 425, before: 80, keepNext: true }))
        q.choices.forEach((c, j) => children.push(p([run(`${LETTERS[j]}. ${c}`)], { left: 851, hanging: 284, keepNext: j < 3 })))
      })
    }
    if (essay.length) {
      children.push(p([run(`ตอนที่ ${mcq.length ? 2 : 1} อัตนัย (${essay.length} ข้อ ข้อละ ${fmt(e.options.essay_points)} คะแนน)`, { bold: true })], { before: 240, after: 80, keepNext: true }))
      essay.forEach((q, i) => {
        children.push(p([run(`${i + 1}. ${q.question}`)], { left: 425, hanging: 425, before: 80 }))
        for (let k = 0; k < 4; k++) children.push(p([run('…………………………………………………………………………………………………………………………………')], { left: 425 }))
      })
    }
  } else {
    children.push(...head('เฉลยแบบทดสอบ'))
    if (mcq.length) {
      children.push(p([run('ตอนที่ 1 ปรนัย', { bold: true })], { after: 80 }))
      const cw = [700, 900, 900, 6854]
      children.push(new Table({
        width: { size: W, type: WidthType.DXA }, columnWidths: cw,
        rows: [
          new TableRow({ tableHeader: true, children: ['ข้อ', 'คำตอบ', 'ระดับ', 'เหตุผล'].map((h, i) => cell(h, cw[i], { bold: true, center: true })) }),
          ...mcq.map((q, i) => new TableRow({ children: [cell(String(i + 1), cw[0], { center: true }), cell(q.answer, cw[1], { center: true }), cell(q.level, cw[2], { center: true }), cell(q.guide, cw[3])] })),
        ],
      }))
    }
    if (essay.length) {
      children.push(p([run(`ตอนที่ ${mcq.length ? 2 : 1} อัตนัย`, { bold: true })], { before: 240, after: 80 }))
      essay.forEach((q, i) => {
        children.push(p([run(`${i + 1}. ${q.question}`, { bold: true })], { left: 425, hanging: 425, before: 80, keepNext: true }))
        children.push(p([run('แนวคำตอบ', { bold: true })], { left: 425, keepNext: true }), ...lines(q.answer).map((l) => p([run(l)], { left: 851 })))
        children.push(p([run(`เกณฑ์การให้คะแนน (${fmt(e.options.essay_points)} คะแนน)`, { bold: true })], { left: 425, keepNext: true }), ...lines(q.guide).map((l) => p([run(l)], { left: 851 })))
      })
    }
    // how the paper covers the units and levels
    const levels = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6'].filter((k) => e.questions.some((q) => q.level === k))
    const units = e.units.filter((u) => e.questions.some((q) => q.unit_no === u.no))
    const cw = [3754, ...levels.map(() => Math.floor(4000 / Math.max(1, levels.length))), 1600]
    children.push(p([run('ตารางวิเคราะห์ข้อสอบ (จำนวนข้อตามหน่วยและระดับพฤติกรรม)', { bold: true })], { before: 240, after: 80 }))
    children.push(new Table({
      width: { size: W, type: WidthType.DXA }, columnWidths: cw,
      rows: [
        new TableRow({ tableHeader: true, children: [cell('หน่วยการเรียนรู้', cw[0], { bold: true, center: true }), ...levels.map((k, i) => cell(k, cw[i + 1], { bold: true, center: true })), cell('รวม (ข้อ)', cw[cw.length - 1], { bold: true, center: true })] }),
        ...units.map((u) => new TableRow({ children: [
          cell(`${u.no}. ${u.name}`, cw[0]),
          ...levels.map((k, i) => cell(String(e.questions.filter((q) => q.unit_no === u.no && q.level === k).length || ''), cw[i + 1], { center: true })),
          cell(String(e.questions.filter((q) => q.unit_no === u.no).length), cw[cw.length - 1], { center: true }),
        ] })),
        new TableRow({ children: [cell('รวม', cw[0], { bold: true, center: true }), ...levels.map((k, i) => cell(String(e.questions.filter((q) => q.level === k).length), cw[i + 1], { bold: true, center: true })), cell(String(e.questions.length), cw[cw.length - 1], { bold: true, center: true })] }),
      ],
    }))
    children.push(p([run('หมายเหตุ ข้อสอบนี้ร่างโดย AI จากเนื้อหาในแผนการจัดการเรียนรู้ ครูต้องตรวจความถูกต้องของคำถามและเฉลยทุกข้อก่อนนำไปใช้', { size: 14 })], { before: 240 }))
  }

  const doc = new Document({
    creator: 'ARCANA PROFILE',
    styles: { default: { document: { run: { font: FONT, size: PT(16), sizeComplexScript: PT(16), language: { value: 'th-TH', bidirectional: 'th-TH' } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1418 } } }, children }],
  })
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(await Packer.toBlob(doc))
  const xml = await zip.file('word/document.xml')!.async('string')
  zip.file('word/document.xml', xml.replace(/<w:lang w:val="th-TH"/g, '<w:cs/><w:lang w:val="th-TH"')) // Thai line breaking, as in the plan book
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
