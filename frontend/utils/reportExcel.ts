// Excel export of the course report (browser-side; exceljs is loaded only when needed).
import { RIASEC, VARK } from '~/utils/profile'

const FONT = { name: 'TH SarabunPSK', size: 16 }
const STATUS_TH: Record<string, string> = { complete: 'ครบทุกเควสต์', partial: 'เล่นบางส่วน', playing: 'กำลังเล่น', not_started: 'ยังไม่เริ่ม' }

export async function exportReportXlsx(r: any) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'ARCANA PROFILE'
  wb.created = new Date()

  const style = (ws: any, headerRow: number) => {
    ws.eachRow((row: any, i: number) => {
      row.eachCell((c: any) => {
        c.font = { ...FONT, bold: i <= headerRow && i === headerRow }
        c.alignment = { vertical: 'top', wrapText: true }
        if (i >= headerRow) c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        if (i === headerRow) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } }
      })
    })
    ws.views = [{ state: 'frozen', ySplit: headerRow }]
  }
  const title = (ws: any, lines: string[]) => {
    lines.forEach((t, i) => {
      const row = ws.addRow([t])
      row.font = { ...FONT, size: i === 0 ? 18 : 16, bold: i === 0 }
    })
    ws.addRow([])
  }
  const head = [
    `${r.course.code} ${r.course.name} · ${r.course.section}`,
    `${r.institution.name} · แผนกวิชา${r.course.department_name} · ภาคเรียน ${r.term.semester}/${r.term.academic_year} · ครูผู้สอน ${r.course.teacher_name}`,
  ]

  // 1) roster with full profile scores
  const ws1 = wb.addWorksheet('รายชื่อผู้เรียน')
  title(ws1, ['ข้อมูลโปรไฟล์ผู้เรียนรายบุคคล', ...head])
  ws1.addRow(['ที่', 'รหัส', 'ชื่อ-สกุล', 'สถานะ', 'เควสต์ที่เล่น', 'Archetype', 'ความหมาย', 'Holland', 'VARK หลัก', 'Mindset',
    'V', 'A', 'R', 'K', 'R (Realistic)', 'I (Investigative)', 'A (Artistic)', 'S (Social)', 'E (Enterprising)', 'C (Conventional)', 'Growth', 'Fixed'])
  r.students.forEach((s: any, i: number) => {
    const p = s.profile
    ws1.addRow([
      i + 1, s.student_code, s.full_name, STATUS_TH[s.status],
      p ? `${p.quests_completed}/${p.quests_total}` : '0',
      p?.archetype_name ?? '-', p?.archetype_title ?? '-', p?.dominant_riasec ?? '-', p?.dominant_vark ?? '-',
      p ? ({ growth: 'Growth', mixed: 'Mixed', fixed: 'Fixed' } as Record<string, string>)[p.mindset_type] : '-',
      ...(p ? [p.vark_v, p.vark_a, p.vark_r, p.vark_k, p.riasec_r, p.riasec_i, p.riasec_a, p.riasec_s, p.riasec_e, p.riasec_c, p.mindset_growth, p.mindset_fixed] : Array(12).fill('')),
    ])
  })
  ws1.columns = [5, 11, 24, 14, 11, 15, 22, 9, 10, 18, ...Array(12).fill(7)].map((width) => ({ width }))
  style(ws1, 5)

  // 2) class summary
  const ws2 = wb.addWorksheet('สรุประดับห้อง')
  title(ws2, ['สรุปผลการวิเคราะห์ระดับห้องเรียน', ...head])
  const n = r.summary.profiled || 1
  const pct = (x: number) => Math.round((x / n) * 1000) / 10
  ws2.addRow(['ด้าน', 'รายการ', 'จำนวน (คน)', 'ร้อยละ'])
  ;(['V', 'A', 'R', 'K'] as const).forEach((k) => ws2.addRow(['VARK', `${VARK[k].name} — ${VARK[k].th}`, r.distribution.vark[k], pct(r.distribution.vark[k])]))
  ws2.addRow(['VARK', 'Multimodal — หลายช่องทาง', r.distribution.vark.multi, pct(r.distribution.vark.multi)])
  ;(['R', 'I', 'A', 'S', 'E', 'C'] as const).forEach((k) => ws2.addRow(['RIASEC (ความสนใจหลัก)', `${RIASEC[k].name} — ${RIASEC[k].th}`, r.distribution.riasec[k], pct(r.distribution.riasec[k])]))
  ;(['growth', 'mixed', 'fixed'] as const).forEach((k) => ws2.addRow(['Mindset', { growth: 'Growth Mindset — แบบเติบโต', mixed: 'Mixed — ผสมผสาน', fixed: 'Fixed Mindset — แบบยึดติด' }[k], r.distribution.mindset[k], pct(r.distribution.mindset[k])]))
  r.distribution.archetype.forEach((a: any) => ws2.addRow(['Archetype', `${a.name} — ${a.title}`, a.count, pct(a.count)]))
  ws2.addRow([])
  ws2.addRow(['การเข้าร่วม', `มีโปรไฟล์ ${r.summary.profiled} จาก ${r.summary.enrolled} คน · ครบทุกเควสต์ ${r.summary.complete} คน · ยังไม่เล่น ${r.summary.not_started} คน`])
  ws2.columns = [{ width: 24 }, { width: 46 }, { width: 13 }, { width: 10 }]
  style(ws2, 5)

  // 3) saved grouping
  const ws3 = wb.addWorksheet('การจัดกลุ่ม')
  const modeTh = r.grouping?.mode === 'similar' ? 'สไตล์การเรียนเดียวกัน (ซ่อมเสริม)' : 'คละจุดแข็ง (งานกลุ่ม)'
  title(ws3, ['การจัดกลุ่มผู้เรียน', ...head, r.grouping ? `รูปแบบ: ${modeTh}` : 'ยังไม่ได้บันทึกการจัดกลุ่ม'])
  ws3.addRow(['กลุ่ม', 'รหัส', 'ชื่อ-สกุล', 'บทบาทที่แนะนำ', 'Holland', 'VARK', 'Mindset'])
  ;(r.grouping?.groups ?? []).forEach((g: any, gi: number) =>
    g.members.forEach((m: any) => ws3.addRow([gi + 1, m.code, m.name, m.role, m.riasec.join('') || '-', m.vark ?? '-', m.mindset ? ({ growth: 'Growth', mixed: 'Mixed', fixed: 'Fixed' } as Record<string, string>)[m.mindset] : '-'])),
  )
  ws3.columns = [{ width: 8 }, { width: 11 }, { width: 24 }, { width: 30 }, { width: 10 }, { width: 8 }, { width: 10 }]
  style(ws3, 6)

  const buf = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `รายงานผู้เรียน-${r.course.code}-${r.term.semester}-${r.term.academic_year}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
