import type { GameStats, Rarity } from '../../shared/types/game'

export function rewards(stats: GameStats, itemCount: number) {
  return { xp: stats.choices * 10 + stats.wins * 30 + stats.fails * 15 + 100, coins: itemCount * 20 + 50 }
}
export function level(xp: number) {
  let level = 1, need = 100
  while (xp >= need) { xp -= need; level++; need = 100 + 50 * (level - 1) }
  return { level, xp_into_level: xp, xp_for_next: need }
}
export const questRarity = (stats: GameStats): Rarity => stats.wins > 0 && stats.fails === 0 ? 'epic' : 'rare'
export function coreRarity(completed: number, total: number): Rarity {
  return total > 0 && completed >= total ? 'legendary' : completed >= 2 ? 'epic' : 'rare'
}
