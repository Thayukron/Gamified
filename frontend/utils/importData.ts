// Import template + parsing of xlsx/csv uploads (browser-side; exceljs is lazy-loaded).

export type ImportType = 'departments' | 'teachers' | 'students' | 'courses' | 'enrollments'

interface Col { key: string; label: string; required?: boolean; note: string; aliases?: string[] }

export const IMPORT_SPEC: Record<ImportType, { sheet: string; title: string; cols: Col[]; example: string[][] }> = {
  departments: {
    sheet: 'แผนกวิชา',
    title: 'แผนกวิชา',
    cols: [
      { key: 'code', label: 'รหัสแผนก', required: true, note: 'ภาษาอังกฤษ/ตัวเลข เช่น IT, ACC', aliases: ['code', 'department_code'] },
      { key: 'name', label: 'ชื่อแผนก', required: true, note: 'เช่น เทคโนโลยีสารสนเทศ', aliases: ['name', 'department_name'] },
    ],
    example: [['IT', 'เทคโนโลยีสารสนเทศ'], ['ACC', 'การบัญชี']],
  },
  teachers: {
    sheet: 'ครู',
    title: 'ครูผู้สอน',
    cols: [
      { key: 'username', label: 'ชื่อผู้ใช้', required: true, note: 'ใช้ล็อกอิน ภาษาอังกฤษ/ตัวเลข เช่น t.somchai', aliases: ['username', 'user'] },
      { key: 'full_name', label: 'ชื่อ-สกุล', required: true, note: 'เช่น ครูสมชาย ใจดี', aliases: ['full_name', 'ชื่อ - สกุล', 'ชื่อสกุล', 'name'] },
      { key: 'department_code', label: 'รหัสแผนก', note: 'ต้องมีในชีตแผนกวิชาหรือในระบบ', aliases: ['department_code', 'แผนก'] },
      { key: 'password', label: 'รหัสผ่าน', note: 'เว้นว่าง = ใช้ชื่อผู้ใช้เป็นรหัสผ่าน (อย่างน้อย 6 ตัว)', aliases: ['password'] },
    ],
    example: [['t.somchai', 'ครูสมชาย ใจดี', 'IT', '']],
  },
  students: {
    sheet: 'นักศึกษา',
    title: 'นักศึกษา',
    cols: [
      { key: 'student_code', label: 'รหัสนักศึกษา', required: true, note: 'ใช้ล็อกอิน เช่น 6901001', aliases: ['student_code', 'รหัสประจำตัว', 'รหัส', 'student_id'] },
      { key: 'full_name', label: 'ชื่อ-สกุล', required: true, note: 'เช่น นายกิตติ ใจดี', aliases: ['full_name', 'ชื่อ - สกุล', 'ชื่อสกุล', 'name'] },
      { key: 'department_code', label: 'รหัสแผนก', note: 'ต้องมีในชีตแผนกวิชาหรือในระบบ', aliases: ['department_code', 'แผนก'] },
      { key: 'class_group', label: 'กลุ่มเรียน', note: 'เช่น ปวส.1/1 — ครูใช้เพิ่มผู้เรียนเข้าวิชาทีละกลุ่ม', aliases: ['class_group', 'กลุ่ม', 'ห้อง', 'ชั้น/ห้อง'] },
      { key: 'password', label: 'รหัสผ่าน', note: 'เว้นว่าง = ใช้รหัสนักศึกษาเป็นรหัสผ่าน', aliases: ['password'] },
    ],
    example: [['6901001', 'นายกิตติ ใจดี', 'IT', 'ปวส.1/1', ''], ['6901002', 'นางสาวขวัญใจ รักเรียน', 'IT', 'ปวส.1/1', '']],
  },
  courses: {
    sheet: 'รายวิชา',
    title: 'รายวิชา/กลุ่มเรียน',
    cols: [
      { key: 'code', label: 'รหัสวิชา', required: true, note: 'เช่น 30204-2003', aliases: ['code', 'course_code'] },
      { key: 'name', label: 'ชื่อวิชา', required: true, note: '', aliases: ['name', 'course_name'] },
      { key: 'section', label: 'กลุ่มเรียน', note: 'เช่น ปวส.1/1 (เว้นว่าง = 1)', aliases: ['section', 'กลุ่ม', 'ห้อง'] },
      { key: 'semester', label: 'ภาคเรียน', note: '1, 2 หรือ 3 (เว้นว่าง = ภาคเรียนปัจจุบัน)', aliases: ['semester'] },
      { key: 'academic_year', label: 'ปีการศึกษา', note: 'พ.ศ. เช่น 2569 (เว้นว่าง = ปีปัจจุบัน)', aliases: ['academic_year', 'ปี'] },
      { key: 'department_code', label: 'รหัสแผนก', note: '', aliases: ['department_code', 'แผนก'] },
      { key: 'teacher_username', label: 'ชื่อผู้ใช้ครูผู้สอน', note: 'ต้องมีในชีตครูหรือในระบบ', aliases: ['teacher_username', 'ครูผู้สอน', 'teacher'] },
      { key: 'course_type', label: 'ประเภทวิชา', note: 'ทฤษฎี / ปฏิบัติ / ผสม', aliases: ['course_type', 'ประเภท'] },
      { key: 'level', label: 'ระดับชั้น', note: 'เช่น ปวส.1', aliases: ['level', 'ระดับ'] },
      { key: 'topics', label: 'หน่วยการเรียน', note: 'คั่นด้วยจุลภาค (,)', aliases: ['topics', 'หัวข้อ'] },
    ],
    example: [['30204-2003', 'โครงสร้างข้อมูลและอัลกอริทึม', 'ปวส.1/1', '1', '2569', 'IT', 't.somchai', 'ผสม', 'ปวส.1', 'อาร์เรย์, สแตก, คิว']],
  },
  enrollments: {
    sheet: 'การลงทะเบียน',
    title: 'การลงทะเบียนเรียน',
    cols: [
      { key: 'course_code', label: 'รหัสวิชา', required: true, note: '', aliases: ['course_code', 'code'] },
      { key: 'section', label: 'กลุ่มเรียน', note: 'ต้องตรงกับชีตรายวิชา (เว้นว่าง = 1)', aliases: ['section', 'กลุ่ม', 'ห้อง'] },
      { key: 'semester', label: 'ภาคเรียน', note: 'เว้นว่าง = ภาคเรียนปัจจุบัน', aliases: ['semester'] },
      { key: 'academic_year', label: 'ปีการศึกษา', note: 'เว้นว่าง = ปีปัจจุบัน', aliases: ['academic_year', 'ปี'] },
      { key: 'student_code', label: 'รหัสนักศึกษา', required: true, note: '', aliases: ['student_code', 'รหัสประจำตัว', 'student_id'] },
    ],
    example: [['30204-2003', 'ปวส.1/1', '1', '2569', '6901001'], ['30204-2003', 'ปวส.1/1', '1', '2569', '6901002']],
  },
}
export const IMPORT_ORDER: ImportType[] = ['departments', 'teachers', 'students', 'courses', 'enrollments']

const norm = (s: string) => s.toString().replace(/\s|\*|\(.*?\)/g, '').toLowerCase()

/** Map a header row to canonical keys for a type; returns column index -> key. */
function mapHeader(type: ImportType, header: string[]) {
  const map: Record<number, string> = {}
  header.forEach((h, i) => {
    const n = norm(h)
    const col = IMPORT_SPEC[type].cols.find((c) => norm(c.label) === n || c.aliases?.some((a) => norm(a) === n))
    if (col) map[i] = col.key
  })
  return map
}

/** Guess the type of a sheet from its name or header. */
function detectType(name: string, header: string[]): ImportType | null {
  const n = norm(name)
  for (const t of IMPORT_ORDER) if (norm(IMPORT_SPEC[t].sheet) === n || norm(t) === n) return t
  // header-based: pick the type whose required columns are all present
  let best: ImportType | null = null
  let bestHits = 0
  for (const t of IMPORT_ORDER) {
    const keys = Object.values(mapHeader(t, header))
    const required = IMPORT_SPEC[t].cols.filter((c) => c.required).map((c) => c.key)
    if (required.every((k) => keys.includes(k)) && keys.length > bestHits) {
      best = t
      bestHits = keys.length
    }
  }
  return best
}

/** Rows of a table as canonical objects + their spreadsheet row numbers.
 *  Skips blank rows, the template's hint row and untouched example rows. */
function toRows(type: ImportType, table: string[][]) {
  const [header, ...body] = table
  const map = mapHeader(type, header ?? [])
  const spec = IMPORT_SPEC[type]
  const notes = spec.cols.map((c) => c.note).join('|')
  const examples = new Set(spec.example.map((e) => e.join('|')))
  const rows: Record<string, string>[] = []
  const rowNos: number[] = []
  body.forEach((r, i) => {
    const cells = spec.cols.map((_, ci) => String(r[ci] ?? '').trim()).join('|')
    if (!r.some((c) => String(c ?? '').trim() !== '') || cells === notes || examples.has(cells)) return
    rows.push(Object.fromEntries(Object.entries(map).map(([ci, k]) => [k, String(r[Number(ci)] ?? '').trim()])))
    rowNos.push(i + 2)
  })
  return { rows, rowNos }
}

function cellText(v: any): string {
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((t: any) => t.text).join('')
    if ('text' in v) return String(v.text)
    if ('result' in v) return String(v.result ?? '')
    if (v instanceof Date) return v.toISOString().slice(0, 10)
  }
  return String(v)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

export interface ParsedFile {
  payload: Partial<Record<ImportType, Record<string, string>[]>>
  sheets: { name: string; type: ImportType | null; rows: number }[]
}

/** Parse an uploaded .xlsx or .csv. For CSV the type must be given (or is guessed from the header). */
export async function parseImportFile(file: File, csvType?: ImportType): Promise<ParsedFile> {
  const out: ParsedFile = { payload: {}, sheets: [] }
  const add = (name: string, table: string[][], forced?: ImportType) => {
    const type = forced ?? detectType(name, table[0] ?? [])
    const { rows, rowNos } = type ? toRows(type, table) : { rows: [], rowNos: [] }
    out.sheets.push({ name, type, rows: rows.length })
    if (type && rows.length) {
      // _row = real spreadsheet row, echoed back by the server in messages ("ซ้ำในไฟล์ (แถว N)")
      const multi = out.sheets.filter((s) => s.type === type).length > 1
      rows.forEach((r, i) => (r._row = multi ? `${name}!${rowNos[i]}` : String(rowNos[i])))
      out.payload[type] = [...(out.payload[type] ?? []), ...rows]
    }
  }
  if (/\.csv$/i.test(file.name)) {
    const text = (await file.text()).replace(/^﻿/, '')
    add(file.name, parseCsv(text), csvType)
    return out
  }
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  wb.eachSheet((ws: any) => {
    if (ws.name === 'คำอธิบาย') return
    const table: string[][] = []
    ws.eachRow({ includeEmpty: false }, (row: any, rowNumber: number) => {
      const vals: string[] = []
      row.eachCell({ includeEmpty: true }, (c: any, col: number) => (vals[col - 1] = cellText(c.value)))
      table[rowNumber - 1] = Array.from(vals, (v) => v ?? '') // keep real row numbers
    })
    add(ws.name, Array.from(table, (r) => r ?? []))
  })
  return out
}

/** Download the multi-sheet Excel template with instructions and examples. */
export async function downloadImportTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  const font = { name: 'TH SarabunPSK', size: 16 }

  const help = wb.addWorksheet('คำอธิบาย')
  ;[
    'แม่แบบนำเข้าข้อมูล — ARCANA PROFILE',
    '1. กรอกข้อมูลในแต่ละชีต (ลบแถวตัวอย่างสีเหลืองออกก่อน) ใช้เฉพาะชีตที่ต้องการก็ได้',
    '2. ลำดับการนำเข้า: แผนกวิชา → ครู → นักศึกษา → รายวิชา → การลงทะเบียน (ระบบจัดลำดับให้เอง)',
    '   ชีตรายวิชา/การลงทะเบียนไม่บังคับ — ครูสร้างรายวิชาและเลือกกลุ่มเรียนเองได้ (กรอก "กลุ่มเรียน" ของนักศึกษาไว้ ครูจะเพิ่มทั้งกลุ่มได้ในคลิกเดียว)',
    '3. ห้ามเปลี่ยนชื่อหัวคอลัมน์ · คอลัมน์ที่มี * ต้องกรอก',
    '4. ข้อมูลที่มีอยู่แล้วจะถูกอัปเดต (นำเข้าไฟล์เดิมซ้ำได้โดยไม่เกิดข้อมูลซ้ำ)',
    '5. รหัสผ่านที่เว้นว่าง: ครู = ชื่อผู้ใช้, นักศึกษา = รหัสนักศึกษา (แนะนำให้แจ้งผู้ใช้เปลี่ยนภายหลัง)',
    '6. ส่งออกจากระบบทะเบียนเป็น CSV ได้เช่นกัน — ตั้งชื่อหัวคอลัมน์ตามแม่แบบ',
  ].forEach((t, i) => (help.addRow([t]).font = { ...font, bold: i === 0, size: i === 0 ? 18 : 16 }))
  help.getColumn(1).width = 110

  for (const t of IMPORT_ORDER) {
    const spec = IMPORT_SPEC[t]
    const ws = wb.addWorksheet(spec.sheet)
    ws.addRow(spec.cols.map((c) => (c.required ? `${c.label}*` : c.label)))
    ws.addRow(spec.cols.map((c) => c.note))
    spec.example.forEach((r) => ws.addRow(r))
    ws.getRow(1).eachCell((c: any) => {
      c.font = { ...font, bold: true }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE7F5' } }
    })
    ws.getRow(2).eachCell((c: any) => (c.font = { ...font, size: 14, italic: true, color: { argb: 'FF666666' } }))
    for (let i = 3; i < 3 + spec.example.length; i++) {
      ws.getRow(i).eachCell({ includeEmpty: true }, (c: any) => {
        c.font = font
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF6D5' } }
      })
    }
    spec.cols.forEach((c, i) => (ws.getColumn(i + 1).width = Math.max(14, Math.min(40, c.note.length + 4, c.label.length + 10))))
    spec.cols.forEach((_, i) => (ws.getColumn(i + 1).numFmt = '@')) // keep leading zeros in codes
    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }
  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'แม่แบบนำเข้าข้อมูล-ARCANA.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
