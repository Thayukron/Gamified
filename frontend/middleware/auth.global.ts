import { homeFor, useAuthStore, type Role } from '~/stores/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    return auth.isLoggedIn && auth.user ? navigateTo(homeFor(auth.user.role)) : undefined
  }
  if (!auth.isLoggedIn) {
    return navigateTo('/login')
  }
  if (!auth.user) {
    try {
      await auth.fetchMe()
    } catch {
      auth.clear()
      return navigateTo('/login')
    }
  }

  const role = auth.user!.role
  // after a password reset (or first login with the default password) the user must set a new one first
  if (auth.user!.must_change_password && to.path !== '/account') {
    return navigateTo('/account')
  }
  if (to.path === '/') {
    return navigateTo(homeFor(role))
  }
  // Each role area (/student, /teacher, /admin) is restricted to its role.
  const area = to.path.split('/')[1] as Role
  if (['student', 'teacher', 'admin'].includes(area) && area !== role) {
    return navigateTo(homeFor(role))
  }
})
