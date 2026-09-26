// Procedural game audio via Web Audio API — no asset files needed.
// BGM presets are synthesized pads with occasional chimes; a URL plays as a looping <audio>.

type Preset = { drone: number[]; chimes: number[]; wave: OscillatorType; pulse?: boolean }

const PRESETS: Record<string, Preset> = {
  mystery: { drone: [110, 164.81, 261.63], chimes: [440, 523.25, 659.25, 783.99, 880], wave: 'triangle' },
  wonder: { drone: [146.83, 220, 369.99], chimes: [587.33, 659.25, 739.99, 880, 987.77], wave: 'sine' },
  tension: { drone: [69.3, 98, 138.59], chimes: [277.18, 392, 554.37], wave: 'sawtooth', pulse: true },
}

const MUTE_KEY = 'gsp_muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let current: { key: string; stop: () => void } | null = null
const muted = ref(false)
try {
  muted.value = localStorage.getItem(MUTE_KEY) === '1'
} catch {}

function ensureCtx() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = muted.value ? 0 : 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function envTone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', at = 0) {
  const c = ensureCtx()
  const t = c.currentTime + at
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(master!)
  osc.start(t)
  osc.stop(t + dur + 0.05)
}

function startPreset(p: Preset) {
  const c = ensureCtx()
  const out = c.createGain()
  out.gain.setValueAtTime(0, c.currentTime)
  out.gain.linearRampToValueAtTime(0.06, c.currentTime + 2.5)
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 700
  filter.connect(out).connect(master!)

  const lfo = c.createOscillator()
  const lfoGain = c.createGain()
  lfo.frequency.value = p.pulse ? 1.6 : 0.08
  lfoGain.gain.value = p.pulse ? 250 : 350
  lfo.connect(lfoGain).connect(filter.frequency)
  lfo.start()

  const oscs = p.drone.flatMap((f) =>
    [-6, 6].map((detune) => {
      const o = c.createOscillator()
      o.type = p.wave
      o.frequency.value = f
      o.detune.value = detune
      o.connect(filter)
      o.start()
      return o
    }),
  )

  const timer = setInterval(() => {
    if (Math.random() < 0.55) {
      const f = p.chimes[Math.floor(Math.random() * p.chimes.length)]
      envTone(f, 2.5, 0.025, 'sine')
      envTone(f * 2, 1.5, 0.008, 'sine', 0.02)
    }
  }, 1800)

  return () => {
    clearInterval(timer)
    const t = c.currentTime
    out.gain.cancelScheduledValues(t)
    out.gain.setValueAtTime(out.gain.value, t)
    out.gain.linearRampToValueAtTime(0, t + 1.5)
    setTimeout(() => {
      oscs.forEach((o) => o.stop())
      lfo.stop()
      out.disconnect()
    }, 1600)
  }
}

function startUrl(url: string) {
  const el = new Audio(url)
  el.loop = true
  el.volume = muted.value ? 0 : 0.5
  el.play().catch(() => {})
  const stopWatch = watch(muted, (m) => (el.volume = m ? 0 : 0.5))
  return () => {
    stopWatch()
    el.pause()
  }
}

let lastTick = 0

export function useGameAudio() {
  return {
    muted,
    unlock: ensureCtx,
    toggleMute() {
      muted.value = !muted.value
      try {
        localStorage.setItem(MUTE_KEY, muted.value ? '1' : '0')
      } catch {}
      if (master && ctx) master.gain.setTargetAtTime(muted.value ? 0 : 1, ctx.currentTime, 0.1)
    },
    playBgm(key?: string | null) {
      if (!key || current?.key === key) return
      current?.stop()
      const isUrl = /^(https?:)?\//.test(key)
      if (!isUrl && !PRESETS[key]) return
      current = { key, stop: isUrl ? startUrl(key) : startPreset(PRESETS[key]) }
    },
    stopBgm() {
      current?.stop()
      current = null
    },
    tick() {
      const now = performance.now()
      if (now - lastTick < 45) return
      lastTick = now
      envTone(1400 + Math.random() * 300, 0.03, 0.015, 'square')
    },
    select() {
      envTone(659.25, 0.3, 0.08)
      envTone(987.77, 0.5, 0.06, 'sine', 0.08)
    },
    whoosh() {
      const c = ensureCtx()
      const len = c.sampleRate * 0.6
      const buf = c.createBuffer(1, len, c.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
      const src = c.createBufferSource()
      src.buffer = buf
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.Q.value = 2
      bp.frequency.setValueAtTime(300, c.currentTime)
      bp.frequency.exponentialRampToValueAtTime(3000, c.currentTime + 0.5)
      const g = c.createGain()
      g.gain.value = 0.12
      src.connect(bp).connect(g).connect(master!)
      src.start()
    },
    rumble() {
      envTone(55, 0.8, 0.2, 'sawtooth')
      envTone(41, 1, 0.15, 'square', 0.05)
    },
    reveal() {
      ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => envTone(f, 1.6, 0.06, 'sine', i * 0.12))
    },
  }
}
