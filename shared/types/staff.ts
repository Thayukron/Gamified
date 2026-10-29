// Database/JSON records retain the existing PHP response shape during migration.
export type StaffRecord = Record<string, any>
export interface Course extends StaffRecord {
  id: number; code: string; name: string; section: string
  teacher_id: number | null; department_id: number | null
  semester: number; academic_year: number; topics: string | null
}
export interface DashboardStudent extends StaffRecord {
  id: number; student_code: string | null; full_name: string
  status: string; profile: StaffRecord | null
}
