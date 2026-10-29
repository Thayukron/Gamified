<script setup lang="ts">
// Reflex mini-game: tap glowing orbs before they fade. Reach the goal before time runs out.
const props = defineProps<{ title?: string; seconds?: number; goal?: number; color?: string }>()
const emit = defineEmits<{ done: [success: boolean] }>()
const audio = useGameAudio()

const total = props.seconds ?? 10
const goal = props.goal ?? 8
const color = props.color ?? '#f5c451'

interface Orb { id: number; x: number; y: number; size: number; popped: boolean }
const orbs = ref<Orb[]>([])
const bursts = ref<{ id: number; x: number; y: number }[]>([])
const phase = ref<'rules' | 'ready' | 'play' | 'end'>('rules')
const countdown = ref(3)
const left = ref(total)
const score = ref(0)
let nextId = 0
const timers: ReturnType<typeof setTimeout | typeof setInterval>[] = []

function spawn() {
  const orb = { id: nextId++, x: 8 + Math.random() * 80, y: 20 + Math.random() * 55, size: 52 + Math.random() * 22, popped: false }
  orbs.value.push(orb)
  timers.push(setTimeout(() => (orbs.value = orbs.value.filter((o) => o.id !== orb.id)), 1900))
}

function begin() {
  phase.value = 'ready'
  const cd = setInterval(() => {
    countdown.value--
    audio.note(countdown.value > 0 ? 660 : 990, 0.2)
    if (countdown.value <= 0) {
      clearInterval(cd)
      start()
    }
  }, 700)
  timers.push(cd)
}
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t as any)))

function start() {
  phase.value = 'play'
  spawn()
  spawn()
  // keep 3-4 targets on screen so there is always something to tap
  timers.push(setInterval(() => orbs.value.length < 4 && spawn(), 330))
  const tick = setInterval(() => {
    left.value = Math.max(0, +(left.value - 0.1).toFixed(1))
    if (left.value <= 0) {
      clearInterval(tick)
      finish()
    }
  }, 100)
  timers.push(tick)
}

function finish() {
  if (phase.value === 'end') return
  phase.value = 'end'
  timers.forEach((t) => clearInterval(t as any))
  orbs.value = []
  const win = score.value >= goal
  win ? audio.success() : audio.fail()
  setTimeout(() => emit('done', win), 1600)
}

function pop(o: Orb) {
  if (phase.value !== 'play' || o.popped) return
  o.popped = true
  score.value++
  audio.pop()
  bursts.value.push({ id: o.id, x: o.x, y: o.y })
  setTimeout(() => (bursts.value = bursts.value.filter((b) => b.id !== o.id)), 500)
  orbs.value = orbs.value.filter((x) => x.id !== o.id)
  // goal reached: finish right away instead of waiting for the clock
  if (score.value >= goal) setTimeout(finish, 300)
}
</script>

<template>
  <GameMiniGameRules
    v-if="phase === 'rules'"
    :title="title ?? 'เก็บเศษแสง'"
    icon="hand"
    :rules="['ลูกแสงจะโผล่ขึ้นทั่วจอแล้วค่อย ๆ จางหายไป', 'แตะลูกแสงให้เร็วที่สุดก่อนมันหาย (แตะโดน = +1)', `มีเวลา ${total} วินาที ดูแถบเวลาด้านบน`]"
    :goal="`เก็บให้ได้อย่างน้อย ${goal} ลูก`"
    @start="begin"
  />
  <div class="absolute inset-0 z-30 overflow-hidden bg-abyss-950/25">
    <!-- HUD -->
    <div class="absolute inset-x-0 top-14 z-10 flex flex-col items-center px-6">
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300">MINI GAME</p>
      <h2 class="title-glow text-xl sm:text-2xl">{{ title ?? 'เก็บเศษแสง' }}</h2>
      <p v-if="phase === 'play'" class="mt-1 rounded-full bg-abyss-950/80 px-3 py-0.5 text-sm text-slate-200">👆 แตะลูกแสงให้ได้ {{ goal }} ลูก!</p>
      <div class="mt-2 flex items-center gap-3 text-sm">
        <span class="rounded-full border border-rune-400/50 bg-abyss-950/80 px-3 py-1 font-display text-base text-rune-200">
          ✦ {{ score }} / {{ goal }}
        </span>
        <span class="rounded-full border border-white/15 bg-abyss-950/80 px-3 py-1 text-slate-300">⏱ {{ Math.ceil(left) }} วิ</span>
      </div>
      <div class="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full transition-all duration-100" :style="{ width: `${(left / total) * 100}%`, background: color }" />
      </div>
    </div>

    <!-- orbs -->
    <button
      v-for="o in orbs"
      :key="o.id"
      class="orb absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
      :style="{
        left: `${o.x}%`, top: `${o.y}%`, width: `${o.size}px`, height: `${o.size}px`,
        background: `radial-gradient(circle at 35% 35%, #fff, ${color} 45%, transparent 72%)`,
        boxShadow: `0 0 30px 6px ${color}88`,
      }"
      @pointerdown.prevent="pop(o)"
    />
    <span
      v-for="b in bursts"
      :key="'b' + b.id"
      class="burst pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-display text-lg font-bold"
      :style="{ left: `${b.x}%`, top: `${b.y}%`, color }"
    >+1</span>

    <!-- ready / end -->
    <div v-if="phase === 'ready'" class="absolute inset-0 flex flex-col items-center justify-center">
      <p class="text-slate-300">แตะแสงให้ได้ {{ goal }} ดวง ภายใน {{ total }} วินาที!</p>
      <p :key="countdown" class="title-glow mt-4 animate-fade-up text-7xl">{{ countdown > 0 ? countdown : 'GO!' }}</p>
    </div>
    <div v-if="phase === 'end'" class="absolute inset-0 flex flex-col items-center justify-center">
      <p class="title-glow animate-fade-up text-3xl">{{ score >= goal ? 'ยอดเยี่ยม!' : 'เกือบแล้ว!' }}</p>
      <p class="mt-2 text-slate-300">เก็บได้ {{ score }} ดวง</p>
    </div>
  </div>
</template>

<style scoped>
.orb {
  animation: orb-life 1.9s ease-in-out forwards;
  touch-action: manipulation;
}
@keyframes orb-life {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  15% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
  25%, 75% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -60%) scale(0.3); opacity: 0; }
}
/* "Reduce motion" (OS setting) would otherwise freeze orbs on their invisible last frame */
@media (prefers-reduced-motion: reduce) {
  .orb {
    animation: none !important;
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}
.burst {
  animation: burst 0.5s ease-out forwards;
}
@keyframes burst {
  to { transform: translate(-50%, -150%) scale(1.4); opacity: 0; }
}
</style>
