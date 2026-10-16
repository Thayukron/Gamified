// Course info form value (create/edit course pages) and conversion to/from the API shape.
export interface CourseFormValue {
  code: string
  name: string
  section: string
  department_id: number | null
  course_type: 'theory' | 'practice' | 'mixed'
  level: string
  topicsText: string
  // course content copied from the official curriculum — used by the lesson-plan book and the AI
  theory_hours: string
  practice_hours: string
  credits: string
  outcome: string
  objectives: string
  competencies: string
  description: string
  standards_ref: string
}

const CONTENT_KEYS = ['theory_hours', 'practice_hours', 'credits', 'outcome', 'objectives', 'competencies', 'description', 'standards_ref'] as const

export function emptyCourseForm(): CourseFormValue {
  return { code: '', name: '', section: '', department_id: null, course_type: 'mixed', level: '', topicsText: '', ...Object.fromEntries(CONTENT_KEYS.map((k) => [k, ''])) } as CourseFormValue
}

export function courseToForm(c: any): CourseFormValue {
  const topics: string[] = typeof c.topics === 'string' ? JSON.parse(c.topics || '[]') : c.topics ?? []
  return {
    code: c.code ?? '',
    name: c.name ?? '',
    section: c.section ?? '',
    department_id: c.department_id ? Number(c.department_id) : null,
    course_type: c.course_type ?? 'mixed',
    level: c.level ?? '',
    topicsText: topics.join('\n'),
    ...Object.fromEntries(CONTENT_KEYS.map((k) => [k, c[k] ?? ''])),
  } as CourseFormValue
}

export function formToBody(f: CourseFormValue) {
  const { topicsText, ...rest } = f
  return { ...rest, topics: topicsText.split(/[,\n]/).map((t) => t.trim()).filter(Boolean) }
}

