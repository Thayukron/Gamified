<script setup lang="ts">
import type { CastMember, CharacterDef, Expr } from '~/utils/game'

// Characters standing on stage. The speaker steps forward; others dim.
const props = defineProps<{
  cast: CastMember[]
  characters: Record<string, CharacterDef>
  speaker?: string
  exprs: Record<string, Expr>
  anim?: { id: string; name: string; key: number } | null
  /** normal: above dialogue box · raised: above choice cards · low: small at the bottom (hotspots) */
  variant?: 'normal' | 'raised' | 'low'
}>()

const box = computed(() => ({
  normal: 'bottom-[4.5rem] top-16 sm:bottom-24',
  raised: 'bottom-[44%] top-14',
  low: '-bottom-4 top-[66%]',
})[props.variant ?? 'normal'])
const members0 = computed(() => props.cast.filter((m) => props.characters[m.id]).length)
const size = computed(() => ({
  normal: ['h-[min(66vh,640px)] w-[min(86vw,420px)]', 'h-[min(62vh,600px)] w-[min(62vw,360px)]', 'h-[min(58vh,560px)] w-[min(46vw,320px)]'][Math.min(members0.value, 3) - 1] ?? '',
  raised: 'h-[min(40vh,380px)] w-[min(40vw,240px)]',
  low: 'h-[34vh] w-[min(36vw,210px)] opacity-80',
})[props.variant ?? 'normal'])

const posClass = { left: 'left-[22%]', center: 'left-1/2', right: 'left-[78%]' }
const members = computed(() => props.cast.filter((m) => props.characters[m.id]))
</script>

<template>
  <div class="pointer-events-none absolute inset-x-0 transition-all duration-500" :class="box">
    <TransitionGroup
      enter-active-class="transition duration-500 ease-out"
      enter-from-class="opacity-0 translate-y-8"
      leave-active-class="transition duration-300 absolute"
      leave-to-class="opacity-0"
    >
      <div
        v-for="m in members"
        :key="m.id"
        class="absolute bottom-0 -translate-x-1/2 transition-all duration-500"
        :class="[size, posClass[m.pos], speaker && speaker !== m.id ? 'z-0 scale-[0.92] brightness-50' : 'z-10']"
      >
        <div
          :key="anim?.id === m.id ? anim.key : 0"
          class="h-full w-full"
          :class="[
            anim?.id === m.id ? `anim-${anim.name}` : '',
            characters[m.id].kind === 'owl' ? 'animate-float' : 'idle',
          ]"
          :style="speaker === m.id ? { filter: `drop-shadow(0 0 18px ${characters[m.id].color ?? '#f5c451'}88)` } : {}"
        >
          <GameCharacterSprite class="fade-bottom" :def="characters[m.id]" :expr="exprs[m.id] ?? m.expr ?? 'neutral'" />
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.fade-bottom { -webkit-mask-image: linear-gradient(to bottom, #000 72%, transparent 97%); mask-image: linear-gradient(to bottom, #000 72%, transparent 97%); }
.idle { animation: breathe 3.2s ease-in-out infinite; transform-origin: bottom center; }
@keyframes breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.018); } }
.anim-bounce { animation: bounce 0.55s cubic-bezier(.3,.7,.4,1.4); transform-origin: bottom center; }
@keyframes bounce { 0% { transform: translateY(0) scale(1, 1); } 30% { transform: translateY(-28px) scale(.96, 1.05); } 60% { transform: translateY(0) scale(1.05, .95); } 100% { transform: translateY(0) scale(1); } }
.anim-shake { animation: jitter 0.45s linear; }
@keyframes jitter { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-9px) rotate(-2deg); } 40%, 80% { transform: translateX(9px) rotate(2deg); } }
</style>
