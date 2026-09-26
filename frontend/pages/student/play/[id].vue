<script setup lang="ts">
import { ENERGY, replayProgress, type CastMember, type CharacterDef, type Expr, type Line, type LogEntry, type Reward, type Scene } from '~/utils/game'

definePageMeta({ layout: false })

const route = useRoute()
const api = useApi()
const audio = useGameAudio()
const questId = Number(route.params.id)

// ---- scenario --------------------------------------------------------------
const loading = ref(true)
const error = ref('')
const title = ref('')
const description = ref('')
const meta = ref<{ icon?: string; color?: string; subtitle?: string }>({})
const scenes = ref<Record<string, Scene>>({})
const characters = ref<Record<string, CharacterDef>>({})
const startScene = ref('')
const resumeFrom = ref<string | null>(null)

// ---- play state --------------------------------------------------------------
type Mode = 'title' | 'dialogue' | 'reply' | 'choice' | 'minigame'
const mode = ref<Mode>('title')
const sceneId = ref('')
const scene = computed(() => scenes.value[sceneId.value])
const background = ref('night')
const cast = ref<CastMember[]>([])
const exprs = ref<Record<string, Expr>>({})
const anim = ref<{ id: string; name: string; key: number } | null>(null)
const lines = ref<Line[]>([])
const lineIndex = ref(0)
const pendingNext = ref('')
const log = ref<LogEntry[]>([])
const typed = ref('')
const typing = ref(false)
const shaking = ref(false)
const flashing = ref(false)
const fading = ref(false)
const finishing = ref(false)
const saveState = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
const auto = ref(false)

const items = ref<Reward[]>([])
const energy = ref(0)
const floaters = ref<{ id: number; text: string }[]>([])
const rewardPopup = ref<Reward | null>(null)
const bagOpen = ref(false)

const line = computed(() => {
  const l = lines.value[lineIndex.value]
  if (!l) return { speaker: '', text: '' }
  return typeof l === 'string' ? { speaker: '', text: l } : { ...l, speaker: l.speaker ?? '' }
})
const speakerDef = computed(() => characters.value[line.value.speaker])
const speakerName = computed(() => speakerDef.value?.name ?? line.value.speaker)
const speakerColor = computed(() => speakerDef.value?.color ?? '#f5c451')

// Expected number of interactions along the main path (first choice / success branch).
const expectedSteps = computed(() => {
  let id = startScene.value
  let n = 0
  for (let guard = 0; guard < 200 && id && scenes.value[id] && !scenes.value[id].end; guard++) {
    const s = scenes.value[id]
    if (s.choices?.length) { n++; id = s.choices[0].next } else if (s.minigame) { n++; id = s.next! } else id = s.next!
  }
  return Math.max(n, 1)
})

// ---- load ------------------------------------------------------------------
onMounted(async () => {
  try {
    const res = await api(`/student/quests/${questId}`)
    if (res.completed) return navigateTo(`/student/result/${res.result_id}`, { replace: true })
    const content = res.scenario.content
    title.value = res.scenario.title
    description.value = res.scenario.description
    meta.value = content.meta ?? {}
    scenes.value = content.scenes
    characters.value = content.characters ?? {}
    startScene.value = content.start
    if (res.session) {
      resumeFrom.value = res.session.current_scene
      log.value = res.session.choices_log
      const p = replayProgress(scenes.value, log.value)
      items.value = p.items
      energy.value = p.energy
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
  clearTimeout(autoTimer)
})

// ---- typewriter -------------------------------------------------------------
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null
let typeTimer: ReturnType<typeof setInterval> | undefined
let autoTimer: ReturnType<typeof setTimeout> | undefined

function showLine() {
  clearInterval(typeTimer)
  clearTimeout(autoTimer)
  const l = line.value as any
  if (l.speaker && characters.value[l.speaker]) {
    if (l.expr) exprs.value[l.speaker] = l.expr
    if (l.anim) anim.value = { id: l.speaker, name: l.anim, key: Date.now() }
  }
  if (l.effect) runEffect(l.effect)

  const chars = segmenter ? Array.from(segmenter.segment(l.text), (s) => s.segment) : Array.from(l.text as string)
  let i = 0
  typed.value = ''
  typing.value = true
  typeTimer = setInterval(() => {
    typed.value += chars[i++] ?? ''
    if (chars[i - 1]?.trim()) audio.tick()
    if (i >= chars.length) finishTyping()
  }, 24)
}

function finishTyping() {
  clearInterval(typeTimer)
  typed.value = line.value.text
  typing.value = false
  if (auto.value) autoTimer = setTimeout(advance, 900 + line.value.text.length * 30)
}

// ---- effects ----------------------------------------------------------------
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

function gainEnergy(n: number) {
  energy.value += n
  const id = Date.now() + Math.random()
  floaters.value.push({ id, text: `+${n}` })
  setTimeout(() => (floaters.value = floaters.value.filter((f) => f.id !== id)), 1200)
}

function giveReward(r?: Reward) {
  if (!r) return
  items.value.push(r)
  rewardPopup.value = r
  audio.coin()
  setTimeout(() => rewardPopup.value === r && (rewardPopup.value = null), 1800)
}

// ---- flow -------------------------------------------------------------------
async function enterScene(id: string, transition = true) {
  if (transition) {
    fading.value = true
    audio.whoosh()
    await new Promise((r) => setTimeout(r, 420))
  }
  const s = scenes.value[id]
  sceneId.value = id
  if (s.background) background.value = s.background
  audio.playBgm(s.bgm)
  cast.value = s.cast ?? []
  exprs.value = Object.fromEntries(cast.value.map((m) => [m.id, m.expr ?? 'neutral']))
  lines.value = s.dialogue ?? []
  lineIndex.value = 0
  mode.value = 'dialogue'
  fading.value = false
  runEffect(s.effect)
  if (lines.value.length) showLine()
  else afterLines()
}

function start() {
  audio.unlock()
  enterScene(resumeFrom.value || startScene.value, false)
}

function advance() {
  if ((mode.value !== 'dialogue' && mode.value !== 'reply') || fading.value || finishing.value) return
  if (typing.value) return finishTyping()
  if (lineIndex.value < lines.value.length - 1) {
    lineIndex.value++
    return showLine()
  }
  afterLines()
}

function afterLines() {
  clearTimeout(autoTimer)
  if (mode.value === 'reply') return goNext(pendingNext.value)
  const s = scene.value
  if (s.end) return finish()
  if (s.choices?.length) return (mode.value = 'choice')
  if (s.minigame) return (mode.value = 'minigame')
  if (s.next) goNext(s.next)
}

function goNext(next: string) {
  save(next)
  enterScene(next)
}

function onChoose(index: number) {
  const choice = scene.value.choices![index]
  audio.select()
  log.value.push({ scene: sceneId.value, choice: index })
  gainEnergy(ENERGY.choice)
  giveReward(choice.reward)
  if (choice.reply?.length) {
    save(choice.next)
    pendingNext.value = choice.next
    lines.value = choice.reply
    lineIndex.value = 0
    mode.value = 'reply'
    showLine()
  } else {
    goNext(choice.next)
  }
}

function onMinigameDone(success: boolean) {
  const s = scene.value
  log.value.push({ scene: sceneId.value, outcome: success ? 'success' : 'fail' })
  gainEnergy(success ? ENERGY.win : ENERGY.fail)
  goNext(success ? s.next! : s.fail_next ?? s.next!)
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

function toggleAuto() {
  auto.value = !auto.value
  if (auto.value && !typing.value) advance()
  else clearTimeout(autoTimer)
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    advance()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const choicePrompt = computed(() => {
  const last = scene.value?.dialogue?.at(-1)
  const text = typeof last === 'string' ? last : last?.text
  return text || scene.value?.prompt || 'เลือกเส้นทางของเจ้า'
})
const choiceSpeaker = computed(() => {
  const last = scene.value?.dialogue?.at(-1)
  const id = typeof last === 'object' ? last.speaker : undefined
  return id ? { name: characters.value[id]?.name ?? id, color: characters.value[id]?.color ?? '#f5c451' } : null
})
const titleCast = computed(() => Object.entries(characters.value).slice(0, 3))
</script>

<template>
  <div class="fixed inset-0 select-none overflow-hidden bg-abyss-950 text-slate-100" :class="{ 'animate-shake': shaking }">
    <GameVnBackground :name="mode === 'title' ? 'night' : background" />

    <!-- ═══════ TITLE SCREEN ═══════ -->
    <div v-if="mode === 'title'" class="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 text-center">
      <MysticBackground />
      <div v-if="loading" class="text-arcane-300">กำลังเปิดคัมภีร์...</div>
      <div v-else-if="error" class="card max-w-sm">
        <p class="text-red-300">{{ error }}</p>
        <NuxtLink to="/student" class="btn-ghost mt-4">กลับหน้าหลัก</NuxtLink>
      </div>
      <template v-else>
        <div class="flex h-44 items-end justify-center gap-1 sm:h-56">
          <div
            v-for="([id, def], i) in titleCast"
            :key="id"
            class="h-full w-28 animate-fade-up sm:w-36"
            :class="i === 1 ? 'z-10 scale-110' : 'opacity-80'"
            :style="{ animationDelay: `${i * 150}ms` }"
          >
            <GameCharacterSprite :def="def" :expr="i === 1 ? 'happy' : 'neutral'" :class="def.kind === 'owl' ? 'animate-float' : ''" />
          </div>
        </div>
        <p class="mt-5 animate-fade-up font-display text-xs tracking-[0.4em]" :style="{ color: meta.color ?? '#c4b5fd', animationDelay: '300ms' }">
          {{ meta.subtitle ?? 'QUEST' }}
        </p>
        <h1 class="title-glow mt-2 animate-fade-up text-3xl sm:text-4xl" style="animation-delay: 400ms">{{ title }}</h1>
        <p class="mt-3 max-w-sm animate-fade-up text-sm leading-relaxed text-slate-400" style="animation-delay: 500ms">{{ description }}</p>
        <div class="mt-5 flex animate-fade-up flex-wrap justify-center gap-2 text-xs text-slate-300" style="animation-delay: 600ms">
          <span class="chip"><AppIcon name="hand" :size="13" /> เลือก·สำรวจ</span>
          <span class="chip"><AppIcon name="bolt" :size="13" /> มินิเกม</span>
          <span class="chip"><AppIcon name="bag" :size="13" /> สะสมไอเทม</span>
        </div>
        <div class="mt-7 flex animate-fade-up flex-col items-center gap-3" style="animation-delay: 700ms">
          <button class="btn-primary !px-8 !py-3 text-base font-semibold" @click="start">
            <AppIcon name="play" :size="18" />
            {{ resumeFrom ? 'เดินทางต่อจากจุดที่บันทึกไว้' : 'เริ่มการผจญภัย' }}
          </button>
          <p class="text-xs text-slate-500"><AppIcon name="volume" :size="12" class="inline" /> เปิดเสียงเพื่อประสบการณ์เต็มที่</p>
          <NuxtLink to="/student" class="text-sm text-slate-500 hover:text-slate-300">ย้อนกลับ</NuxtLink>
        </div>
      </template>
    </div>

    <!-- ═══════ GAME ═══════ -->
    <template v-else>
      <GameStageCast
        v-if="mode !== 'minigame'"
        :variant="mode !== 'choice' ? 'normal' : scene?.layout === 'hotspots' ? 'low' : 'raised'"
        :cast="cast"
        :characters="characters"
        :speaker="(mode === 'dialogue' || mode === 'reply') ? line.speaker : undefined"
        :exprs="exprs"
        :anim="anim"
      />

      <!-- HUD -->
      <div class="absolute inset-x-0 top-0 z-40 flex items-center gap-2 bg-gradient-to-b from-abyss-950/90 to-transparent px-3 pb-5 pt-3">
        <NuxtLink to="/student" class="hud-btn" title="พักการเดินทาง (บันทึกอัตโนมัติ)"><AppIcon name="back" :size="18" /></NuxtLink>
        <div class="min-w-0 flex-1">
          <div class="truncate font-display text-xs tracking-wider text-rune-300/90">{{ title }}</div>
          <div class="mt-1 h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-white/10">
            <div class="h-full bg-gradient-to-r from-arcane-500 to-rune-400 transition-all duration-700" :style="{ width: `${Math.min(100, (log.length / expectedSteps) * 100)}%` }" />
          </div>
        </div>
        <div class="relative flex items-center gap-1 rounded-full border border-rune-400/40 bg-abyss-950/70 px-2.5 py-1 font-display text-sm text-rune-200">
          ✦ {{ energy }}
          <span v-for="f in floaters" :key="f.id" class="floater absolute -bottom-6 right-1 text-sm font-bold text-rune-300">{{ f.text }}</span>
        </div>
        <button class="hud-btn relative" title="กระเป๋าไอเทม" @click.stop="bagOpen = true">
          <AppIcon name="bag" :size="18" />
          <span v-if="items.length" class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rune-400 px-1 text-[10px] font-bold text-abyss-950">{{ items.length }}</span>
        </button>
        <button class="hud-btn" :class="{ '!border-rune-400 !text-rune-300': auto }" title="เล่นอัตโนมัติ" @click.stop="toggleAuto">
          <AppIcon name="forward" :size="16" />
        </button>
        <button class="hud-btn" :title="audio.muted.value ? 'เปิดเสียง' : 'ปิดเสียง'" @click.stop="audio.toggleMute()">
          <AppIcon :name="audio.muted.value ? 'mute' : 'volume'" :size="18" />
        </button>
        <span class="w-4 text-rune-300 transition" :class="saveState === 'idle' ? 'opacity-0' : 'opacity-100'">
          <AppIcon :name="saveState === 'error' ? 'clock' : 'check'" :size="14" :class="{ 'text-red-400': saveState === 'error' }" />
        </span>
      </div>

      <!-- tap area + dialogue -->
      <template v-if="mode === 'dialogue' || mode === 'reply'">
        <div class="absolute inset-0 z-10 cursor-pointer" @click="advance" />
        <div class="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-6" @click="advance">
          <div class="dialog-box" :style="line.speaker ? { borderColor: `${speakerColor}88` } : {}">
            <div v-if="line.speaker" class="nameplate" :style="{ background: speakerColor }">{{ speakerName }}</div>
            <p class="text-[1.05rem] leading-relaxed sm:text-lg" :class="line.speaker ? 'text-slate-50' : 'text-center italic text-rune-100/90'">
              {{ typed }}<span v-if="typing" class="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-rune-300" />
            </p>
            <span v-if="!typing" class="absolute bottom-2.5 right-4 animate-bounce text-rune-300">▼</span>
          </div>
        </div>
      </template>

      <GameChoicePanel
        v-if="mode === 'choice'"
        :key="sceneId"
        :choices="scene.choices!"
        :layout="scene.layout"
        :prompt="scene.layout === 'hotspots' ? (scene.prompt ?? choicePrompt) : choicePrompt"
        :speaker="choiceSpeaker?.name"
        :speaker-color="choiceSpeaker?.color"
        :timer="scene.timer"
        :timeout-choice="scene.timeout_choice"
        @choose="onChoose"
      />

      <template v-if="mode === 'minigame'">
        <GameMiniGameSequence v-if="scene.minigame!.type === 'sequence'" :key="sceneId" v-bind="scene.minigame" @done="onMinigameDone" />
        <GameMiniGameOrbs v-else :key="sceneId" v-bind="scene.minigame" @done="onMinigameDone" />
      </template>
    </template>

    <!-- reward popup -->
    <Transition enter-from-class="opacity-0 scale-50" leave-to-class="opacity-0 -translate-y-6" enter-active-class="transition duration-300 ease-out" leave-active-class="transition duration-300">
      <div v-if="rewardPopup" class="pointer-events-none absolute left-1/2 top-[22%] z-50 -translate-x-1/2 text-center">
        <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-rune-300 bg-abyss-900/90 text-rune-200 shadow-glow-gold">
          <AppIcon :name="rewardPopup.icon" :size="36" />
        </div>
        <p class="mt-2 font-display text-xs tracking-[0.3em] text-rune-300">ได้รับไอเทม!</p>
        <p class="title-glow text-lg">{{ rewardPopup.name }}</p>
      </div>
    </Transition>

    <!-- bag -->
    <div v-if="bagOpen" class="absolute inset-0 z-50 flex items-center justify-center bg-abyss-950/80 p-6 backdrop-blur-sm" @click="bagOpen = false">
      <div class="card w-full max-w-sm animate-fade-up" @click.stop>
        <h3 class="title-glow text-xl">กระเป๋าของนักผจญภัย</h3>
        <p v-if="!items.length" class="mt-3 text-sm text-slate-400">ยังไม่มีไอเทม — ลองเลือกเส้นทางต่อไปสิ!</p>
        <div class="mt-4 grid grid-cols-3 gap-3">
          <div v-for="(it, i) in items" :key="i" class="flex flex-col items-center gap-1 rounded-xl border border-rune-400/30 bg-abyss-950/60 p-2 text-center">
            <AppIcon :name="it.icon" :size="26" class="text-rune-300" />
            <span class="text-[11px] leading-tight text-slate-300">{{ it.name }}</span>
          </div>
        </div>
        <button class="btn-ghost mt-5 w-full" @click="bagOpen = false">ปิด</button>
      </div>
    </div>

    <!-- overlays -->
    <div class="pointer-events-none absolute inset-0 z-[45] bg-abyss-950 transition-opacity duration-500" :class="fading ? 'opacity-100' : 'opacity-0'" />
    <div class="pointer-events-none absolute inset-0 z-[45] bg-white transition-opacity" :class="flashing ? 'opacity-80 duration-75' : 'opacity-0 duration-700'" />

    <div v-if="finishing" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-abyss-950/90 backdrop-blur-sm">
      <div class="w-64"><MagicCircle><div class="h-16 w-16 animate-pulse rounded-full bg-rune-300/80 shadow-glow-gold blur-sm" /></MagicCircle></div>
      <p class="title-glow mt-6 animate-pulse text-lg">ผลึกกำลังเผยตัวตนของคุณ...</p>
    </div>

    <div v-if="mode !== 'title' && error" class="absolute left-1/2 top-16 z-50 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-950/80 px-4 py-2 text-sm text-red-200">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.hud-btn {
  @apply flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-arcane-400/30 bg-abyss-950/70 text-slate-300 transition hover:border-rune-400/60 hover:text-rune-200;
}
.chip {
  @apply inline-flex items-center gap-1 rounded-full border border-arcane-400/30 bg-abyss-900/70 px-2.5 py-1;
}
.dialog-box {
  @apply relative mx-auto min-h-[7.5rem] max-w-3xl cursor-pointer rounded-2xl border border-rune-400/30 bg-abyss-900/90 px-5 pb-6 pt-6 shadow-[0_-10px_60px_-10px_rgba(124,58,237,0.45)] backdrop-blur-md transition-colors sm:min-h-[8.5rem] sm:px-7;
}
.nameplate {
  @apply absolute -top-4 left-5 rounded-lg px-3 py-1 font-display text-sm font-bold text-abyss-950 shadow-glow-gold;
}
.floater {
  animation: float-up 1.2s ease-out forwards;
}
@keyframes float-up {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-28px); }
}
</style>
