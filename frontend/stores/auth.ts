import { defineStore } from 'pinia'

export type Role = 'student' | 'teacher' | 'admin'

export interface User {
  id: number
  username: string
  full_name: string
  role: Role
  department_id: number | null
  student_code: string | null
  must_change_password?: boolean
}

const TOKEN_KEY = 'gsp_token'

export const homeFor = (role: Role) => `/${role}`

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: (import.meta.client && localStorage.getItem(TOKEN_KEY)) || '',
    user: null as User | null,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
  },
  actions: {
    async login(username: string, password: string) {
      const res = await useApi()<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: { username, password },
      })
      this.token = res.token
      this.user = res.user
      localStorage.setItem(TOKEN_KEY, res.token)
      return res.user
    },
    async fetchMe() {
      const res = await useApi()<{ user: User }>('/auth/me')
      this.user = res.user
      return res.user
    },
    async logout() {
      try {
        await useApi()('/auth/logout', { method: 'POST' })
      } catch {}
      this.clear()
      await navigateTo('/login')
    },
    clear() {
      this.token = ''
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
    },
  },
})
