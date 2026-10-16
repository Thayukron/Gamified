// Word (.docx) export of unit lesson plans in the OVEC 2567 form (แผนการจัดการเรียนรู้ ข้อ 1–10)
// + appendix with the class's learner analysis. Browser-side; the docx library is loaded only when needed.
import type { PlanContent } from '~/utils/lessonPlan'

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

export async function exportLessonPlansDocx(opts: { course: any; plans: PlanForExport[]; learners: any; filename: string }) {
  const d = await import('docx')
  const { AlignmentType, BorderStyle, Document, Header, ImageRun, Packer, PageBreak, PageNumber, Paragraph, PositionalTab, PositionalTabAlignment, PositionalTabLeader, PositionalTabRelativeTo, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } = d

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
  const headerTable = (pl: PlanForExport) => {
    const [cL, cM, cR] = [1300, 5554, 2500]
    return new Table({
      width: { size: W, type: WidthType.DXA },
      columnWidths: [cL, cM, cR],
      rows: [
        new TableRow({
          children: [
            cell([p([new ImageRun({ type: 'png', data: logo, transformation: { width: 70, height: 70 } })], { align: AlignmentType.CENTER })], cL, { rowSpan: 3, center: true }),
            cell([p([run('แผนการจัดการเรียนรู้', { bold: true, size: 18 })], { align: AlignmentType.CENTER })], cM, { center: true }),
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
          children: [cell([p([run('ชื่อเรื่อง/งาน '), run(pl.title || pl.unit_name, { bold: true })], { align: AlignmentType.LEFT })], cL + cM, { columnSpan: 2 })],
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

  const children: any[] = []
  opts.plans.forEach((pl, i) => {
    if (i > 0) children.push(p([new PageBreak()]))
    children.push(...planBody(pl))
  })
  children.push(...appendix())

  const doc = new Document({
    creator: 'ARCANA PROFILE',
    title: `แผนการจัดการเรียนรู้ ${course.code} ${course.name}`,
    styles: { default: { document: { run: { font: FONT, size: PT(16), sizeComplexScript: PT(16), language: { value: 'th-TH', bidirectional: 'th-TH' } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 851, right: 1134, bottom: 567, left: 1418, header: 709, footer: 709 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: PT(16), sizeComplexScript: PT(16) })] })] }) },
      children,
    }],
  })
  const blob = await markThaiRuns(await Packer.toBlob(doc))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = opts.filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
