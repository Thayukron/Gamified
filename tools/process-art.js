// Chroma-key the green-screen character sprites and compress backgrounds for the web.
// Usage: node process-art.js <srcDir> <publicDir>
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const [, , SRC, PUB] = process.argv
const toYCC = (r, g, b) => [-0.1687 * r - 0.3313 * g + 0.5 * b, 0.5 * r - 0.4187 * g - 0.0813 * b]

async function keyCharacter(file, out, { keepGreen = false } = {}) {
  const { data, info } = await sharp(file).resize({ height: 1254 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  // Key colour = median chroma of the top rows and the side columns of the upper half
  // (characters touch the bottom edge, so it is excluded).
  const samples = []
  for (let y = 0; y < h * 0.5; y++) for (let x = 0; x < w; x++) {
    if (x > 11 && x < w - 12 && y > 11) continue
    const i = (y * w + x) * 3
    samples.push(toYCC(data[i], data[i + 1], data[i + 2]))
  }
  const median = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)]
  const mean = [0, 1].map((k) => median(samples.map((v) => v[k])))
  const std = Math.sqrt(samples.reduce((s, v) => s + (v[0] - mean[0]) ** 2 + (v[1] - mean[1]) ** 2, 0) / samples.length)
  // robust spread: 90th percentile distance from the key
  const dists = samples.map((v) => Math.hypot(v[0] - mean[0], v[1] - mean[1])).sort((a, b) => a - b)
  const t0 = Math.min(40, Math.max(12, dists[Math.floor(dists.length * 0.9)] * 1.4))
  const t1 = t0 + 30

  const outBuf = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    let r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2]
    const [cb, cr] = toYCC(r, g, b)
    const d = Math.hypot(cb - mean[0], cr - mean[1])
    let a = d <= t0 ? 0 : d >= t1 ? 1 : (d - t0) / (t1 - t0)
    // Only green-dominant pixels may become transparent (protects dark/neutral details).
    if (g <= Math.max(r, b) + 8) a = 1
    // Saturated screen-green trapped inside the silhouette (e.g. gaps between hair strands).
    if (!keepGreen && g > 110 && g > r + 60 && g > b + 60) a = Math.min(a, Math.max(0, 1 - (g - Math.max(r, b) - 60) / 40))
    // Despill green fringe on semi-transparent edges.
    if (a < 1 && g > Math.max(r, b)) g = Math.round(Math.max(r, b) + (g - Math.max(r, b)) * 0.25)
    outBuf[p * 4] = r; outBuf[p * 4 + 1] = g; outBuf[p * 4 + 2] = b; outBuf[p * 4 + 3] = Math.round(a * 255)
  }
  // Edge band: pixels within 8px of transparency lose their green spill (hair highlights, glows).
  let near = new Uint8Array(w * h)
  for (let p = 0; p < w * h; p++) near[p] = outBuf[p * 4 + 3] < 128 ? 1 : 0
  for (let pass = 0; pass < (keepGreen ? 0 : 16); pass++) {
    const next = near.slice()
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (!near[p] && (near[p - 1] || near[p + 1] || near[p - w] || near[p + w])) next[p] = 1
    }
    near = next
  }
  for (let p = 0; p < w * h; p++) {
    if (!near[p] || keepGreen) continue
    const r = outBuf[p * 4], b = outBuf[p * 4 + 2], m = Math.max(r, b)
    if (outBuf[p * 4 + 1] > m + 4) outBuf[p * 4 + 1] = m + 4
  }
  await sharp(outBuf, { raw: { width: w, height: h, channels: 4 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(out)
  return { t0: Math.round(t0), std: Math.round(std) }
}

;(async () => {
  fs.mkdirSync(path.join(PUB, 'characters'), { recursive: true })
  fs.mkdirSync(path.join(PUB, 'backgrounds'), { recursive: true })
  for (const f of fs.readdirSync(path.join(SRC, 'characters')).filter((f) => /\.jpe?g$/i.test(f))) {
    const name = f.replace(/\.jpe?g$/i, '').replace('neural', 'neutral')
    const info = await keyCharacter(path.join(SRC, 'characters', f), path.join(PUB, 'characters', `${name}.webp`), { keepGreen: name.startsWith('golem') })
    console.log('char', name, JSON.stringify(info))
  }
  for (const f of fs.readdirSync(path.join(SRC, 'backgrounds')).filter((f) => /\.jpe?g$/i.test(f))) {
    const name = f.replace(/\.jpe?g$/i, '')
    await sharp(path.join(SRC, 'backgrounds', f)).resize({ width: 1920, height: 1080, fit: 'cover', position: 'centre' }).webp({ quality: 78 }).toFile(path.join(PUB, 'backgrounds', `${name}.webp`))
    console.log('bg', name)
  }
})()
