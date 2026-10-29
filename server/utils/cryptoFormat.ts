import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
export function encryptWithKey(plain: string, key: Buffer) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')
}
export function decryptWithKey(blob: string, key: Buffer): string | null {
  try {
    const raw = Buffer.from(blob, 'base64')
    if (raw.length < 28) return null
    const cipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
    cipher.setAuthTag(raw.subarray(12, 28))
    return Buffer.concat([cipher.update(raw.subarray(28)), cipher.final()]).toString('utf8')
  } catch { return null }
}
export const keyHint = (key: string) => Buffer.byteLength(key) <= 8 ? '••••' : key.slice(0, 4) + '…' + key.slice(-4)
