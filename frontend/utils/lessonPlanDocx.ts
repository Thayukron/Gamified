// Word (.docx) export of unit lesson plans in the OVEC 2567 form (แผนการจัดการเรียนรู้ ข้อ 1–10)
// + appendix with the class's learner analysis. Browser-side; the docx library is loaded only when needed.
import { SHEET_TYPES, type CourseBook, type PlanContent, type Sheet } from '~/utils/lessonPlan'

const FONT = 'TH SarabunPSK'
const PT = (n: number) => n * 2 // docx sizes are half-points
const W = 9354 // A4 width 11906 − margins 1418 (left 2.5 cm) − 1134 (right 2 cm), in DXA
const IND1 = 567 // 1 cm
const IND2 = 1134

export interface PlanForExport {
  unit_no: number
  session_no: number
  unit_name: string
  title: string
  hours_theory: number
  hours_practice: number
  content: PlanContent
  sheets?: Sheet[]
}

/**
 * Add <w:cs/> (complex script) to every Thai run, as the official form does — without it Word
 * breaks Thai lines only at spaces, leaving ragged gaps. The docx library has no option for it.
 * In CT_RPr, <w:cs/> must come right before <w:lang>.
 */
async function markThaiRuns(blob: Blob): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(blob)
  const path = 'word/document.xml'
  const xml = await zip.file(path)!.async('string')
  zip.file(path, xml.replace(/<w:lang w:val="th-TH"/g, '<w:cs/><w:lang w:val="th-TH"'))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

const lines = (s: string) => (s || '').split('\n').map((l) => l.trim()).filter(Boolean)
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

const toNum = (s: string | number) => {
  const n = parseFloat(String(s ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * opts.book present → the whole book in form order: cover, preface, table of contents, course curriculum,
 * occupational standard (if any), unit analysis, learning-behaviour analysis (form type 2), unit hours,
 * unit plans, bibliography, appendix. Without it → just the given unit plan(s) + appendix.
 */
export async function exportLessonPlansDocx(opts: { course: any; plans: PlanForExport[]; learners: any; filename: string; book?: CourseBook; institution?: { name: string }; sheetsOnly?: boolean }) {
  const d = await import('docx')
  const { AlignmentType, BorderStyle, Document, Header, HeadingLevel, ImageRun, Packer, PageBreak, PageNumber, Paragraph, PositionalTab, PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo, Table, TableCell, TableOfContents, TableRow, TextRun, VerticalAlign, WidthType } = d

  const logo = await fetch('/forms/ovec-logo.png').then((r) => r.arrayBuffer())

  // Thai text is "complex script": size/bold must be set for both the Latin and the complex-script variants.
  const run = (text: string, o: { bold?: boolean; size?: number; underline?: boolean } = {}) =>
    new TextRun({
      text,
      font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT },
      size: PT(o.size ?? 16),
      sizeComplexScript: PT(o.size ?? 16),
      bold: o.bold,
      boldComplexScript: o.bold,
      underline: o.underline ? {} : undefined,
      language: { value: 'th-TH', bidirectional: 'th-TH' }, // lets Word break Thai lines by word
    })
  const p = (children: any[], o: { indent?: number; hanging?: number; align?: any; before?: number; after?: number; keepNext?: boolean } = {}) =>
    new Paragraph({
      children,
      alignment: o.align ?? AlignmentType.LEFT,
      indent: { left: o.indent ?? 0, hanging: o.hanging },
      spacing: { before: o.before ?? 0, after: o.after ?? 0, line: 240 },
      keepNext: o.keepNext,
    })
  /** dotted line to the right margin (for writing by hand), like the form */
  const dotLine = () =>
    new TextRun({
      children: [new PositionalTab({ alignment: PositionalTabAlignment.RIGHT, relativeTo: PositionalTabRelativeTo.MARGIN, leader: PositionalTabLeader.DOT })],
      font: { ascii: FONT, hAnsi: FONT, cs: FONT },
      size: PT(16),
      sizeComplexScript: PT(16),
    })
  const heading = (text: string, before = 120) => p([run(text, { bold: true })], { before, keepNext: true, align: AlignmentType.LEFT })
  const sub = (label: string, value = '', indent = IND1) =>
    p([run(label, { bold: !!value || undefined }), ...(value ? [run(' ' + value)] : [])], { indent, align: AlignmentType.LEFT })
  /** body lines indented; an empty field leaves dotted lines to write by hand */
  const body = (text: string, indent = IND1, blankLines = 1) => {
    const ls = lines(text)
    if (!ls.length) return Array.from({ length: blankLines }, () => p([dotLine()], { indent }))
    return ls.map((l) => p([run(l)], { indent }))
  }
  const numbered = (items: string[], prefix: string, indent = IND1) =>
    items.map((l, i) => p([run(`${prefix}${i + 1} ${l.replace(/^\d+(\.\d+)*[.)]?\s*/, '')}`)], { indent: indent + 567, hanging: 567 }))

  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const cell = (children: any[], width: number, o: { rowSpan?: number; columnSpan?: number; center?: boolean } = {}) =>
    new TableCell({
      children,
      width: { size: width, type: WidthType.DXA },
      rowSpan: o.rowSpan,
      columnSpan: o.columnSpan,
      verticalAlign: o.center ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { top: 40, bottom: 40, left: 100, right: 100 },
    })

  const course = opts.course
  const higher = String(course.level ?? course.section ?? '').includes('ปวส')

  // ---- header table exactly like the form: logo | title / code+name / unit name | unit no / session / hours
  const headerTable = (pl: PlanForExport, docTitle = 'แผนการจัดการเรียนรู้', nameLabel = 'ชื่อเรื่อง/งาน ', nameValue = pl.title || pl.unit_name) => {
    const [cL, cM, cR] = [1300, 5554, 2500]
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [cL, cM, cR],
      rows: [
        new TableRow({
          children: [
            cell([p([new ImageRun({ type: 'png', data: logo, transformation: { width: 70, height: 70 } })], { align: AlignmentType.CENTER })], cL, { rowSpan: 3, center: true }),
            cell([p([run(docTitle, { bold: true, size: 18 })], { align: AlignmentType.CENTER })], cM, { center: true }),
            cell([p([run(`หน่วยที่ ${pl.unit_no}`)], { align: AlignmentType.LEFT })], cR, { center: true }),
          ],
        }),
        new TableRow({
          children: [
            cell([p([run('รหัสวิชา '), run(course.code, { bold: true }), run('   ชื่อวิชา '), run(course.name, { bold: true })], { align: AlignmentType.LEFT })], cM),
            cell([p([run(`สอนครั้งที่ ${pl.session_no}`)], { align: AlignmentType.LEFT })], cR),
          ],
        }),
        new TableRow({
          children: [
            cell([p([run('ชื่อหน่วยการเรียนรู้ '), run(pl.unit_name, { bold: true })], { align: AlignmentType.LEFT })], cM),
            cell(
              [p([run(`ทฤษฎี ${num(pl.hours_theory)} ชม.`)], { align: AlignmentType.LEFT }), p([run(`ปฏิบัติ ${num(pl.hours_practice)} ชม.`)], { align: AlignmentType.LEFT })],
              cR,
              { rowSpan: 2, center: true },
            ),
          ],
        }),
        new TableRow({
          children: [cell([p([run(nameLabel), run(nameValue, { bold: true })], { align: AlignmentType.LEFT })], cL + cM, { columnSpan: 2 })],
        }),
      ],
    })
  }

  const planBody = (pl: PlanForExport) => {
    const c = pl.content
    const out: any[] = [headerTable(pl)]

    out.push(heading('1. ผลลัพธ์การเรียนรู้ระดับหน่วยการเรียน'), ...body(c.outcome))

    out.push(heading('2. อ้างอิงมาตรฐาน/เชื่อมโยงกลุ่มอาชีพ'))
    const s = c.standard
    out.push(p([run('2.1 มาตรฐานอาชีพ '), run(s.occupation || '-'), ...(s.sub_competency ? [run('   สมรรถนะย่อย '), run(s.sub_competency)] : [])], { indent: IND1, align: AlignmentType.LEFT }))
    ;([
      ['1) เกณฑ์การปฏิบัติงาน', s.criteria],
      ['2) วิธีประเมิน', s.method],
      ['3) หลักฐานการปฏิบัติงาน (Performance Evidence)', s.performance_evidence],
      ['4) หลักฐานความรู้ (Knowledge Evidence)', s.knowledge_evidence],
    ] as const).forEach(([label, v]) => {
      out.push(p([run(label)], { indent: IND2, align: AlignmentType.LEFT }))
      if (lines(v).length) out.push(...body(v, IND2 + 284))
    })
    out.push(p([run('2.2 บูรณาการกลุ่มอาชีพ')], { indent: IND1, align: AlignmentType.LEFT }), ...body(s.career_integration, IND2))

    out.push(heading('3. สมรรถนะประจำหน่วย'))
    out.push(
      p([run('3.1 ' + (c.competency.knowledge || (higher ? 'ประมวลความรู้เกี่ยวกับ…' : 'แสดงความรู้เกี่ยวกับ…')))], { indent: IND1, hanging: 0 }),
      p([run('3.2 ' + (c.competency.practice || '…'))], { indent: IND1 }),
      p([run('3.3 ' + (c.competency.apply || '…'))], { indent: IND1 }),
    )

    out.push(heading('4. จุดประสงค์เชิงพฤติกรรม'))
    const objs = [...lines(c.objectives.cognitive), ...lines(c.objectives.psychomotor), ...lines(c.objectives.affective), ...lines(c.objectives.application)]
    out.push(...(objs.length ? numbered(objs, '4.') : body('', IND1, 4)))

    out.push(heading('5. สาระการเรียนรู้'), ...body(c.content, IND1, 2))

    out.push(heading('6. กิจกรรมการเรียนรู้ (MIAP)'))
    ;([
      ['6.1 ขั้นสนใจปัญหา (Motivation)', c.activities.motivation],
      ['6.2 ขั้นศึกษาข้อมูล (Information)', c.activities.information],
      ['6.3 ขั้นพยายาม (Application)', c.activities.application],
      ['6.4 ขั้นสำเร็จผล (Progress)', c.activities.progress],
    ] as const).forEach(([label, v]) => out.push(sub(label), ...body(v, IND2)))
    if (lines(c.differentiation).length) {
      out.push(sub('6.5 การจัดกิจกรรมตามผลการวิเคราะห์ผู้เรียน (ARCANA PROFILE)'), ...body(c.differentiation, IND2))
    }

    out.push(heading('7. สื่อและแหล่งการเรียนรู้'), ...(lines(c.media).length ? numbered(lines(c.media), '7.') : body('', IND1, 2)))

    out.push(heading('8. หลักฐานการเรียนรู้'))
    out.push(sub('8.1 หลักฐานความรู้'), ...body(c.evidence.knowledge, IND2), sub('8.2 หลักฐานการปฏิบัติงาน'), ...body(c.evidence.performance, IND2))

    out.push(heading('9. การวัดและประเมินผล'))
    out.push(
      sub('9.1 เกณฑ์การปฏิบัติงาน'), ...body(c.assessment.criteria, IND2),
      sub('9.2 วิธีการประเมิน'), ...body(c.assessment.methods, IND2),
      sub('9.3 เครื่องมือประเมิน'), ...body(c.assessment.tools, IND2),
    )

    out.push(heading('10. บันทึกผลหลังการจัดการเรียนรู้'))
    out.push(
      sub('10.1 ผลการจัดการเรียนรู้ที่เกิดขึ้นกับผู้เรียน'), ...body(c.after.results, IND2, 2),
      sub('10.2 ปัญหา อุปสรรคที่พบ'), ...body(c.after.problems, IND2, 2),
      sub('10.3 การแก้ไขปัญหา'),
      p([run('1) ผลการแก้ไขปัญหาที่ส่งผลลัพธ์ที่ดีต่อผู้เรียน')], { indent: IND2, align: AlignmentType.LEFT }), ...body(c.after.solution_result, IND2 + 284, 2),
      p([run('2) แนวทางแก้ปัญหาในครั้งต่อไป')], { indent: IND2, align: AlignmentType.LEFT }), ...body(c.after.next_time, IND2 + 284, 2),
    )
    return out
  }

  // ---- appendix: learner analysis (anonymous class statistics)
  const appendix = () => {
    const L = opts.learners
    const out: any[] = [
      p([new PageBreak()]),
      p([run('ภาคผนวก', { bold: true, size: 18 })], { align: AlignmentType.CENTER, after: 120 }),
      p([run('ผลการวิเคราะห์ผู้เรียนรายบุคคลเพื่อการออกแบบการจัดการเรียนรู้', { bold: true })], { align: AlignmentType.CENTER, after: 120 }),
      p(
        [run(`รายวิชา ${course.code} ${course.name} กลุ่มเรียน ${course.section ?? '-'} ภาคเรียนที่ ${L.term.semester}/${L.term.academic_year} ` +
          `ผู้เรียนทั้งหมด ${L.enrolled} คน ได้รับการวิเคราะห์ ${L.profiled} คน ด้วยแบบคัดกรองผ่านเกม ARCANA PROFILE ` +
          'ซึ่งวัดสไตล์การเรียนรู้ (VARK) ความสนใจอาชีพ (RIASEC) และกรอบความคิด (Mindset) ผลระดับห้องเรียนเป็นดังนี้')],
        { indent: 0, after: 120 },
      ),
    ]
    if (!L.ready) {
      out.push(p([run('ยังไม่มีผู้เรียนในรายวิชานี้ทำแบบคัดกรอง')], { indent: IND1 }))
      return out
    }
    const tbl = (title: string, rows: [string, string][]) => {
      const [a, b] = [W - 2200, 2200]
      return new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: [a, b],
        rows: [
          new TableRow({ tableHeader: true, children: [cell([p([run(title, { bold: true })], { align: AlignmentType.CENTER })], a), cell([p([run('ร้อยละ', { bold: true })], { align: AlignmentType.CENTER })], b)] }),
          ...rows.map(([k, v]) => new TableRow({ children: [cell([p([run(k)], { align: AlignmentType.LEFT })], a), cell([p([run(v)], { align: AlignmentType.CENTER })], b)] })),
        ],
      })
    }
    const pct = (n: number) => String(Math.round((n / Math.max(1, L.profiled)) * 100))
    out.push(heading('1. สไตล์การเรียนรู้ (VARK) — สัดส่วนเฉลี่ยของห้อง'), tbl('สไตล์การเรียนรู้', L.vark.map((v: any) => [v.label, String(v.pct)])))
    out.push(heading('2. ความสนใจอาชีพ (RIASEC) — สัดส่วนเฉลี่ยของห้อง'), tbl('ความสนใจอาชีพ', L.riasec.map((v: any) => [v.label, String(v.pct)])))
    out.push(
      heading('3. กรอบความคิด (Mindset) — จำนวนผู้เรียน'),
      tbl('กรอบความคิด', [
        [`Growth Mindset (แบบเติบโต) ${L.mindset.growth} คน`, pct(L.mindset.growth)],
        [`Mixed (ผสมผสาน) ${L.mindset.mixed} คน`, pct(L.mindset.mixed)],
        [`Fixed Mindset (แบบยึดติด) ${L.mindset.fixed} คน`, pct(L.mindset.fixed)],
      ]),
    )
    out.push(heading('4. สรุปผลและแนวทางการจัดการเรียนรู้'), ...L.summary.map((s: string) => p([run('• ' + s)], { indent: IND1, hanging: 284 })))
    const diffs = opts.plans.filter((pl) => lines(pl.content.differentiation).length)
    if (diffs.length) {
      out.push(heading('5. การนำผลการวิเคราะห์ไปใช้ในแผนการจัดการเรียนรู้'))
      diffs.forEach((pl) => out.push(p([run(`หน่วยที่ ${pl.unit_no} ${pl.title || pl.unit_name} (สอนครั้งที่ ${pl.session_no})`, { bold: true })], { indent: IND1 }), ...body(pl.content.differentiation, IND2)))
    }
    out.push(p([run('หมายเหตุ ผลการวิเคราะห์เป็นข้อมูลคัดกรองเบื้องต้นเพื่อประกอบการออกแบบการจัดการเรียนรู้ ไม่ใช่การวินิจฉัย ใช้ร่วมกับการสังเกตผู้เรียนในชั้นเรียน', { size: 14 })], { before: 240 }))
    return out
  }

  // ================================================================== course-level book parts
  const book = opts.book
  const sm = 14 // table text size
  const tp = (text: string, o: { bold?: boolean; center?: boolean; size?: number } = {}) =>
    p([run(text, { bold: o.bold, size: o.size ?? sm })], { align: o.center ? AlignmentType.CENTER : AlignmentType.LEFT })
  const tcell = (text: string, width: number, o: { bold?: boolean; center?: boolean; rowSpan?: number; columnSpan?: number; size?: number } = {}) =>
    cell(lines(text).length ? lines(text).map((l) => tp(l, o)) : [tp('', o)], width, { rowSpan: o.rowSpan, columnSpan: o.columnSpan, center: o.center })
  /** part title — Heading 1 so it appears in the table of contents */
  const partTitle = (text: string, pageBreak = true) =>
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, pageBreakBefore: pageBreak, spacing: { after: 160 }, children: [run(text, { bold: true, size: 18 })] })
  const label = (text: string, value = '') => p([run(text, { bold: true }), ...(value ? [run(' ' + value)] : [])], { before: 80 })
  const plainNumbered = (items: string[]) => items.map((l, i) => p([run(`${i + 1}. ${l.replace(/^\d+[.)]\s*/, '')}`)], { indent: IND1 + 284, hanging: 284 }))
  const fmt = (n: number) => (n ? (Number.isInteger(n) ? String(n) : n.toFixed(1)) : '')
  const codeLine = () => p([run('รหัส '), run(course.code, { bold: true }), run('   ชื่อวิชา '), run(course.name, { bold: true })])
  const hoursLine = () => p([run(`ทฤษฎี ${book!.curriculum.theory_hours || '…'} ชั่วโมง/สัปดาห์   ปฏิบัติ ${book!.curriculum.practice_hours || '…'} ชั่วโมง/สัปดาห์   จำนวน ${book!.curriculum.credits || '…'} หน่วยกิต`)])
  /** group consecutive rows with the same key into rowSpan blocks (merged cells like the form) */
  const spans = (rows: Record<string, string>[], key: (r: Record<string, string>) => string) => {
    const out: number[] = rows.map(() => 0)
    for (let i = 0; i < rows.length; ) {
      let j = i + 1
      while (j < rows.length && key(rows[j]) === key(rows[i]) && key(rows[i]) !== '') j++
      out[i] = j - i
      i = j
    }
    return out // span at the first row of a block, 0 for rows covered by it
  }

  const cover = () => {
    const c = book!.curriculum
    const big = (t: string, size: number, before = 0, bold = true) => p([run(t, { bold, size })], { align: AlignmentType.CENTER, before })
    return [
      p([new ImageRun({ type: 'png', data: logo, transformation: { width: 150, height: 150 } })], { align: AlignmentType.CENTER, before: 600 }),
      big('แผนการจัดการเรียนรู้', 26, 500),
      big(`หลักสูตร${c.program}`, 18, 400, false),
      ...(c.major ? [big(`สาขาวิชา${c.major}`, 18, 0, false)] : []),
      ...(c.occupation_group ? [big(`กลุ่มอาชีพ${c.occupation_group}`, 18, 0, false)] : []),
      ...(c.field_type ? [big(`ประเภทวิชา${c.field_type}`, 18, 0, false)] : []),
      big(`รหัสวิชา ${course.code}  วิชา ${course.name}`, 20, 900),
      ...(book!.author ? [big(`จัดทำโดย ${book!.author}`, 18, 900, false)] : []),
      big(`ภาคเรียนที่ ${opts.learners.term.semester} ปีการศึกษา ${opts.learners.term.academic_year}`, 18, 0, false),
      big(opts.institution?.name || 'วิทยาลัย……………………………', 20, 600),
    ]
  }

  const preface = () => [
    partTitle('คำนำ'),
    ...lines(book!.preface).map((l) => new Paragraph({ children: [run(l)], alignment: AlignmentType.THAI_DISTRIBUTE, indent: { firstLine: 1134 }, spacing: { after: 120 } })),
    p([run(book!.author || '……………………………')], { align: AlignmentType.CENTER, indent: 5000, before: 480 }),
    p([run('ผู้จัดทำ')], { align: AlignmentType.CENTER, indent: 5000 }),
  ]

  const toc = () => [
    new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: true, spacing: { after: 160 }, children: [run('สารบัญ', { bold: true, size: 18 })] }),
    new TableOfContents('สารบัญ', { hyperlink: true, headingStyleRange: '1-3' }),
  ]

  const curriculumPart = () => {
    const c = book!.curriculum
    return [
      partTitle('หลักสูตรรายวิชา'),
      p([run('หลักสูตร '), run(c.program, { bold: true })]),
      p([run('ประเภทวิชา '), run(c.field_type || '…'), run('   กลุ่มอาชีพ '), run(c.occupation_group || '…'), run('   สาขาวิชา '), run(c.major || '…')]),
      codeLine(),
      hoursLine(),
      label('อ้างอิงมาตรฐาน'), ...body(c.standards_ref, IND1),
      label('ผลลัพธ์การเรียนรู้ระดับรายวิชา'), ...body(c.outcome, IND1),
      label('จุดประสงค์รายวิชา เพื่อให้'), ...(lines(c.objectives).length ? plainNumbered(lines(c.objectives)) : body('', IND1, 3)),
      label('สมรรถนะรายวิชา'), ...(lines(c.competencies).length ? plainNumbered(lines(c.competencies)) : body('', IND1, 3)),
      label('คำอธิบายรายวิชา'),
      ...(lines(c.description).length
        ? lines(c.description).map((l) => new Paragraph({ children: [run(l)], alignment: AlignmentType.THAI_DISTRIBUTE, indent: { firstLine: 1134 } }))
        : body('', IND1, 3)),
    ]
  }

  const occupationalPart = () => {
    const o = book!.occupational
    if (!o.agency && !o.standard && !o.rows.length) return []
    const wd = [900, 2100, 900, 2100, 1900, 1454]
    const spanUnit = spans(o.rows, (r) => r.unit_code + '|' + r.unit_desc)
    return [
      partTitle('มาตรฐานอาชีพ'),
      p([run('หน่วยงานรับรองมาตรฐานอาชีพ '), run(o.agency || '…')]),
      p([run('มาตรฐานอาชีพ สาขาวิชาชีพ '), run(o.standard || '…')]),
      p([run('อาชีพ '), run(o.occupation || '…'), run('   ระดับ '), run(o.level || '…')], { after: 120 }),
      new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: wd,
        rows: [
          new TableRow({ tableHeader: true, children: [
            tcell('หน่วยสมรรถนะ', wd[0] + wd[1], { bold: true, center: true, columnSpan: 2 }),
            tcell('สมรรถนะย่อย', wd[2] + wd[3], { bold: true, center: true, columnSpan: 2 }),
            tcell('เกณฑ์การปฏิบัติงาน', wd[4], { bold: true, center: true, rowSpan: 2 }),
            tcell('วิธีประเมิน', wd[5], { bold: true, center: true, rowSpan: 2 }),
          ] }),
          new TableRow({ tableHeader: true, children: ['รหัส', 'คำอธิบาย', 'รหัส', 'คำอธิบาย'].map((h, i) => tcell(h, wd[i], { bold: true, center: true })) }),
          ...o.rows.map((r, i) => new TableRow({ children: [
            ...(spanUnit[i] ? [tcell(r.unit_code, wd[0], { rowSpan: spanUnit[i] }), tcell(r.unit_desc, wd[1], { rowSpan: spanUnit[i] })] : []),
            tcell(r.sub_code, wd[2]), tcell(r.sub_desc, wd[3]), tcell(r.criteria, wd[4]), tcell(r.method, wd[5]),
          ] })),
        ],
      }),
    ]
  }

  const jobPart = () => {
    const j = book!.job_analysis
    const wd = [1800, 1900, 1600, 2027, 2027]
    const rows = j.rows.length ? j.rows : [{ duty: '', task: '', sub_competency: '', knowledge: '', skill: '' }]
    const spanDuty = spans(rows, (r) => r.duty)
    return [
      partTitle('ตารางวิเคราะห์หน่วยการเรียนรู้'),
      new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: wd,
        rows: [
          new TableRow({ tableHeader: true, children: [tcell(`ผลลัพธ์การเรียนรู้ระดับรายวิชา (Job) ${j.job}`, W, { bold: true, columnSpan: 5 })] }),
          new TableRow({ tableHeader: true, children: [
            'งานหลัก\n(Duty)', 'งานย่อย\n(Task)', 'สมรรถนะย่อย\n(มาตรฐานอาชีพ)', 'ความรู้\nในการปฏิบัติงาน', 'ทักษะ\nในการปฏิบัติงาน',
          ].map((h, i) => tcell(h, wd[i], { bold: true, center: true })) }),
          ...rows.map((r, i) => new TableRow({ children: [
            ...(spanDuty[i] ? [tcell(r.duty, wd[0], { rowSpan: spanDuty[i] })] : []),
            tcell(r.task, wd[1]), tcell(r.sub_competency || '-', wd[2], { center: !r.sub_competency }), tcell(r.knowledge, wd[3]), tcell(r.skill, wd[4]),
          ] })),
        ],
      }),
    ]
  }

  const unitTotals = () => {
    const u = book!.units
    const t = u.reduce((s, r) => s + toNum(r.hours_theory), 0)
    const pr = u.reduce((s, r) => s + toNum(r.hours_practice), 0)
    const pc = u.reduce((s, r) => s + toNum(r.percent), 0)
    const f = book!.final_eval
    return { t, pr, pc, ft: toNum(f.hours_theory), fp: toNum(f.hours_practice), fpc: toNum(f.percent) }
  }

  const behaviourPart = () => {
    const u = book!.units
    const wd = [3200, 1200, 1000, 1000, 1000, 1054, 900]
    const T = unitTotals()
    const span5 = wd.slice(0, 5).reduce((a, b) => a + b, 0)
    const legend = new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [3118, 3118, 3118],
      rows: [
        new TableRow({ children: [tcell('ระดับความสามารถที่คาดหวัง วิเคราะห์ให้สอดคล้องจุดประสงค์รายวิชาหรือสูงกว่า', W, { bold: true, columnSpan: 3 })] }),
        new TableRow({ children: ['พุทธิพิสัย', 'ทักษะพิสัย', 'จิตพิสัย'].map((h) => tcell(h, 3118, { bold: true, center: true })) }),
        new TableRow({ children: [
          tcell('K1 = ความรู้ ความจำ\nK2 = ความเข้าใจ\nK3 = การนำไปใช้\nK4 = การวิเคราะห์\nK5 = การประเมินค่า\nK6 = การสร้างสรรค์\nหมายเหตุ ใส่ได้มากกว่า 1 ระดับ', 3118, { size: 13 }),
          tcell('S1 = เลียนแบบ\nS2 = ทำได้ตามแบบ\nS3 = ทำได้ถูกต้อง\nS4 = ทำได้อย่างต่อเนื่อง\nS5 = ทำได้อย่างเป็นธรรมชาติ\nหมายเหตุ ใส่ระดับที่คาดหวังระดับเดียว', 3118, { size: 13 }),
          tcell('A1 = รับรู้\nA2 = ตอบสนอง\nA3 = การสร้างคุณค่า\nA4 = จัดระบบคุณค่านิยม\nA5 = การสร้างลักษณะนิสัย\nหมายเหตุ ใส่ระดับที่คาดหวังระดับเดียว', 3118, { size: 13 }),
        ] }),
        new TableRow({ children: [tcell('ด้านความสามารถประยุกต์ใช้และรับผิดชอบ', W, { bold: true, columnSpan: 3 })] }),
        new TableRow({ children: [tcell(
          'Ap1 = สามารถปฏิบัติงานตามแบบแผนที่กำหนด\n'
          + 'Ap2 = สามารถปฏิบัติงานตามแบบแผน และปรับตัวภายใต้ความเปลี่ยนแปลงที่ไม่ซับซ้อน\n'
          + 'Ap3 = สามารถวางแผนการปฏิบัติงานที่ได้รับมอบหมายและแก้ไขปัญหาการปฏิบัติงานที่ไม่อยู่ภายใต้การควบคุมในบางเรื่อง โดยประยุกต์ใช้ความรู้ ทักษะทางวิชาชีพ เทคโนโลยีสารสนเทศและการสื่อสาร\n'
          + 'Ap4 = สามารถวางแผนการปฏิบัติงานที่รับผิดชอบ ปรับตัวและแก้ไขปัญหาการปฏิบัติงานที่ไม่คุ้นเคยหรือซับซ้อนและเป็นนามธรรม โดยประยุกต์ใช้ความรู้ ทักษะทางวิชาชีพ เทคโนโลยีสารสนเทศและการสื่อสาร\n'
          + 'Ap5 = สามารถประยุกต์ใช้ความรู้ ทักษะทางวิชาชีพ เทคโนโลยีสารสนเทศและการสื่อสารในการวางแผนแก้ไขปัญหาและพัฒนานวัตกรรมตามสายอาชีพ\n'
          + 'หมายเหตุ ใส่ระดับที่คาดหวังระดับเดียว', W, { size: 13, columnSpan: 3 })] }),
      ],
    })
    return [
      partTitle('ตารางวิเคราะห์พฤติกรรมการเรียนรู้'),
      codeLine(), hoursLine(), p([], { after: 80 }),
      new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: wd,
        rows: [
          new TableRow({ tableHeader: true, children: [
            tcell('หน่วยการเรียนรู้', wd[0], { bold: true, center: true, rowSpan: 2 }),
            tcell('ระดับความสามารถที่คาดหวัง', wd[1] + wd[2] + wd[3] + wd[4], { bold: true, center: true, columnSpan: 4 }),
            tcell('จำนวนชั่วโมง\nท/ป', wd[5], { bold: true, center: true, rowSpan: 2 }),
            tcell('ร้อยละ\nประเมินผล', wd[6], { bold: true, center: true, rowSpan: 2 }),
          ] }),
          new TableRow({ tableHeader: true, children: ['พุทธิพิสัย', 'ทักษะพิสัย', 'จิตพิสัย', 'ประยุกต์ใช้'].map((h, i) => tcell(h, wd[i + 1], { bold: true, center: true })) }),
          ...u.map((r) => new TableRow({ children: [
            tcell(`${r.no}. ${r.name}`, wd[0]), tcell(r.k, wd[1], { center: true }), tcell(r.s, wd[2], { center: true }), tcell(r.a, wd[3], { center: true }), tcell(r.ap, wd[4], { center: true }),
            tcell(`${r.hours_theory || 0}/${r.hours_practice || 0}`, wd[5], { center: true }), tcell(r.percent, wd[6], { center: true }),
          ] })),
          new TableRow({ children: [tcell('รวมการจัดการเรียนรู้ตลอดภาคเรียน', span5, { bold: true, columnSpan: 5 }), tcell(`${fmt(T.t) || 0}/${fmt(T.pr) || 0}`, wd[5], { center: true }), tcell(fmt(T.pc), wd[6], { center: true })] }),
          new TableRow({ children: [tcell('ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา (เมื่อเรียนรายวิชานี้สำเร็จแล้วทำอะไรได้)', span5, { columnSpan: 5 }), tcell(`${fmt(T.ft) || 0}/${fmt(T.fp) || 0}`, wd[5], { center: true }), tcell(fmt(T.fpc), wd[6], { center: true })] }),
          new TableRow({ children: [tcell('รวม', span5, { bold: true, center: true, columnSpan: 5 }), tcell(`${fmt(T.t + T.ft) || 0}/${fmt(T.pr + T.fp) || 0}`, wd[5], { bold: true, center: true }), tcell(fmt(T.pc + T.fpc), wd[6], { bold: true, center: true })] }),
        ],
      }),
      p([], { after: 120 }),
      legend,
    ]
  }

  const unitsPart = () => {
    const u = book!.units
    const wd = [900, 5254, 1067, 1067, 1066]
    const T = unitTotals()
    const row = (a: string, b: string, t: number | string, pr: number | string, bold = false) =>
      new TableRow({ children: [tcell(a, wd[0], { center: true, bold, size: 16 }), tcell(b, wd[1], { bold, size: 16 }), ...[t, pr, toNum(t) + toNum(pr)].map((v, i) => tcell(fmt(toNum(v)), wd[2 + i], { center: true, bold, size: 16 }))] })
    return [
      partTitle('หน่วยการเรียนรู้'),
      codeLine(), hoursLine(), p([], { after: 80 }),
      new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: wd,
        rows: [
          new TableRow({ tableHeader: true, children: [
            tcell('หน่วยที่', wd[0], { bold: true, center: true, rowSpan: 2, size: 16 }),
            tcell('หน่วยการเรียนรู้', wd[1], { bold: true, center: true, rowSpan: 2, size: 16 }),
            tcell('เวลาเรียน (ชม.)', wd[2] + wd[3] + wd[4], { bold: true, center: true, columnSpan: 3, size: 16 }),
          ] }),
          new TableRow({ tableHeader: true, children: ['ทฤษฎี', 'ปฏิบัติ', 'รวม'].map((h, i) => tcell(h, wd[2 + i], { bold: true, center: true, size: 16 })) }),
          ...u.map((r) => row(r.no, r.name, r.hours_theory, r.hours_practice)),
          row('', 'ประเมินผลลัพธ์การเรียนรู้ระดับรายวิชา', T.ft, T.fp),
          new TableRow({ children: [tcell('รวม', wd[0] + wd[1], { bold: true, center: true, columnSpan: 2, size: 16 }), ...[T.t + T.ft, T.pr + T.fp, T.t + T.ft + T.pr + T.fp].map((v, i) => tcell(fmt(v), wd[2 + i], { bold: true, center: true, size: 16 }))] }),
        ],
      }),
    ]
  }

  const bibliographyPart = () => [
    partTitle('บรรณานุกรม'),
    ...(lines(book!.bibliography).length ? lines(book!.bibliography).map((l) => p([run(l)], { indent: 709, hanging: 709 })) : body('', 0, 3)),
  ]

  // ================================================================== supporting sheets
  const sheetBody = (pl: PlanForExport, s: Sheet) => {
    const spec = SHEET_TYPES[s.type]
    const c = s.content
    const title = `${spec.th}ที่ ${s.number}`
    const out: any[] = [headerTable(pl, title, `${spec.nameLabel} `, s.title || pl.title || pl.unit_name)]
    if (s.type === 'assessment') {
      out.push(p([run('แบบประเมินความสามารถในการปฏิบัติงาน/ผลลัพธ์การเรียนรู้/สมรรถนะ', { bold: true, size: 18 })], { align: AlignmentType.CENTER, before: 160, after: 80 }))
      out.push(p([run('ชื่อ-สกุล '), dotLine()], { before: 40 }), p([run('รหัสนักศึกษา ……………………… กลุ่มเรียน ……………………… วันที่ประเมิน ………………………')], { after: 80 }))
      out.push(heading('คำชี้แจง', 40), ...body(c.instructions, IND1))
      const items = (c.rubric ?? []) as Record<string, string>[]
      const sw = [700, 4854, 950, 950, 950, 950]
      out.push(p([], { after: 80 }), new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: sw,
        rows: [
          new TableRow({ tableHeader: true, children: [
            tcell('ที่', sw[0], { bold: true, center: true, rowSpan: 2, size: 16 }), tcell('รายการประเมิน', sw[1], { bold: true, center: true, rowSpan: 2, size: 16 }),
            tcell('ระดับคะแนน', sw[2] * 4, { bold: true, center: true, columnSpan: 4, size: 16 }),
          ] }),
          new TableRow({ tableHeader: true, children: ['4', '3', '2', '1'].map((h, i) => tcell(h, sw[2 + i], { bold: true, center: true, size: 16 })) }),
          ...items.map((r, i) => new TableRow({ children: [tcell(String(i + 1), sw[0], { center: true, size: 16 }), tcell(r.item, sw[1], { size: 16 }), ...[0, 1, 2, 3].map((k) => tcell('', sw[2 + k]))] })),
          new TableRow({ children: [tcell('รวมคะแนน', sw[0] + sw[1], { bold: true, center: true, columnSpan: 2, size: 16 }), tcell(`เต็ม ${items.length * 4}`, sw[2] * 4, { center: true, columnSpan: 4, size: 16 })] }),
        ],
      }))
      const rw = [2354, 1750, 1750, 1750, 1750]
      out.push(heading('เกณฑ์การให้คะแนน (Rubric)'), new Table({
        width: { size: W, type: WidthType.DXA },
        columnWidths: rw,
        rows: [
          new TableRow({ tableHeader: true, children: ['รายการประเมิน', '4 ดีมาก', '3 ดี', '2 พอใช้', '1 ปรับปรุง'].map((h, i) => tcell(h, rw[i], { bold: true, center: true })) }),
          ...items.map((r) => new TableRow({ children: [tcell(r.item, rw[0], { bold: true }), tcell(r.l4, rw[1]), tcell(r.l3, rw[2]), tcell(r.l2, rw[3]), tcell(r.l1, rw[4])] })),
        ],
      }))
      out.push(heading('เกณฑ์การผ่าน'), ...body(c.pass, IND1))
      out.push(
        p([run('ลงชื่อ ………………………………………… ผู้ประเมิน')], { align: AlignmentType.CENTER, indent: 4300, before: 360 }),
        p([run(`(${opts.book?.author || course.teacher_name || '…………………………………………'})`)], { align: AlignmentType.CENTER, indent: 4300 }),
      )
      return out
    }
    for (const sec of spec.sections) {
      const v = String(c[sec.key] ?? '')
      if (sec.pageBreak) out.push(p([new PageBreak()]))
      out.push(heading(`${sec.no}. ${sec.title}`))
      if (sec.numbered && lines(v).length) out.push(...numbered(lines(v), `${sec.no}.`))
      else out.push(...body(v, IND1, sec.rows && sec.rows > 3 ? 3 : 1))
    }
    return out
  }

  // ================================================================== assemble
  const children: any[] = []
  if (book) {
    children.push(...preface(), ...toc(), ...curriculumPart(), ...occupationalPart(), ...jobPart(), ...behaviourPart(), ...unitsPart())
  }
  let first = true
  const newPage = () => {
    if (!first) children.push(p([new PageBreak()]))
    first = false
  }
  opts.plans.forEach((pl) => {
    if (!opts.sheetsOnly) {
      if (book) {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: true, spacing: { after: 120 }, children: [run(`หน่วยที่ ${pl.unit_no} ${pl.title || pl.unit_name} (สอนครั้งที่ ${pl.session_no})`, { bold: true })] }))
        first = false
      } else {
        newPage()
      }
      children.push(...planBody(pl))
    }
    for (const s of pl.sheets ?? []) {
      newPage()
      // in the book every sheet is listed in the table of contents under its unit
      if (book) children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { after: 80 }, children: [run(`${SHEET_TYPES[s.type].th}ที่ ${s.number} ${s.title}`, { bold: true })] }))
      children.push(...sheetBody(pl, s))
    }
  })
  if (book) children.push(...bibliographyPart())
  if (opts.learners) {
    const app = appendix()
    if (book) app.splice(0, 2, partTitle('ภาคผนวก')) // page break + title → a TOC heading
    children.push(...app)
  }

  const page = { size: { width: 11906, height: 16838 }, margin: { top: 851, right: 1134, bottom: 567, left: 1418, header: 709, footer: 709 } }
  const pageHeader = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: PT(16), sizeComplexScript: PT(16) })] })] })
  const headingRun = { font: FONT, bold: true, boldComplexScript: true, color: '000000' }
  const doc = new Document({
    creator: 'ARCANA PROFILE',
    title: `แผนการจัดการเรียนรู้ ${course.code} ${course.name}`,
    features: book ? { updateFields: true } : undefined, // Word fills the table of contents when the file opens
    styles: {
      default: { document: { run: { font: FONT, size: PT(16), sizeComplexScript: PT(16), language: { value: 'th-TH', bidirectional: 'th-TH' } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { ...headingRun, size: PT(18), sizeComplexScript: PT(18) }, paragraph: { spacing: { before: 0, after: 160 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { ...headingRun, size: PT(16), sizeComplexScript: PT(16) }, paragraph: { spacing: { before: 0, after: 120 } } },
        // table-of-contents entries (Word's built-in "toc 1/2" styles would fall back to Angsana)
        { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(16), sizeComplexScript: PT(16) }, paragraph: { spacing: { before: 60, after: 0 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { ...headingRun, size: PT(16), sizeComplexScript: PT(16) }, paragraph: { spacing: { before: 0, after: 80 } } },
        { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(16), sizeComplexScript: PT(16) }, paragraph: { indent: { left: 1134 }, spacing: { before: 0, after: 0 } } },
        { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { font: FONT, size: PT(16), sizeComplexScript: PT(16) }, paragraph: { indent: { left: 567 }, spacing: { before: 0, after: 0 } } },
      ],
    },
    sections: book
      ? [
          { properties: { page }, children: cover() }, // cover: no page number
          { properties: { page }, headers: { default: pageHeader }, children },
        ]
      : [{ properties: { page }, headers: { default: pageHeader }, children }],
  })
  const blob = await markThaiRuns(await Packer.toBlob(doc))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
