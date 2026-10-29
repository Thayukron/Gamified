export interface Reward { name: string; icon?: string; [key: string]: unknown }
export interface ScoredChoice {
  next?: string | null
  tags?: Record<string, unknown>
  reward?: Reward
  [key: string]: unknown
}
export interface ScoredScene {
  choices?: ScoredChoice[]
  minigame?: unknown
  next?: string | null
  fail_next?: string | null
  end?: boolean
  [key: string]: unknown
}
export interface ScenarioContent {
  start?: string
  scenes: Record<string, ScoredScene>
  [key: string]: unknown
}
export interface GameStats { choices: number; wins: number; fails: number }
export type Rarity = 'rare' | 'epic' | 'legendary'
export interface Avatar {
  gender: 'm' | 'f'
  hairStyle: 'long' | 'bob' | 'short'
  hair: string; skin: string; eyes: string; robe: string
  preset?: string
}
