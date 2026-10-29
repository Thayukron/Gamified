import { useAuthStore } from '~/stores/auth'
import { apiBaseFor } from '~/shared/utils/apiRouting'

/** Shared bearer token; route migrated APIs to Nitro during the incremental cutover. */
export function useApi() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  return <T = any>(path: string, opts: Parameters<typeof $fetch>[1] = {}) =>
    $fetch<T>(path, {
      baseURL: apiBaseFor(path, config.public.apiBase),
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

/**
 * For long AI calls: the server answers at once with a job id and keeps working (see server/services/backgroundJob.ts),
 * then we poll until the result is ready — so a 60–160 s Gemini call survives Cloudflare Tunnel's 100 s limit.
 * Resolves with the same response the direct call would give; errors keep the server's message.
 */
export function useAiApi() {
  const api = useApi()
  return async <T = any>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> => {
    const first = await api<any>(path, { ...opts, headers: { ...(opts.headers as Record<string, string>), 'X-Async-Job': '1' } })
    if (!first?.job_id) return first as T // route not run in the background: plain response
    const deadline = Date.now() + 8 * 60 * 1000
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2500))
      let job: any
      try {
        job = await api<any>(`/jobs/${first.job_id}`)
      } catch (e: any) {
        if (e?.response?.status === 404) throw e
        continue // a dropped poll (network blip) is retried
      }
      if (job.status === 'done') return job.result as T
      if (job.status === 'error') throw Object.assign(new Error(job.result?.error ?? 'เกิดข้อผิดพลาด'), { data: job.result, status: job.http_status })
    }
    throw Object.assign(new Error('timeout'), { data: { error: 'AI ใช้เวลานานผิดปกติ — กรุณาลองใหม่อีกครั้ง' } })
  }
}

export function apiErrorMessage(e: any): string {
  return e?.data?.error || e?.message || 'เกิดข้อผิดพลาด'
}