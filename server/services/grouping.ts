import type { DashboardStudent, StaffRecord } from '../../shared/types/staff'
import { array } from '../utils/staff'
import { phpInt } from './scenarioEngine'

export const ROLE_TITLE: Record<string, string> = { R: 'ผู้ลงมือสร้าง/ทดสอบ', I: 'ผู้วิเคราะห์ปัญหา', A: 'ผู้ออกแบบ/นำเสนอสร้างสรรค์', S: 'ผู้ประสานงาน/พี่เลี้ยงกลุ่ม', E: 'หัวหน้าทีม/ผู้นำเสนอ', C: 'ผู้วางแผน/ตรวจสอบคุณภาพ' }
const VARK_TH: Record<string, string> = { V: 'สายภาพ', A: 'สายฟัง', R: 'สายอ่าน-เขียน', K: 'สายลงมือทำ', M: 'หลายช่องทาง' }
export function member(student: DashboardStudent): StaffRecord {
  const p = student.profile, vark = p?.dominant_vark
  return { id: student.id, code: student.student_code, name: student.full_name, profiled: Boolean(p), riasec: p ? Array.from(p.dominant_riasec as string) : [], vark: vark ? vark.length === 1 ? vark : 'M' : null, mindset: p?.mindset_type ?? null, archetype: p ? { name: p.archetype_name, icon: p.icon, color: p.color } : null }
}

// MT19937 with PHP 8.2's inclusive bounded sampling, per-request state (never global).
// Reference: php-src/PHP-8.2/ext/random/{engine_mt19937.c,random.c}.
class Random {
  state = new Uint32Array(624); index = 624
  constructor(seed: number) {
    this.state[0] = seed >>> 0
    for (let i = 1; i < 624; i++) { const previous = this.state[i - 1]!; this.state[i] = (Math.imul(1812433253, previous ^ (previous >>> 30)) + i) >>> 0 }
  }
  next() {
    if (this.index >= 624) {
      for (let i = 0; i < 624; i++) {
        const value = (this.state[i]! & 0x80000000) | (this.state[(i + 1) % 624]! & 0x7fffffff)
        this.state[i] = this.state[(i + 397) % 624]! ^ (value >>> 1) ^ (value & 1 ? 0x9908b0df : 0)
      }
      this.index = 0
    }
    let value = this.state[this.index++]!
    value ^= value >>> 11; value ^= (value << 7) & 0x9d2c5680; value ^= (value << 15) & 0xefc60000; value ^= value >>> 18
    return value >>> 0
  }
  range(max: number) {
    const range = max + 1
    let value = this.next()
    if ((range & (range - 1)) === 0) return value & max
    const limit = 0xffffffff - (0xffffffff % range) - 1
    while (value > limit) value = this.next()
    return value % range
  }
  shuffle(values: StaffRecord[]) { for (let i = values.length - 1; i > 0; i--) { const j = this.range(i); [values[i], values[j]] = [values[j]!, values[i]!] } }
}
function describe(groups: StaffRecord[][], mode: string) {
  return groups.map((group, index) => {
    const taken = new Set<string>()
    const members = group.map(original => {
      const m: StaffRecord = { ...original, role: null as string | null }
      for (const letter of m.riasec) if (!taken.has(letter)) { taken.add(letter); m.role = ROLE_TITLE[letter]!; break }
      m.role ??= m.riasec.length ? ROLE_TITLE[m.riasec[0]]! : 'สมาชิก (ยังไม่มีข้อมูลโปรไฟล์)'
      return m
    })
    const profiled = members.filter(m => m.profiled), interests = [...new Set<string>(profiled.map(m => m.riasec[0]))].sort(), styles = [...new Set<string>(profiled.map(m => m.vark).filter(Boolean))], fixed = members.filter(m => m.mindset === 'fixed').length, notes: string[] = []
    if (mode === 'similar' && styles.length) notes.push('กลุ่ม' + VARK_TH[styles[0]!] + ' — ใช้วิธีซ่อมเสริมเดียวกันได้ทั้งกลุ่ม')
    else {
      if (interests.length >= 3) notes.push(`ความสนใจหลากหลาย ${interests.length} ด้าน — แบ่งบทบาทได้ครบ`)
      else if (profiled.length) notes.push('ความสนใจค่อนข้างคล้ายกัน — ครูควรช่วยแบ่งบทบาทให้ชัด')
      if (fixed >= 2) notes.push(`มีผู้เรียน Fixed Mindset ${fixed} คน — ติดตามกลุ่มนี้ใกล้ชิด`)
      else if (fixed === 1) notes.push('มีผู้เรียน Fixed Mindset 1 คน อยู่กับเพื่อนที่พร้อมช่วยเหลือ')
      if (profiled.length && !['R', 'I', 'A'].some(letter => interests.includes(letter))) notes.push('ไม่มีสายลงมือ/วิเคราะห์/ออกแบบ — มอบงานที่เน้นการประสานงานหรือนำเสนอ')
    }
    if (profiled.length < members.length) notes.push(`${members.length - profiled.length} คนยังไม่มีข้อมูลโปรไฟล์`)
    return { no: index + 1, members, interests, styles, fixed, notes }
  })
}
export function fromIds(students: DashboardStudent[], idGroups: unknown, mode: string) {
  const byId = new Map(students.map(student => [student.id, member(student)])), seen = new Set<number>(), groups: StaffRecord[][] = []
  for (const values of array(idGroups)) {
    const group: StaffRecord[] = []
    for (const value of array(values)) { const id = phpInt(value); if (byId.has(id) && !seen.has(id)) { group.push(byId.get(id)!); seen.add(id) } }
    if (group.length) groups.push(group)
  }
  return { groups: describe(groups, mode), unassigned: [...byId.values()].filter(m => !seen.has(m.id)) }
}
export function buildGroups(students: DashboardStudent[], size: number, mode: string, seed: number, includeUnprofiled: boolean) {
  size = Math.max(2, Math.min(8, size))
  const random = new Random(seed), members = students.map(member), profiled = members.filter(m => m.profiled), unprofiled = members.filter(m => !m.profiled)
  random.shuffle(profiled); random.shuffle(unprofiled)
  let groups: StaffRecord[][] = []
  if (mode === 'similar') {
    for (const style of ['K', 'V', 'A', 'R', 'M']) {
      const people = profiled.filter(m => (m.vark ?? 'M') === style), count = Math.max(1, Math.ceil(people.length / size))
      if (!people.length) continue
      const chunks: StaffRecord[][] = Array.from({ length: count }, () => [])
      people.forEach((m, i) => chunks[i % count]!.push(m)); groups.push(...chunks)
    }
    if (includeUnprofiled) for (let i = 0; i < unprofiled.length; i += size) groups.push(unprofiled.slice(i, i + size))
  } else {
    const k = Math.max(1, Math.ceil((profiled.length + (includeUnprofiled ? unprofiled.length : 0)) / size)), teams = Math.min(k, Math.max(1, profiled.length)), cap = Math.ceil(profiled.length / teams), fixed = profiled.filter(m => m.mindset === 'fixed'), fixedCap = Math.max(1, Math.ceil(fixed.length / teams))
    const score = (g: StaffRecord[]) => !g.length ? 0 : new Set(g.map(m => m.riasec[0])).size * 2 + new Set(g.flatMap(m => m.riasec)).size * .5 + new Set(g.map(m => m.vark)).size * 1.2 - Math.max(0, g.filter(m => m.mindset === 'fixed').length - fixedCap) * 20 - (g.every(m => m.mindset === 'fixed') ? 3 : 0)
    if (profiled.length) {
      groups = Array.from({ length: teams }, () => [])
      fixed.forEach((m, i) => groups[i % teams]!.push(m))
      const rest = profiled.filter(m => m.mindset !== 'fixed'), frequency: Record<string, number> = {}
      for (const m of rest) frequency[m.riasec[0]] = (frequency[m.riasec[0]] ?? 0) + 1
      rest.sort((a, b) => frequency[a.riasec[0]]! - frequency[b.riasec[0]]!)
      for (const m of rest) {
        let best = 0, bestGain = -Infinity
        groups.forEach((g, i) => { if (g.length < cap) { const gain = score([...g, m]) - score(g) - g.length * .01; if (gain > bestGain) { bestGain = gain; best = i } } })
        groups[best]!.push(m)
      }
      for (let pass = 0; pass < 4; pass++) {
        let improved = false
        for (let a = 0; a < teams; a++) {
          pairs: for (let b = a + 1; b < teams; b++) {
            for (let i = 0; i < groups[a]!.length; i++) for (let j = 0; j < groups[b]!.length; j++) {
              const before = score(groups[a]!) + score(groups[b]!), ga = [...groups[a]!], gb = [...groups[b]!]
              ;[ga[i], gb[j]] = [gb[j]!, ga[i]!]
              if (score(ga) + score(gb) > before + .001) { groups[a] = ga; groups[b] = gb; improved = true; continue pairs }
            }
          }
        }
        if (!improved) break
      }
      groups = groups.filter(g => g.length)
    }
    if (includeUnprofiled) {
      while (groups.length < k) groups.push([])
      for (const m of unprofiled) { groups.sort((a, b) => a.length - b.length); groups[0]!.push(m) }
      groups = groups.filter(g => g.length)
    }
  }
  return { groups: describe(groups, mode), unassigned: includeUnprofiled ? [] : unprofiled, settings: { size, mode, seed, include_unprofiled: includeUnprofiled } }
}
