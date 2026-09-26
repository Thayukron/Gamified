<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { AssessmentResult } from '~/utils/profile'
import { avatarDef, RARITY, type Rarity } from '~/utils/progression'

interface Quest {
  id: number
  title: string
  subtitle: string | null
  description: string
  icon: string | null
  color: string | null
  is_universal: number
  status: 'new' | 'in_progress' | 'completed'
  result_id: number | null
  saved_at: string | null
}

const auth = useAuthStore()
const api = useApi()
const quests = ref<Quest[]>([])
const core = ref<{ profile: AssessmentResult | null; completed: number; total: number; semester: number; academic_year: number } | null>(null)
const selectedId = ref<number | null>(null)
const loading = ref(true)
const { player, level, load: loadPlayer } = usePlayer()
const creator = ref<'first' | 'edit' | null>(null)

onMounted(async () => {
  try {
    const [q, p, pl] = await Promise.all([api('/student/quests'), api('/student/profile'), loadPlayer()])
    if (!pl?.avatar) creator.value = 'first'
    quests.value = q.quests
    core.value = p
    selectedId.value = (quests.value.find((x) => x.status === 'in_progress') ?? quests.value.find((x) => x.status === 'new') ?? quests.value[0])?.id ?? null
  } finally {
    loading.value = false
  }
})

const selected = computed(() => quests.value.find((q) => q.id === selectedId.value))
// Zig-zag node layout down the map.
const nodePos = (i: number) => ({ left: i % 2 === 0 ? 32 : 68, top: 13 + i * (62 / Math.max(quests.value.length - 1, 1)) })
const pathD = computed(() => {
  const pts = quests.value.map((_, i) => nodePos(i))
  return pts.map((p, i) => (i === 0 ? `M${p.left} ${p.top}` : `C${pts[i - 1].left} ${(pts[i - 1].top + p.top) / 2} ${p.left} ${(pts[i - 1].top + p.top) / 2} ${p.left} ${p.top}`)).join(' ')
})
const statusText = { new: 'เควสต์ใหม่', in_progress: 'เดินทางค้างไว้', completed: 'สำเร็จแล้ว' }
const fmtTime = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="space-y-6">
    <AvatarCreator
      v-if="creator"
      :initial="player?.avatar"
      :name="auth.user?.full_name"
      :first-time="creator === 'first'"
      @saved="creator = null"
      @close="creator = null"
    />
    <!-- hero -->
    <section class="card animate-fade-up overflow-hidden border-rune-400/30 !p-0">
      <div class="absolute -right-16 -top-16 w-60 opacity-40"><MagicCircle /></div>
      <div class="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <button class="group relative mx-auto -mb-2 h-44 w-32 shrink-0 sm:mx-0" title="ปรับแต่งตัวละคร" @click="creator = 'edit'">
          <div class="absolute inset-x-2 bottom-1 h-8 rounded-full bg-rune-400/25 blur-lg" />
          <GameCharacterSprite :def="avatarDef(player?.avatar, auth.user?.full_name)" expr="happy" class="relative transition group-hover:scale-105" />
          <span class="absolute bottom-2 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-rune-400/60 bg-abyss-900 text-rune-300">
            <AppIcon name="quill" :size="14" />
          </span>
        </button>
        <div class="flex-1">
          <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">WELCOME, TRAVELER</p>
          <h1 class="title-glow mt-1 text-2xl sm:text-3xl">{{ auth.user?.full_name }}</h1>
          <p class="mt-1 text-sm text-slate-400">
            รหัส <span class="font-mono text-rune-300">{{ auth.user?.student_code }}</span>
            <template v-if="core"> · ภาคเรียน {{ core.semester }}/{{ core.academic_year }}</template>
          </p>
          <div class="mt-3 flex max-w-sm items-center gap-3">
            <span class="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-rune-400/60 bg-abyss-950 shadow-glow-gold">
              <span class="text-[9px] leading-none text-rune-300/80">LV</span>
              <span class="font-display text-lg font-bold leading-none text-rune-200">{{ level.level }}</span>
            </span>
            <div class="flex-1">
              <div class="flex justify-between text-xs text-slate-400">
                <span>XP {{ level.into }} / {{ level.need }}</span>
                <span class="flex items-center gap-1 text-amber-300"><span class="coin" /> {{ player?.coins ?? 0 }}</span>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                <div class="h-full rounded-full bg-gradient-to-r from-sky-400 to-arcane-400 transition-all duration-1000" :style="{ width: `${level.pct}%` }" />
              </div>
            </div>
          </div>
          <div v-if="core" class="mt-3 max-w-sm">
            <div class="flex justify-between text-xs text-slate-400">
              <span>การค้นพบตัวตน</span><span class="text-rune-300">{{ core.completed }}/{{ core.total }} เควสต์</span>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div class="h-full rounded-full bg-gradient-to-r from-arcane-500 to-rune-400 transition-all duration-1000" :style="{ width: `${(core.completed / Math.max(core.total, 1)) * 100}%` }" />
            </div>
          </div>
        </div>

        <NuxtLink
          v-if="core?.profile"
          to="/student/profile"
          class="flex items-center gap-3 rounded-2xl border bg-abyss-950/70 p-3 pr-5 transition hover:-translate-y-0.5"
          :style="{ borderColor: `${core.profile.color}99`, boxShadow: `0 0 30px -8px ${core.profile.color}` }"
        >
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 bg-abyss-900" :style="{ borderColor: core.profile.color, color: core.profile.color }">
            <AppIcon :name="core.profile.icon" :size="28" />
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-widest text-slate-400">
              Core Profile · <span :style="{ color: RARITY[(core.profile.rarity ?? 'rare') as Rarity].color }">{{ RARITY[(core.profile.rarity ?? 'rare') as Rarity].label }}</span>
            </div>
            <div class="font-display font-bold text-rune-200">{{ core.profile.archetype_name }}</div>
            <div class="text-sm" :style="{ color: core.profile.color }">{{ core.profile.archetype_title }}</div>
          </div>
        </NuxtLink>
        <div v-else class="flex items-center gap-2 text-xs text-slate-400">
          <span class="h-2 w-2 animate-pulse rounded-full bg-rune-400 shadow-glow-gold" /> ยังไม่พบ Archetype — เริ่มเควสต์แรกเลย!
        </div>
      </div>
    </section>

    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">WORLD MAP</span></div>

    <p v-if="loading" class="text-center text-slate-500">กำลังคลี่แผนที่...</p>
    <p v-else-if="!quests.length" class="card text-center text-slate-400">ยังไม่มีเควสต์เปิดให้เล่นในขณะนี้</p>

    <div v-else class="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <!-- map -->
      <div class="map relative h-[460px] animate-fade-up overflow-hidden rounded-3xl border border-rune-400/25 sm:h-[520px]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full">
          <path :d="pathD" fill="none" stroke="#f5c451" stroke-opacity=".45" stroke-width="0.8" stroke-dasharray="2 2" vector-effect="non-scaling-stroke" style="stroke-width: 3px" />
        </svg>
        <!-- decorations -->
        <div class="absolute left-[8%] top-[48%] h-16 w-16 rounded-full bg-emerald-400/10 blur-xl" />
        <div class="absolute right-[10%] top-[30%] h-20 w-20 rounded-full bg-sky-400/10 blur-xl" />

        <button
          v-for="(q, i) in quests"
          :key="q.id"
          class="node group absolute -translate-x-1/2 -translate-y-1/2 animate-fade-up text-center"
          :style="{ left: `${nodePos(i).left}%`, top: `${nodePos(i).top}%`, animationDelay: `${200 + i * 150}ms` }"
          @click="selectedId = q.id"
        >
          <span v-if="q.status === 'new'" class="absolute left-1/2 top-9 h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 opacity-60" :style="{ borderColor: q.color ?? '#f5c451' }" />
          <span
            class="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-[3px] bg-abyss-900 transition duration-300 group-hover:scale-110"
            :class="selectedId === q.id ? 'scale-110' : ''"
            :style="{ borderColor: q.color ?? '#f5c451', color: q.color ?? '#f5c451', boxShadow: `0 0 ${selectedId === q.id ? 40 : 20}px ${q.color ?? '#f5c451'}88` }"
          >
            <AppIcon :name="q.icon ?? 'map'" :size="32" />
            <span v-if="q.status === 'completed'" class="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"><AppIcon name="check" :size="14" /></span>
            <span v-else-if="q.status === 'in_progress'" class="absolute -right-1 -top-1 flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-arcane-500 text-white"><AppIcon name="clock" :size="14" /></span>
            <span v-else class="absolute -right-1 -top-1 flex h-6 w-6 animate-bounce items-center justify-center rounded-full bg-rune-400 font-bold text-abyss-950">!</span>
          </span>
          <span class="mx-auto mt-2 block w-max max-w-[9.5rem] rounded-2xl border border-white/10 bg-abyss-950/80 px-3 py-1 text-xs font-medium leading-tight text-slate-100 sm:max-w-none sm:text-sm">{{ q.title }}</span>
        </button>
      </div>

      <!-- quest detail -->
      <div v-if="selected" :key="selected.id" class="card animate-fade-up self-start overflow-hidden" :style="{ borderColor: `${selected.color}66` }">
        <div class="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-30 blur-3xl" :style="{ background: selected.color ?? '#f5c451' }" />
        <div class="relative">
          <p class="font-display text-xs tracking-[0.3em]" :style="{ color: selected.color ?? '#f5c451' }">{{ selected.subtitle }}</p>
          <h2 class="title-glow mt-1 text-2xl">{{ selected.title }}</h2>
          <span class="mt-2 inline-block rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-slate-300">{{ statusText[selected.status] }}</span>
          <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ selected.description }}</p>
          <p v-if="selected.status === 'in_progress' && selected.saved_at" class="mt-2 flex items-center gap-1 text-xs text-arcane-300">
            <AppIcon name="clock" :size="12" /> บันทึกล่าสุด {{ fmtTime(selected.saved_at) }}
          </p>
          <div class="mt-5 flex flex-wrap gap-2">
            <NuxtLink v-if="selected.status === 'completed'" :to="`/student/result/${selected.result_id}`" class="btn-ghost">
              <AppIcon name="card" :size="16" /> ดูการ์ดของเควสต์นี้
            </NuxtLink>
            <NuxtLink v-else :to="`/student/play/${selected.id}`" class="btn-primary !px-6 !py-3">
              <AppIcon name="play" :size="16" /> {{ selected.status === 'in_progress' ? 'เดินทางต่อ' : 'ออกผจญภัย!' }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <NuxtLink to="/student/history" class="card card-hover group flex animate-fade-up items-center gap-4 !p-4">
      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rune-400/30 bg-abyss-900/80 text-rune-300 shadow-glow transition duration-500 group-hover:rotate-6">
        <AppIcon name="hourglass" />
      </div>
      <div>
        <div class="font-medium text-slate-100">บันทึกการเดินทาง</div>
        <p class="text-sm text-slate-400">ย้อนดูการ์ดของทุกเควสต์ในแต่ละภาคเรียน</p>
      </div>
    </NuxtLink>
  </div>
</template>

<style scoped>
.map {
  background:
    radial-gradient(circle at 25% 20%, rgba(167, 139, 250, 0.18), transparent 40%),
    radial-gradient(circle at 75% 55%, rgba(245, 158, 11, 0.12), transparent 40%),
    radial-gradient(circle at 30% 85%, rgba(56, 189, 248, 0.14), transparent 40%),
    linear-gradient(180deg, #140d2b, #0b0718);
}
.map::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  opacity: 0.12;
}
</style>
