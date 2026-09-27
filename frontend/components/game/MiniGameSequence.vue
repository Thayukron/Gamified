<script setup lang="ts">
// Memory mini-game: watch runes light up in order, then repeat the sequence.
const props = defineProps<{ title?: string; length?: number; speed?: number }>()
const emit = defineEmits<{ done: [success: boolean] }>()
const audio = useGameAudio()

const RUNES = [
  { glyph: 'ᚠ', color: '#f87171', freq: 392 },
  { glyph: 'ᚱ', color: '#fbbf24', freq: 440 },
  { glyph: 'ᚲ', color: '#4ade80', freq: 523.25 },
  { glyph: 'ᛉ', color: '#38bdf8', freq: 587.33 },
  { glyph: 'ᛟ', color: '#a78bfa', freq: 659.25 },
  { glyph: 'ᛞ', color: '#f472b6', freq: 783.99 },
]

const len = props.length ?? 4
const speed = props.speed ?? 600
const sequence = Array.from({ length: len }, () => Math.floor(Math.random() * RUNES.length))
const phase = ref<'rules' | 'intro' | 'show' | 'input' | 'win' | 'lose'>('rules')
const lit = ref<number | null>(null)
const wrong = ref<number | null>(null)
const progress = ref(0)
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, ms))

function flash(i: number, ms = speed * 0.7) {
  lit.value = i
  audio.note(RUNES[i].freq)
  later(() => (lit.value = null), ms)
}

function begin() {
  phase.value = 'intro'
  later(() => {
    phase.value = 'show'
    sequence.forEach((r, k) => later(() => flash(r), 500 + k * speed))
    later(() => (phase.value = 'input'), 500 + len * speed)
  }, 1200)
}
onBeforeUnmount(() => timers.forEach(clearTimeout))

function tap(i: number) {
  if (phase.value !== 'input') return
  flash(i, 250)
  if (sequence[progress.value] !== i) {
    wrong.value = i
    phase.value = 'lose'
    audio.fail()
    later(() => emit('done', false), 1600)
    return
  }
  progress.value++
  if (progress.value === len) {
    phase.value = 'win'
    audio.success()
    later(() => emit('done', true), 1500)
  }
}

const status = computed(() => ({
  rules: '',
  intro: 'เตรียมตัว... รูนกำลังจะสว่าง',
  show: `👀 จำลำดับให้ดี! (${len} ครั้ง)`,
  input: `👆 ถึงตาเจ้าแล้ว! แตะรูนตามลำดับเดิม (${progress.value}/${len})`,
  win: 'สำเร็จ! ผนึกคลายออกแล้ว',
  lose: 'ผิดลำดับ! รูนดับวูบ...',
})[phase.value])
</script>

<template>
  <GameMiniGameRules
    v-if="phase === 'rules'"
    :title="title ?? 'ผนึกรูน'"
    icon="eye"
    :rules="['ดูรูนทั้ง 6 ช่อง จะมีรูนสว่างขึ้นทีละช่องพร้อมเสียง', `จำลำดับให้ได้ทั้งหมด ${len} ครั้ง`, 'เมื่อขึ้นว่า “ถึงตาเจ้าแล้ว” ให้แตะรูนตามลำดับเดิม']"
    :goal="`แตะถูกครบทั้ง ${len} ครั้งติดกันเพื่อคลายผนึก`"
    @start="begin"
  />
  <div class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-abyss-950/75 px-6 backdrop-blur-sm" :class="{ 'animate-shake': phase === 'lose' }">
    <p class="font-display text-xs tracking-[0.4em] text-arcane-300">MINI GAME</p>
    <h2 class="title-glow mt-1 text-center text-2xl">{{ title ?? 'ผนึกรูน' }}</h2>
    <p class="mt-2 min-h-[1.5rem] px-2 text-center text-sm" :class="phase === 'lose' ? 'text-red-300' : phase === 'win' ? 'text-emerald-300' : 'text-slate-300'">{{ status }}</p>

    <div class="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
      <button
        v-for="(r, i) in RUNES"
        :key="i"
        class="rune"
        :class="{ 'cursor-default': phase !== 'input' }"
        :style="{
          borderColor: r.color,
          color: r.color,
          background: lit === i ? r.color : 'rgba(11,7,24,.85)',
          boxShadow: lit === i ? `0 0 40px ${r.color}` : wrong === i ? '0 0 30px #ef4444' : `0 0 12px ${r.color}44`,
          transform: lit === i ? 'scale(1.1)' : 'scale(1)',
        }"
        @click="tap(i)"
      >
        <span :class="lit === i ? 'text-abyss-950' : ''">{{ r.glyph }}</span>
      </button>
    </div>

    <div class="mt-6 flex gap-1.5">
      <span v-for="k in len" :key="k" class="h-2 w-6 rounded-full transition" :class="k <= progress ? 'bg-rune-400 shadow-glow-gold' : 'bg-white/10'" />
    </div>
  </div>
</template>

<style scoped>
.rune {
  @apply flex h-20 w-20 items-center justify-center rounded-2xl border-2 text-4xl font-bold transition duration-150 sm:h-24 sm:w-24;
}
</style>
