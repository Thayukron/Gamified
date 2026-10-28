export type Role = 'student' | 'teacher' | 'admin'

export interface AuthUser {
  id: number
  username: string
  full_name: string
  role: Role
  department_id: number | null
  student_code: string | null
  must_change_password: boolean | number
}

export interface AccountProfile {
  id: number
  username: string
  full_name: string
  role: Role
  student_code: string | null
  class_group: string | null
  must_change_password: boolean
  created_at: string
  department_name: string | null
  can_edit_name: boolean
}
