<script setup lang="ts">
import type { Choice } from '~/utils/game'

// Decision UI: list buttons, icon cards, or hotspots placed on the scene. Optional countdown.
const props = defineProps<{
  choices: Choice[]
  layout?: 'list' | 'cards' | 'hotspots'
  prompt: string
  speaker?: string
  speakerColor?: string
  timer?: number
  timeoutChoice?: number
}>()
const emit = defineEmits<{ choose: [index: number] }>()
const audio = useGameAudio()

const picked = ref<number | null>(null)
const remaining = ref(props.timer ?? 0)
let interval: ReturnType<typeof setInterval> | undefined

function choose(i: number) {
  if (picked.value !== null) return
  picked.value = i
  clearInterval(interval)
  setTimeout(() => emit('choose', i), 350)
}

const timedOut = ref(false)
onMounted(() => {
  if (!props.timer) return
  audio.rumble()
  interval = setInterval(() => {
    remaining.value = Math.max(0, +(remaining.value - 0.1).toFixed(1))
    if (remaining.value <= 3 && Number.isInteger(remaining.value) && remaining.value > 0) audio.note(1200, 0.12)
    if (remaining.value <= 0) {
      // Show which option was picked on the player's behalf before moving on.
      clearInterval(interval)
      timedOut.value = true
      const i = props.timeoutChoice ?? props.choices.length - 1
      audio.fail()
      setTimeout(() => choose(i), 1400)
    }
  }, 100)
})

// Always tell the player what kind of input is expected.
const hint = computed(() => {
  if (props.timer) return 'เลือก 1 ทางให้ทันเวลา · ไม่มีคำตอบผิด'
  if (props.layout === 'cards') return 'แตะการ์ดที่ใช่ตัวคุณที่สุด · ไม่มีคำตอบผิด'
  return 'เลือก 1 ทางที่ตรงกับใจคุณ · ไม่มีคำตอบผิด'
})
onBeforeUnmount(() => clearInterval(interval))

function onKey(e: KeyboardEvent) {
  if (/^[1-9]$/.test(e.key) && props.choices[Number(e.key) - 1]) choose(Number(e.key) - 1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const layout = computed(() => props.layout ?? 'list')
const pct = computed(() => (props.timer ? (remaining.value / props.timer) * 100 : 0))
</script>

<template>
  <!-- TIMED: urgent banner, full-width countdown and pulsing red edges -->
  <template v-if="timer">
    <div class="urgent-vignette pointer-events-none absolute inset-0 z-10" />
    <div class="absolute inset-x-0 top-16 z-30 flex flex-col items-center px-4">
      <div class="animate-fade-up rounded-2xl border-2 border-red-400/70 bg-red-950/85 px-5 py-2.5 text-center shadow-[0_0_30px_rgba(248,113,113,0.5)] backdrop-blur">
        <p class="font-display text-lg font-black tracking-wider text-red-200 sm:text-xl">⚡ เหตุด่วน!</p>
        <p class="text-sm text-red-100">{{ timedOut ? 'หมดเวลา! ระบบเลือกทางให้คุณแล้ว' : `เลือกให้ทันภายใน ${Math.ceil(remaining)} วินาที` }}</p>
      </div>
      <div class="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-white/10">
        <div class="h-full rounded-full transition-[width] duration-100" :class="remaining <= 3 ? 'bg-red-500' : 'bg-amber-400'" :style="{ width: `${pct}%` }" />
      </div>
    </div>
  </template>

  <!-- HOTSPOTS: tap objects in the scene -->
  <div v-if="layout === 'hotspots'" class="absolute inset-0 z-20">
    <div class="absolute inset-x-0 top-16 flex flex-col items-center gap-1 px-4">
      <div class="prompt animate-fade-up">
        <AppIcon name="hand" :size="16" class="text-rune-300" /> {{ prompt }}
      </div>
      <p class="animate-fade-up rounded-full bg-abyss-950/70 px-3 py-0.5 text-xs text-slate-300" style="animation-delay: 200ms">
        แตะวงแหวนที่กะพริบ 1 จุด · ไม่มีคำตอบผิด
      </p>
    </div>
    <button
      v-for="(c, i) in choices"
      :key="i"
      class="hotspot group"
      :class="{ 'is-picked': picked === i, 'opacity-30': picked !== null && picked !== i }"
      :style="{ left: `${Math.min(84, Math.max(16, c.x ?? 50))}%`, top: `${c.y ?? 50}%`, animationDelay: `${i * 120}ms` }"
      @click="choose(i)"
    >
      <span class="ring" />
      <span class="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-rune-300 bg-abyss-900/90 text-rune-200 shadow-glow-gold transition group-hover:scale-110 group-hover:bg-rune-400 group-hover:text-abyss-950 sm:h-16 sm:w-16">
        <AppIcon :name="c.icon ?? 'sparkle'" :size="26" />
      </span>
      <span class="mt-1.5 max-w-[7.5rem] rounded-2xl border text-center leading-tight border-rune-400/40 bg-abyss-950/85 px-2.5 py-0.5 text-xs text-slate-100 sm:text-sm">{{ c.text }}</span>
    </button>
  </div>

  <!-- LIST / CARDS -->
  <div v-else class="absolute inset-x-0 bottom-0 z-20 flex max-h-full flex-col justify-end bg-gradient-to-t from-abyss-950 via-abyss-950/85 to-transparent px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-24 sm:px-6 sm:pb-6">
    <div class="mx-auto w-full max-w-3xl">
      <!-- prompt header -->
      <div class="prompt-box animate-fade-up">
        <div v-if="speaker" class="nameplate" :style="{ background: speakerColor }">{{ speaker }}</div>
        <p class="pr-12 text-base leading-snug text-slate-50 sm:text-lg">{{ prompt }}</p>
        <p class="mt-1.5 flex items-center gap-1 text-xs text-rune-300/90">
          <AppIcon :name="timer ? 'clock' : 'hand'" :size="13" /> {{ hint }}
        </p>
        <div v-if="timer" class="absolute right-3 top-1/2 h-11 w-11 -translate-y-1/2">
          <svg viewBox="0 0 36 36" class="h-full w-full -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="3" />
            <circle
              cx="18" cy="18" r="15" fill="none" stroke-width="3" stroke-linecap="round"
              :stroke="remaining <= 3 ? '#f87171' : '#f5c451'"
              :stroke-dasharray="94.2" :stroke-dashoffset="94.2 * (1 - pct / 100)"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center font-display text-sm font-bold" :class="remaining <= 3 ? 'animate-pulse text-red-400' : 'text-rune-200'">
            {{ Math.ceil(remaining) }}
          </span>
        </div>
      </div>

      <!-- cards -->
      <div v-if="layout === 'cards'" class="mt-3 grid gap-2.5" :class="choices.length > 4 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'">
        <button
          v-for="(c, i) in choices"
          :key="i"
          class="choice-card group"
          :class="{ 'is-picked': picked === i, 'opacity-30': picked !== null && picked !== i }"
          :style="{ animationDelay: `${120 + i * 90}ms` }"
          @click="choose(i)"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-full border border-rune-400/60 bg-abyss-950 text-rune-300 transition duration-300 group-hover:rotate-12 group-hover:scale-110 group-hover:bg-rune-400 group-hover:text-abyss-950 sm:h-12 sm:w-12">
            <AppIcon :name="c.icon ?? 'sparkle'" :size="22" />
          </span>
          <span class="mt-2 text-sm font-medium leading-tight text-slate-50 sm:text-base">{{ c.text }}</span>
          <span v-if="c.desc" class="mt-0.5 text-[11px] leading-tight text-slate-400 sm:text-xs">{{ c.desc }}</span>
        </button>
      </div>

      <!-- list -->
      <div v-else class="mt-3 flex flex-col gap-2">
        <button
          v-for="(c, i) in choices"
          :key="i"
          class="choice-row group"
          :class="{ 'is-picked': picked === i, 'opacity-30': picked !== null && picked !== i }"
          :style="{ animationDelay: `${120 + i * 90}ms` }"
          @click="choose(i)"
        >
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rune-400/50 text-rune-300 transition group-hover:bg-rune-400 group-hover:text-abyss-950">
            <AppIcon v-if="c.icon" :name="c.icon" :size="16" />
            <span v-else class="font-display text-xs">{{ i + 1 }}</span>
          </span>
          <span class="text-left">{{ c.text }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prompt {
  @apply flex items-center gap-2 rounded-full border border-rune-400/50 bg-abyss-950/85 px-4 py-2 text-sm text-slate-100 shadow-glow-gold backdrop-blur-md;
}
.prompt-box {
  @apply relative rounded-2xl border border-rune-400/30 bg-abyss-900/90 px-5 pb-4 pt-5 shadow-[0_-10px_60px_-10px_rgba(124,58,237,0.45)] backdrop-blur-md;
}
.nameplate {
  @apply absolute -top-4 left-5 rounded-lg px-3 py-1 font-display text-sm font-bold text-abyss-950 shadow-glow-gold;
}
.choice-card {
  @apply flex animate-fade-up flex-col items-center rounded-2xl border border-arcane-400/40 bg-abyss-900/90 px-3 py-3 text-center shadow-lg backdrop-blur-md transition duration-300 sm:py-4;
}
.choice-card:hover {
  @apply -translate-y-1 border-rune-400/80 shadow-glow-gold;
}
.choice-row {
  @apply flex w-full animate-fade-up items-center gap-3 rounded-xl border border-arcane-400/40 bg-abyss-900/90 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur-md transition duration-300 sm:text-base;
}
.choice-row:hover {
  @apply -translate-y-0.5 border-rune-400/80 shadow-glow-gold;
}
.is-picked {
  @apply scale-105 border-rune-300 bg-rune-400/20 shadow-glow-gold;
}
.hotspot {
  @apply absolute flex -translate-x-1/2 -translate-y-1/2 animate-fade-up flex-col items-center;
}
.hotspot .ring {
  @apply absolute left-1/2 top-7 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rune-300 sm:top-8 sm:h-16 sm:w-16;
  animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
/* timed choices: red pulsing screen edges */
.urgent-vignette {
  box-shadow: inset 0 0 90px 10px rgba(239, 68, 68, 0.55);
  animation: urgent 1s ease-in-out infinite;
}
@keyframes urgent {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}
@keyframes ping {
  75%, 100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
}
</style>
