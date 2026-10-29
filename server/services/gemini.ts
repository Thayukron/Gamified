import type { SqlClient } from '../utils/db'
import type { StaffRecord } from '../../shared/types/staff'
import { ApiError } from '../utils/errors'
import { setTimeout as sleep } from 'node:timers/promises'
export interface GeminiOptions { baseUrl: string; timeoutSeconds: number; signal?: AbortSignal; retryDelayScale?: number }
export function rankModels(models: string[]) {
  const usable = models.filter(model => model.includes('flash') && !/(tts|image|audio|live|embedding|vision|preview|exp|thinking|aqa|learnlm|robotics|computer)/i.test(model))
  const version = (model: string) => Number(model.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  const sort = (list: string[]) => list.sort((a, b) => version(b) - version(a) || a.length - b.length)
  return [...sort(usable.filter(m => !m.includes('lite'))), ...sort(usable.filter(m => m.includes('lite')))]
}
export const pickDefault = (models: string[]) => rankModels(models)[0] ?? models[0] ?? null
export function explainGemini(status: number, message: string) {
  if (status === 400 && message.includes('API key')) return 'API Key ไม่ถูกต้อง — ตรวจสอบว่าคัดลอกมาครบ'
  if ([401, 403].includes(status)) return 'API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้ Gemini API'
  if (status === 429) return 'ใช้งาน Gemini เกินโควตาของ API Key นี้ — รอสักครู่แล้วลองใหม่ (ระบบยังใช้ไกด์แบบกฎได้ตามปกติ)'
  if (status === 404) return 'ไม่พบรุ่นโมเดลนี้ — กดทดสอบการเชื่อมต่อใหม่เพื่อเลือกรุ่นที่ใช้ได้'
  if ([500, 503].includes(status)) return 'ขณะนี้ Google Gemini มีผู้ใช้งานหนาแน่น (เซิร์ฟเวอร์ของ Google ไม่ว่าง) ระบบลองใหม่และลองรุ่นสำรองแล้วแต่ยังไม่สำเร็จ — กรุณารอ 1–2 นาทีแล้วกดใหม่ (ไกด์แบบกฎยังใช้ได้ตามปกติ)'
  return `Gemini ตอบกลับผิดพลาด (${status}): ${Array.from(message).slice(0, 200).join('')}`
}
export class GeminiClient {
  constructor(private apiKey: string, private db: SqlClient, private options: GeminiOptions) {}
  private async request(method: string, path: string, body?: StaffRecord, timeout = this.options.timeoutSeconds) {
    let response: Response
    try {
      const signal = this.options.signal ? AbortSignal.any([this.options.signal, AbortSignal.timeout(timeout * 1000)]) : AbortSignal.timeout(timeout * 1000)
      response = await fetch(this.options.baseUrl.replace(/\/$/, '') + path, { method, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey }, ...(body ? { body: JSON.stringify(body) } : {}), signal, redirect: 'error' })
    } catch (error) {
      if (this.options.signal?.aborted) throw new ApiError(504, 'งาน AI ใช้เวลาเกินกำหนด กรุณาลองใหม่')
      if (['TimeoutError', 'AbortError'].includes((error as Error).name)) throw new ApiError(504, 'Gemini รุ่นนี้ไม่ตอบสนองภายในเวลาที่กำหนด (เซิร์ฟเวอร์ของ Google ไม่ว่าง) — ระบบจะใช้รุ่นสำรองให้อัตโนมัติ กรุณากดใหม่อีกครั้ง')
      throw new ApiError(502, 'เซิร์ฟเวอร์ของระบบเชื่อมต่อ Google Gemini ไม่ได้ — เครือข่ายที่เครื่องเซิร์ฟเวอร์ใช้อยู่อาจบล็อก generativelanguage.googleapis.com (พบบ่อยในเครือข่ายสถานศึกษา) ไม่ใช่ปัญหาที่ API Key · ลองให้เครื่องเซิร์ฟเวอร์ใช้เครือข่ายอื่น หรือขอผู้ดูแลเครือข่ายเปิดโดเมนนี้')
    }
    let value: StaffRecord
    try { value = await response.json() } catch (error) {
      if (this.options.signal?.aborted || ['AbortError', 'TimeoutError'].includes((error as Error).name)) throw new ApiError(504, 'Gemini รุ่นนี้ไม่ตอบสนองภายในเวลาที่กำหนด (เซิร์ฟเวอร์ของ Google ไม่ว่าง) — ระบบจะใช้รุ่นสำรองให้อัตโนมัติ กรุณากดใหม่อีกครั้ง')
      throw new ApiError(502, 'Gemini ตอบกลับมาแต่อ่านไม่ได้ (รูปแบบคำตอบไม่ถูกต้อง) — ลองกดสร้างใหม่อีกครั้ง')
    }
    if (!response.ok) {
      const status = [400, 401, 403].includes(response.status) ? 422 : [429, 404].includes(response.status) ? response.status : 503
      throw new ApiError(status, explainGemini(response.status, String(value.error?.message ?? '').split(this.apiKey).join('[redacted]')))
    }
    return value
  }
  async listModels() {
    const models: string[] = [], seen = new Set<string>(); let token: string | undefined
    do {
      if (token && seen.has(token)) throw new ApiError(502, 'Gemini ส่งรายการรุ่นซ้ำ กรุณาลองใหม่')
      if (token) seen.add(token)
      const result = await this.request('GET', '/models?pageSize=200' + (token ? '&pageToken=' + encodeURIComponent(token) : ''))
      for (const model of result.models ?? []) if (model.supportedGenerationMethods?.includes('generateContent')) models.push(String(model.name).replace(/^models\//, ''))
      token = result.nextPageToken
    } while (token)
    return models
  }
  private async slowModels(): Promise<Record<string, number>> {
    try {
      const row = (await this.db.rows<{ setting_value: string }>("SELECT setting_value FROM settings WHERE setting_key='gemini_slow_models'"))[0]
      return Object.fromEntries(Object.entries(JSON.parse(row?.setting_value || '{}')).filter(([, until]) => Number(until) > Date.now() / 1000)) as Record<string, number>
    } catch { return {} }
  }
  private async markSlow(model: string) {
    try {
      const slow = { [model]: Math.floor(Date.now() / 1000) + 900, ...await this.slowModels() }
      await this.db.execute("INSERT INTO settings (setting_key,setting_value) VALUES ('gemini_slow_models',?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)", [JSON.stringify(slow)])
    } catch { /* best-effort cooldown */ }
  }
  async generateJson(model: string, system: string, prompt: string, maxTokens = 8192, search = false) {
    const body: StaffRecord = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: .7, maxOutputTokens: maxTokens } }
    if (search) { body.tools = [{ google_search: {} }]; delete body.generationConfig.responseMimeType; body.generationConfig.temperature = .2 }
    const result = await this.request('POST', '/models/' + encodeURIComponent(model) + ':generateContent', body)
    const candidate = result.candidates?.[0]
    let text = (candidate?.content?.parts ?? []).map((part: StaffRecord) => part.text ?? '').join('')
    if (!text) throw new ApiError(502, `Gemini ไม่ได้ส่งคำตอบกลับมา (${candidate?.finishReason ?? result.promptFeedback?.blockReason ?? 'ไม่ทราบสาเหตุ'})`)
    text = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')
    if (search && text.includes('{') && text.includes('}')) text = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
    let data: StaffRecord
    try { data = JSON.parse(text); if (!data || typeof data !== 'object') throw new Error() }
    catch { throw new ApiError(502, `Gemini ตอบกลับมาแต่อ่านไม่ได้ (${candidate?.finishReason === 'MAX_TOKENS' ? 'คำตอบยาวเกินกำหนด' : 'รูปแบบคำตอบไม่ถูกต้อง'}) — ลองกดสร้างใหม่อีกครั้ง`) }
    return { data, prompt_tokens: result.usageMetadata?.promptTokenCount ?? null, output_tokens: result.usageMetadata?.candidatesTokenCount ?? null, sources: (candidate?.groundingMetadata?.groundingChunks ?? []).filter((chunk: StaffRecord) => chunk.web?.uri).map((chunk: StaffRecord) => ({ title: String(chunk.web.title ?? ''), url: String(chunk.web.uri) })) }
  }
  async generateResilient(preferred: string | null, system: string, prompt: string, maxFallbacks = 2, maxTokens = 8192, search = false) {
    if (!preferred) preferred = pickDefault(await this.listModels())
    if (!preferred) throw new ApiError(422, 'API Key นี้ไม่มีโมเดลที่ใช้สร้างข้อความได้')
    let candidates = [preferred], loaded = false, lastError: ApiError | undefined
    const slow = await this.slowModels()
    if (slow[preferred]) {
      loaded = true
      const all = [preferred, ...rankModels(await this.listModels()).filter(m => m !== preferred)]
      candidates = [...all.filter(m => !slow[m]), ...all.filter(m => slow[m])]
    }
    for (let i = 0; i < candidates.length && i <= maxFallbacks + 2; i++) {
      const model = candidates[i]!
      let alive = true
      try { await this.request('POST', '/models/' + encodeURIComponent(model) + ':generateContent', { contents: [{ role: 'user', parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 1 } }, 12) }
      catch (error) { if (!(error instanceof ApiError)) throw error; alive = error.status !== 504 }
      if (!alive) {
        if (this.options.signal?.aborted) throw new ApiError(504, 'งาน AI ถูกหยุด กรุณาลองใหม่')
        await this.markSlow(model); lastError = new ApiError(504, 'Gemini รุ่นล่าสุดไม่ตอบสนองในขณะนี้ (เซิร์ฟเวอร์ของ Google ไม่ว่าง) — กรุณารอ 1–2 นาทีแล้วกดใหม่ (ไกด์แบบกฎยังใช้ได้ตามปกติ)')
        if (!loaded) { loaded = true; const currentSlow = await this.slowModels(); candidates = [preferred, ...rankModels(await this.listModels()).filter(m => m !== preferred && !currentSlow[m])] }
        continue
      }
      for (const [attempt, delay] of [0, 2, 5].entries()) {
        if (delay) {
          try { await sleep(delay * 1000 * (this.options.retryDelayScale ?? 1), undefined, { signal: this.options.signal }) }
          catch { throw new ApiError(504, 'งาน AI ถูกหยุด กรุณาลองใหม่') }
        }
        try { return { ...await this.generateJson(model, system, prompt, maxTokens, search), model } }
        catch (error) {
          if (!(error instanceof ApiError)) throw error
          if (this.options.signal?.aborted) throw error
          lastError = error
          const broken = error.status === 502 && error.message.includes('อ่านไม่ได้')
          if (broken && attempt === 0) continue
          if (error.status === 504) { await this.markSlow(model); break }
          if (broken) break
          if (![503, 429].includes(error.status) && !error.message.includes('ไม่พบรุ่น')) throw error
          if (error.status === 429 || error.message.includes('ไม่พบรุ่น')) break
        }
      }
      if (!loaded) { loaded = true; candidates = [preferred, ...rankModels(await this.listModels()).filter(m => m !== preferred)] }
    }
    throw lastError ?? new ApiError(503, 'Gemini ยังไม่พร้อมใช้งาน กรุณาลองใหม่')
  }
}
