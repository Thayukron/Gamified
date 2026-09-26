// Scenario content types shared by the player and its components.

export type Expr = 'neutral' | 'happy' | 'surprised' | 'sad' | 'determined'

export interface CharacterDef {
  name: string
  kind: 'mage' | 'owl' | 'golem'
  color?: string
  robe?: string
  hair?: string
  skin?: string
  eyes?: string
  hairStyle?: 'long' | 'bob' | 'short'
  gender?: 'm' | 'f'
  /** hood | hat | glasses | cat | beard | child */
  accessory?: string[]
  /** Optional artwork file(s) replacing the SVG, e.g. "/characters/mira.png" or one per expression. */
  image?: string
  images?: Partial<Record<Expr, string>>
}

export interface CastMember { id: string; pos: 'left' | 'center' | 'right'; expr?: Expr }

export type Line = string | { speaker?: string; text: string; expr?: Expr; anim?: 'bounce' | 'shake'; effect?: string }

export interface Reward { name: string; icon: string }

export interface Choice {
  text: string
  desc?: string
  icon?: string
  x?: number
  y?: number
  reply?: Line[]
  reward?: Reward
  next: string
}

export interface MiniGame {
  type: 'sequence' | 'orbs'
  title?: string
  length?: number
  speed?: number
  seconds?: number
  goal?: number
  color?: string
}

export interface Scene {
  background?: string
  bgm?: string
  effect?: 'fade' | 'shake' | 'flash'
  cast?: CastMember[]
  dialogue?: Line[]
  layout?: 'list' | 'cards' | 'hotspots'
  prompt?: string
  timer?: number
  timeout_choice?: number
  choices?: Choice[]
  minigame?: MiniGame
  fail_next?: string
  next?: string
  end?: boolean
}

export type LogEntry = { scene: string; choice: number } | { scene: string; outcome: 'success' | 'fail' }

export const ENERGY = { choice: 10, win: 30, fail: 15 }

/** Rebuild collected items and energy from a saved log (used when resuming). */
export function replayProgress(scenes: Record<string, Scene>, log: LogEntry[]) {
  const items: Reward[] = []
  let energy = 0
  for (const entry of log) {
    const scene = scenes[entry.scene]
    if ('choice' in entry) {
      energy += ENERGY.choice
      const reward = scene?.choices?.[entry.choice]?.reward
      if (reward) items.push(reward)
    } else {
      energy += entry.outcome === 'success' ? ENERGY.win : ENERGY.fail
    }
  }
  return { items, energy }
}
