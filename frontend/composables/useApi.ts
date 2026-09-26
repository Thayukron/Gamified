import { useAuthStore } from '~/stores/auth'

/** $fetch wrapper that targets the PHP API and attaches the bearer token. */
export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return <T = any>(path: string, opts: Parameters<typeof $fetch>[1] = {}) =>
    $fetch<T>(path, {
      baseURL: config.public.apiBase,
      ...opts,
      headers: {
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
        ...(opts.headers as Record<string, string>),
      },
      onResponseError({ response }) {
        if (response.status === 401 && auth.token) {
          auth.clear()
          navigateTo('/login')
        }
      },
    })
}

export function apiErrorMessage(e: any): string {
  return e?.data?.error || e?.message || 'เกิดข้อผิดพลาด'
}
