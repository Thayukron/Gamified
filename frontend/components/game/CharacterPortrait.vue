<script setup lang="ts">
import type { CharacterDef, Expr } from '~/utils/game'

// Head-and-shoulders crop of a character sprite, for dialogue boxes and HUD avatars.
const props = defineProps<{ def: CharacterDef; expr?: Expr }>()

// Sprite box size + offset (as fractions of the square frame) that centre each kind's face.
const crop = computed(() => {
  if (props.def.fullBody) return { w: 3.6, h: 6.45, l: -1.3, t: -0.2 }
  if (props.def.image || props.def.images) return { w: 2.0, h: 3.53, l: -0.5, t: -0.35 }
  return {
    mage: { w: 2.3, h: 4.06, l: -0.65, t: -0.95 },
    owl: { w: 1.6, h: 2.83, l: -0.3, t: -0.98 },
    golem: { w: 2.0, h: 3.53, l: -0.5, t: -0.72 },
  }[props.def.kind]
})
</script>

<template>
  <div class="relative aspect-square overflow-hidden">
    <div class="absolute" :style="{ width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, left: `${crop.l * 100}%`, top: `${crop.t * 100}%` }">
      <GameCharacterSprite :def="def" :expr="expr" />
    </div>
  </div>
</template>
