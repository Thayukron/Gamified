<script setup lang="ts">
import { avatarDef, DEFAULT_AVATAR, HERO_PRESETS, heroImage, loadAvailableHeroes, type Avatar } from '~/utils/progression'

// Pick your adventurer. Shows a gallery of painted heroes (same art style as the quests);
// falls back to the drawn builder when no hero artwork has been deployed yet.
const props = defineProps<{ initial?: Avatar | null; name?: string; firstTime?: boolean }>()
const emit = defineEmits<{ saved: [avatar: Avatar]; close: [] }>()
const { saveAvatar } = usePlayer()

const a = reactive<Avatar>({ ...DEFAULT_AVATAR, ...(props.initial ?? {}) })
const saving = ref(false)
const heroes = ref<string[] | null>(null)
const filter = ref<'all' | 'm' | 'f'>('all')
const hovered = ref<string | null>(null)

onMounted(async () => {
  heroes.value = await loadAvailableHeroes()
  if (heroes.value.length && !a.preset) a.preset = heroes.value[0]
})

const gallery = computed(() =>
  HERO_PRESETS.filter((h) => heroes.value?.includes(h.id) && (filter.value === 'all' || h.gender === filter.value)),
)
const selectedHero = computed(() => HERO_PRESETS.find((h) => h.id === a.preset))
function pick(id: string, gender: 'm' | 'f') {
  a.preset = id
  a.gender = gender
}

// ---- drawn builder (fallback) ----
const expr = ref<'neutral' | 'happy'>('happy')
const options = {
  hair: ['#1f2937', '#78350f', '#b45309', '#fde68a', '#e5e7eb', '#f472b6', '#60a5fa', '#a78bfa'],
  skin: ['#fde2cf', '#f1c7a5', '#e8b98f', '#c68a5c', '#8d5a3b'],
  eyes: ['#7c3aed', '#2563eb', '#16a34a', '#b45309', '#1f2937', '#e11d48'],
  robe: ['#4c1d95', '#1e3a8a', '#0f766e', '#991b1b', '#374151', '#9d174d'],
}
const hairStyles = [
  { v: 'short', th: 'สั้น' },
  { v: 'bob', th: 'บ็อบ' },
  { v: 'long', th: 'ยาว' },
] as const
function setGender(g: 'm' | 'f') {
  a.gender = g
  a.hairStyle = g === 'm' ? 'short' : 'long'
}

async function save() {
  saving.value = true
  try {
    const body = { ...a }
    if (!heroes.value?.length) delete body.preset
    emit('saved', await saveAvatar(body))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-abyss-950/90 p-3 backdrop-blur-sm sm:p-4">
    <p v-if="heroes === null" class="text-arcane-300">กำลังเรียกเหล่านักผจญภัย...</p>

    <!-- ═══ Painted hero gallery ═══ -->
    <div v-else-if="heroes.length" class="card my-auto grid w-full max-w-5xl animate-fade-up gap-5 border-rune-400/40 !p-4 sm:!p-6 lg:grid-cols-[300px_1fr]">
      <!-- preview -->
      <div class="flex flex-col items-center">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300">{{ firstTime ? 'CHOOSE YOUR HERO' : 'YOUR HERO' }}</p>
        <div class="relative mt-2 h-52 w-36 sm:h-96 sm:w-64">
          <div class="absolute inset-x-6 bottom-2 h-10 rounded-full bg-rune-400/30 blur-xl" />
          <Transition mode="out-in" enter-from-class="opacity-0 translate-y-3" enter-active-class="transition duration-300" leave-to-class="opacity-0" leave-active-class="transition duration-150">
            <img
              v-if="a.preset"
              :key="a.preset"
              :src="heroImage(a.preset)"
              :alt="selectedHero?.title"
              class="relative h-full w-full object-contain object-bottom drop-shadow-[0_0_25px_rgba(245,196,81,0.35)]"
            >
          </Transition>
        </div>
        <p class="title-glow mt-2 text-xl">{{ name }}</p>
        <p class="text-sm text-rune-300">{{ selectedHero?.title }}</p>
      </div>

      <!-- choices -->
      <div class="flex min-w-0 flex-col">
        <h2 class="title-glow text-2xl">{{ firstTime ? 'เลือกนักผจญภัยของคุณ' : 'เปลี่ยนตัวละคร' }}</h2>
        <p class="text-sm text-slate-400">แตะเลือกตัวละครที่ใช่ — จะร่วมเดินทางไปกับคุณในทุกเควสต์ (เปลี่ยนได้ภายหลัง)</p>

        <div class="mt-3 flex gap-2">
          <button v-for="f in [{ v: 'all', th: 'ทั้งหมด' }, { v: 'f', th: 'หญิง' }, { v: 'm', th: 'ชาย' }] as const" :key="f.v" class="opt" :class="{ 'opt-on': filter === f.v }" @click="filter = f.v">{{ f.th }}</button>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
          <button
            v-for="h in gallery"
            :key="h.id"
            class="hero-card group"
            :class="{ 'hero-on': a.preset === h.id }"
            @mouseenter="hovered = h.id"
            @mouseleave="hovered = null"
            @click="pick(h.id, h.gender)"
          >
            <div class="relative aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-b from-abyss-700 to-abyss-900">
              <img
                :src="heroImage(h.id)"
                :alt="h.title"
                loading="lazy"
                class="absolute left-1/2 top-0 h-[190%] max-w-none -translate-x-1/2 object-contain object-top transition duration-500 group-hover:scale-105"
              >
              <span v-if="a.preset === h.id" class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rune-400 text-abyss-950">
                <AppIcon name="check" :size="14" />
              </span>
            </div>
            <p class="mt-1.5 truncate text-center text-xs text-slate-300 sm:text-sm">{{ h.title }}</p>
          </button>
        </div>

        <div class="mt-auto flex gap-2 pt-5">
          <button class="btn-primary flex-1 !py-3" :disabled="saving || !a.preset" @click="save">
            <AppIcon name="check" :size="18" /> {{ firstTime ? 'เริ่มการผจญภัย!' : 'บันทึก' }}
          </button>
          <button v-if="!firstTime" class="btn-ghost" @click="emit('close')">ยกเลิก</button>
        </div>
      </div>
    </div>

    <!-- ═══ Drawn builder (no hero artwork deployed) ═══ -->
    <div v-else class="card my-auto grid w-full max-w-3xl animate-fade-up gap-5 border-rune-400/40 sm:grid-cols-[240px_1fr]">
      <div class="flex flex-col items-center">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300">{{ firstTime ? 'CREATE YOUR HERO' : 'YOUR HERO' }}</p>
        <div class="relative mt-2 h-64 w-44 cursor-pointer sm:h-80 sm:w-56" @mouseenter="expr = 'neutral'" @mouseleave="expr = 'happy'">
          <div class="absolute inset-x-4 bottom-2 h-10 rounded-full bg-rune-400/20 blur-xl" />
          <GameCharacterSprite :def="avatarDef({ ...a, preset: undefined }, name)" :expr="expr" class="relative" />
        </div>
        <p class="title-glow mt-1 text-lg">{{ name }}</p>
      </div>
      <div class="space-y-4">
        <div>
          <h2 class="title-glow text-2xl">{{ firstTime ? 'สร้างนักผจญภัยของคุณ' : 'ปรับแต่งตัวละคร' }}</h2>
          <p class="text-sm text-slate-400">ตัวละครนี้จะร่วมเดินทางไปกับคุณในทุกเควสต์</p>
        </div>
        <div>
          <p class="label">เพศ</p>
          <div class="flex gap-2">
            <button v-for="g in [{ v: 'f', th: 'หญิง' }, { v: 'm', th: 'ชาย' }] as const" :key="g.v" class="opt" :class="{ 'opt-on': a.gender === g.v }" @click="setGender(g.v)">{{ g.th }}</button>
          </div>
        </div>
        <div>
          <p class="label">ทรงผม</p>
          <div class="flex gap-2">
            <button v-for="h in hairStyles" :key="h.v" class="opt" :class="{ 'opt-on': a.hairStyle === h.v }" @click="a.hairStyle = h.v">{{ h.th }}</button>
          </div>
        </div>
        <div v-for="(label, key) in { hair: 'สีผม', skin: 'สีผิว', eyes: 'สีตา', robe: 'สีเสื้อคลุม' }" :key="key">
          <p class="label">{{ label }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in options[key]"
              :key="c"
              class="h-8 w-8 rounded-full border-2 transition hover:scale-110"
              :class="a[key] === c ? 'scale-110 border-rune-300 shadow-glow-gold' : 'border-white/20'"
              :style="{ background: c }"
              :title="c"
              @click="a[key] = c"
            />
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button class="btn-primary flex-1 !py-3" :disabled="saving" @click="save">
            <AppIcon name="check" :size="18" /> {{ firstTime ? 'เริ่มการผจญภัย!' : 'บันทึก' }}
          </button>
          <button v-if="!firstTime" class="btn-ghost" @click="emit('close')">ยกเลิก</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.opt {
  @apply rounded-xl border border-arcane-400/30 bg-abyss-900/70 px-4 py-2 text-sm text-slate-300 transition hover:border-rune-400/60;
}
.opt-on {
  @apply border-rune-400 bg-rune-400/15 text-rune-200 shadow-glow-gold;
}
.hero-card {
  @apply rounded-2xl border-2 border-arcane-400/20 bg-abyss-900/60 p-1.5 transition duration-300 hover:-translate-y-1 hover:border-rune-400/60;
}
.hero-on {
  @apply border-rune-400 shadow-glow-gold;
}
</style>
