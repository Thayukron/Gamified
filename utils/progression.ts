// Mirrors server/services/progression.ts — keep the numbers in sync.
import type { CharacterDef } from '~/utils/game'

export const COINS_PER_ITEM = 20

/** Level L -> L+1 needs 100 + 50(L-1) XP. */
export function levelInfo(xp: number) {
  let level = 1
  let need = 100
  let rest = xp
  while (rest >= need) {
    rest -= need
    level++
    need = 100 + 50 * (level - 1)
  }
  return { level, into: rest, need, pct: Math.round((rest / need) * 100) }
}

export type Rarity = 'rare' | 'epic' | 'legendary'
export const RARITY: Record<Rarity, { label: string; th: string; color: string; glow: string }> = {
  rare: { label: 'RARE', th: 'หายาก', color: '#38bdf8', glow: 'rgba(56,189,248,.55)' },
  epic: { label: 'EPIC', th: 'มหากาพย์', color: '#c084fc', glow: 'rgba(192,132,252,.6)' },
  legendary: { label: 'LEGENDARY', th: 'ตำนาน', color: '#fbbf24', glow: 'rgba(251,191,36,.7)' },
}

export interface Avatar {
  gender: 'm' | 'f'
  hairStyle: 'long' | 'bob' | 'short'
  hair: string
  skin: string
  eyes: string
  robe: string
  /** Painted hero chosen from the gallery; overrides the SVG look when its artwork exists. */
  preset?: string
}

export const DEFAULT_AVATAR: Avatar = { gender: 'f', hairStyle: 'bob', hair: '#1f2937', skin: '#f1c7a5', eyes: '#7c3aed', robe: '#4c1d95' }

/** Painted heroes: one pose each, public/characters/{id}.webp (prompts in docs/design/art-prompts.md). */
export const HERO_PRESETS = [
  { id: 'hero-m1', gender: 'm', title: 'นักผจญภัยผู้กล้า' },
  { id: 'hero-m2', gender: 'm', title: 'นักเดินทางไร้พรมแดน' },
  { id: 'hero-m3', gender: 'm', title: 'นักปราชญ์รุ่นเยาว์' },
  { id: 'hero-f1', gender: 'f', title: 'นักดาบเวทผู้มุ่งมั่น' },
  { id: 'hero-f2', gender: 'f', title: 'นักประดิษฐ์ร่าเริง' },
  { id: 'hero-f3', gender: 'f', title: 'ผู้เยียวยาใจดี' },
] as const

export const heroImage = (id: string) => `/characters/${id}.webp`

export function avatarDef(a: Avatar | null | undefined, name = 'คุณ'): CharacterDef {
  const v = a ?? DEFAULT_AVATAR
  const base: CharacterDef = { name, kind: 'mage', gender: v.gender, hairStyle: v.hairStyle, hair: v.hair, skin: v.skin, eyes: v.eyes, robe: v.robe, color: '#f5c451' }
  return v.preset ? { ...base, image: heroImage(v.preset), fullBody: true } : base
}

/** Which hero presets actually have artwork deployed (checked once per session). */
let availableHeroes: Promise<string[]> | null = null
export function loadAvailableHeroes() {
  availableHeroes ??= Promise.all(
    HERO_PRESETS.map(
      (h) =>
        new Promise<string | null>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(h.id)
          img.onerror = () => resolve(null)
          img.src = heroImage(h.id)
        }),
    ),
  ).then((ids) => ids.filter((x): x is string => !!x))
  return availableHeroes
}