<script setup lang="ts">
definePageMeta({ layout: false })

type Line = string | { speaker?: string; text: string; effect?: string }
interface Scene {
  background?: string
  bgm?: string
  effect?: 'fade' | 'shake' | 'flash'
  dialogue?: Line[]
  choices?: { text: string; next: string }[]
  next?: string
  end?: boolean
}
interface LogEntry { scene: string; choice: number }

const route = useRoute()
const api = useApi()
const audio = useGameAudio()
const questId = Number(route.params.id)

const loading = ref(true)
const error = ref('')
const title = ref('')
const description = ref('')
const scenes = ref<Record<string, Scene>>({})
const startScene = ref('')
const resumeFrom = ref<string | null>(null)

const started = ref(false)
const sceneId = ref('')
const lineIndex = ref(0)
const log = ref<LogEntry[]>([])
const typed = ref('')
const typing = ref(false)
const showChoices = ref(false)
const shaking = ref(false)
const flashing = ref(false)
const fading = ref(false)
const finishing = ref(false)
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')

const scene = computed(() => scenes.value[sceneId.value])
const background = ref('night')
const line = computed(() => {
  const l = scene.value?.dialogue?.[lineIndex.value]
  if (!l) return { speaker: '', text: '' }
  return typeof l === 'string' ? { speaker: '', text: l } : { speaker: l.speaker ?? '', text: l.text, effect: l.effect }
})
const isLastLine = computed(() => lineIndex.value >= (scene.value?.dialogue?.length ?? 1) - 1)
const totalDecisions = computed(() => Object.values(scenes.value).filter((s) => s.choices?.length).length)

// --- load -----------------------------------------------------------------
onMounted(async () => {
  try {
    const res = await api(`/student/quests/${questId}`)
    if (res.completed) {
      return navigateTo(`/student/result/${res.result_id}`, { replace: true })
    }
    title.value = res.scenario.title
    description.value = res.scenario.description
    scenes.value = res.scenario.content.scenes
    startScene.value = res.scenario.content.start
    if (res.session) {
      resumeFrom.value = res.session.current_scene
      log.value = res.session.choices_log
    }
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => {
  audio.stopBgm()
  clearInterval(typeTimer)
})

// --- typewriter -------------------------------------------------------------
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null
let typeTimer: ReturnType<typeof setInterval> | undefined

function typeLine() {
  clearInterval(typeTimer)
  const text = line.value.text
  const chars = segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text)
  let i = 0
  typed.value = ''
  typing.value = true
  if (line.value.effect) runEffect(line.value.effect)
  typeTimer = setInterval(() => {
    typed.value += chars[i++] ?? ''
    if (chars[i - 1]?.trim()) audio.tick()
    if (i >= chars.length) finishTyping()
  }, 32)
}

function finishTyping() {
  clearInterval(typeTimer)
  typed.value = line.value.text
  typing.value = false
  if (isLastLine.value && scene.value?.choices?.length) {
    showChoices.value = true
  }
}

// --- effects ----------------------------------------------------------------
function runEffect(effect?: string) {
  if (effect === 'shake') {
    shaking.value = false
    requestAnimationFrame(() => (shaking.value = true))
    setTimeout(() => (shaking.value = false), 600)
    audio.rumble()
  } else if (effect === 'flash') {
    flashing.value = true
    setTimeout(() => (flashing.value = false), 700)
    audio.reveal()
  }
}

// --- flow -------------------------------------------------------------------
async function enterScene(id: string, transition = true) {
  if (transition) {
    fading.value = true
    audio.whoosh()
    await new Promise((r) => setTimeout(r, 450))
  }
  sceneId.value = id
  lineIndex.value = 0
  showChoices.value = false
  const s = scenes.value[id]
  if (s.background) background.value = s.background
  audio.playBgm(s.bgm)
  fading.value = false
  runEffect(s.effect)
  typeLine()
}

function start() {
  audio.unlock()
  started.value = true
  // Restore the most recent background/bgm along the saved path.
  const target = resumeFrom.value || startScene.value
  const bgmKey = Object.values(scenes.value).find((s) => s.bgm)?.bgm
  audio.playBgm(scenes.value[target]?.bgm ?? bgmKey)
  enterScene(target, false)
}

function advance() {
  if (!started.value || finishing.value || fading.value) return
  if (typing.value) return finishTyping()
  if (showChoices.value) return
  if (!isLastLine.value) {
    lineIndex.value++
    return typeLine()
  }
  if (scene.value.end) return finish()
  if (scene.value.next) {
    save(scene.value.next)
    enterScene(scene.value.next)
  }
}

function choose(index: number) {
  const choice = scene.value.choices![index]
  audio.select()
  log.value.push({ scene: sceneId.value, choice: index })
  showChoices.value = false
  save(choice.next)
  enterScene(choice.next)
}

async function save(nextScene: string) {
  saveState.value = 'saving'
  try {
    await api(`/student/quests/${questId}/progress`, {
      method: 'PUT',
      body: { current_scene: nextScene, choices_log: log.value },
    })
    saveState.value = 'saved'
    setTimeout(() => saveState.value === 'saved' && (saveState.value = 'idle'), 1500)
  } catch {
    saveState.value = 'error'
  }
}

async function finish() {
  finishing.value = true
  try {
    const [res] = await Promise.all([
      api(`/student/quests/${questId}/complete`, { method: 'POST', body: { choices_log: log.value } }),
      new Promise((r) => setTimeout(r, 900)),
    ])
    audio.stopBgm()
    await navigateTo(`/student/result/${res.result_id}?reveal=1`, { replace: true })
  } catch (e) {
    finishing.value = false
    error.value = apiErrorMessage(e)
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    advance()
  } else if (showChoices.value && /^[1-9]$/.test(e.key)) {
    const i = Number(e.key) - 1
    if (scene.value.choices?.[i]) choose(i)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="fixed inset-0 select-none overflow-hidden bg-abyss-950 text-slate-100" :class="{ 'animate-shake': shaking }">
    <GameVnBackground :name="started ? background : 'night'" />

    <!-- title screen -->
    <div v-if="!started" class="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
      <MysticBackground />
      <div v-if="loading" class="text-arcane-300">กำลังเปิดคัมภีร์...</div>
      <div v-else-if="error" class="card max-w-sm">
        <p class="text-red-300">{{ error }}</p>
        <NuxtLink to="/student" class="btn-ghost mt-4">กลับหน้าหลัก</NuxtLink>
      </div>
      <template v-else>
        <div class="w-48 animate-fade-up sm:w-56">
          <MagicCircle>
            <div class="flex h-14 w-14 animate-float items-center justify-center rounded-full border border-rune-300/60 bg-abyss-900/80 text-rune-200 shadow-glow-gold">
              <AppIcon name="map" :size="26" />
            </div>
          </MagicCircle>
        </div>
        <p class="mt-6 animate-fade-up font-display text-xs tracking-[0.5em] text-arcane-300/80" style="animation-delay: 150ms">QUEST</p>
        <h1 class="title-glow mt-2 animate-fade-up text-3xl" style="animation-delay: 250ms">{{ title }}</h1>
        <p class="mt-3 max-w-sm animate-fade-up text-sm leading-relaxed text-slate-400" style="animation-delay: 350ms">{{ description }}</p>
        <div class="mt-8 flex animate-fade-up flex-col items-center gap-3" style="animation-delay: 500ms">
          <button class="btn-primary !px-8 !py-3 text-base font-semibold" @click="start">
            <AppIcon name="play" :size="18" />
            {{ resumeFrom ? 'เดินทางต่อจากจุดที่บันทึกไว้' : 'เริ่มการเดินทาง' }}
          </button>
          <p class="text-xs text-slate-500">
            <AppIcon name="volume" :size="12" class="inline" /> เกมนี้มีเสียงประกอบ · แตะหน้าจอเพื่ออ่านต่อ
          </p>
          <NuxtLink to="/student" class="text-sm text-slate-500 hover:text-slate-300">ย้อนกลับ</NuxtLink>
        </div>
      </template>
    </div>

    <!-- game stage -->
    <template v-else>
      <!-- top bar -->
      <div class="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-abyss-950/90 to-transparent px-3 pb-6 pt-3">
        <NuxtLink to="/student" class="btn-ghost !border-transparent !px-2 !py-1.5 text-xs" title="พักการเดินทาง (บันทึกอัตโนมัติ)">
          <AppIcon name="back" :size="18" /> พัก
        </NuxtLink>
        <div class="min-w-0 flex-1 text-center">
          <div class="truncate font-display text-xs tracking-widest text-rune-300/90">{{ title }}</div>
          <div class="mx-auto mt-1.5 h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div class="h-full bg-gradient-to-r from-arcane-500 to-rune-400 transition-all duration-700" :style="{ width: `${(log.length / Math.max(totalDecisions, 1)) * 100}%` }" />
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-5 text-rune-300 transition" :class="saveState === 'idle' ? 'opacity-0' : 'opacity-100'" :title="saveState === 'error' ? 'บันทึกไม่สำเร็จ' : 'บันทึกแล้ว'">
            <AppIcon v-if="saveState === 'error'" name="clock" :size="16" class="text-red-400" />
            <AppIcon v-else name="check" :size="16" :class="{ 'animate-pulse': saveState === 'saving' }" />
          </span>
          <button class="btn-ghost !border-transparent !px-2 !py-1.5" :title="audio.muted.value ? 'เปิดเสียง' : 'ปิดเสียง'" @click.stop="audio.toggleMute()">
            <AppIcon :name="audio.muted.value ? 'mute' : 'volume'" :size="18" />
          </button>
        </div>
      </div>

      <!-- click area -->
      <div class="absolute inset-0 z-10 cursor-pointer" @click="advance" />

      <!-- choices -->
      <div v-if="showChoices" class="absolute inset-x-0 bottom-[calc(10rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-2xl flex-col gap-2.5 px-4 sm:bottom-48">
        <button
          v-for="(c, i) in scene.choices"
          :key="sceneId + i"
          class="choice group animate-fade-up"
          :style="{ animationDelay: `${i * 110}ms` }"
          @click="choose(i)"
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rune-400/50 font-display text-xs text-rune-300 transition group-hover:bg-rune-400 group-hover:text-abyss-950">
            {{ i + 1 }}
          </span>
          <span class="text-left">{{ c.text }}</span>
        </button>
      </div>

      <!-- dialogue box -->
      <div class="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6" @click="advance">
        <div class="relative mx-auto min-h-[8.5rem] max-w-3xl cursor-pointer rounded-2xl border border-rune-400/30 bg-abyss-900/85 px-5 pb-5 pt-6 shadow-[0_-10px_60px_-10px_rgba(124,58,237,0.45)] backdrop-blur-md sm:min-h-[10rem] sm:px-7">
          <span class="absolute left-2 top-2 h-4 w-4 border-l border-t border-rune-400/50" />
          <span class="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-rune-400/50" />
          <div
            v-if="line.speaker"
            class="absolute -top-4 left-5 rounded-lg border border-rune-400/60 bg-gradient-to-r from-rune-600 to-rune-400 px-3 py-1 font-display text-sm font-bold text-abyss-950 shadow-glow-gold"
          >
            {{ line.speaker }}
          </div>
          <p class="text-[1.05rem] leading-relaxed sm:text-lg" :class="line.speaker ? 'text-slate-50' : 'italic text-slate-300'">
            {{ typed }}<span v-if="typing" class="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-rune-300" />
          </p>
          <span v-if="!typing && !showChoices" class="absolute bottom-3 right-5 animate-bounce text-rune-300">▼</span>
        </div>
      </div>
    </template>

    <!-- overlays -->
    <div class="pointer-events-none absolute inset-0 z-30 bg-abyss-950 transition-opacity duration-500" :class="fading ? 'opacity-100' : 'opacity-0'" />
    <div class="pointer-events-none absolute inset-0 z-30 bg-white transition-opacity" :class="flashing ? 'opacity-80 duration-75' : 'opacity-0 duration-700'" />

    <div v-if="finishing" class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-abyss-950/90 backdrop-blur-sm">
      <div class="w-64">
        <MagicCircle>
          <div class="h-16 w-16 animate-pulse rounded-full bg-rune-300/80 shadow-glow-gold blur-sm" />
        </MagicCircle>
      </div>
      <p class="title-glow mt-6 animate-pulse text-lg">ผลึกกำลังเผยตัวตนของคุณ...</p>
    </div>

    <div v-if="started && error" class="absolute left-1/2 top-16 z-40 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-950/80 px-4 py-2 text-sm text-red-200">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.choice {
  @apply flex w-full items-center gap-3 rounded-xl border border-arcane-400/40 bg-abyss-900/85 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur-md transition duration-300 sm:text-base;
}
.choice:hover,
.choice:focus-visible {
  @apply -translate-y-0.5 border-rune-400/80 bg-abyss-800/95 shadow-glow-gold outline-none;
}
</style>
