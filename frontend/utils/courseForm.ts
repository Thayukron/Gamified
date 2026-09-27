// Course info form value (create/edit course pages) and conversion to/from the API shape.
export interface CourseFormValue {
  code: string
  name: string
  section: string
  department_id: number | null
  course_type: 'theory' | 'practice' | 'mixed'
  level: string
  topicsText: string
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
    topicsText: topics.join(', '),
  }
}

export function formToBody(f: CourseFormValue) {
  const { topicsText, ...rest } = f
  return { ...rest, topics: topicsText.split(/[,\n]/).map((t) => t.trim()).filter(Boolean) }
}
