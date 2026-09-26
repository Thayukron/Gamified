// Mirrors backend/src/Services/Progression.php — keep the numbers in sync.
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
}

export const DEFAULT_AVATAR: Avatar = { gender: 'f', hairStyle: 'bob', hair: '#1f2937', skin: '#f1c7a5', eyes: '#7c3aed', robe: '#4c1d95' }

export function avatarDef(a: Avatar | null | undefined, name = 'คุณ'): CharacterDef {
  const v = a ?? DEFAULT_AVATAR
  return { name, kind: 'mage', gender: v.gender, hairStyle: v.hairStyle, hair: v.hair, skin: v.skin, eyes: v.eyes, robe: v.robe, color: '#f5c451' }
}
