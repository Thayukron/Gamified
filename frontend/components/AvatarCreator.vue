<script setup lang="ts">
import { avatarDef, DEFAULT_AVATAR, type Avatar } from '~/utils/progression'

// Character creator for the student's own adventurer ("The Seeker").
const props = defineProps<{ initial?: Avatar | null; name?: string; firstTime?: boolean }>()
const emit = defineEmits<{ saved: [avatar: Avatar]; close: [] }>()
const { saveAvatar } = usePlayer()

const a = reactive<Avatar>({ ...DEFAULT_AVATAR, ...(props.initial ?? {}) })
const saving = ref(false)
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
    emit('saved', await saveAvatar({ ...a }))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-abyss-950/85 p-4 backdrop-blur-sm">
    <div class="card my-auto grid w-full max-w-3xl animate-fade-up gap-5 border-rune-400/40 sm:grid-cols-[240px_1fr]">
      <div class="flex flex-col items-center">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300">{{ firstTime ? 'CREATE YOUR HERO' : 'YOUR HERO' }}</p>
        <div
          class="relative mt-2 h-64 w-44 cursor-pointer sm:h-80 sm:w-56"
          @mouseenter="expr = 'neutral'"
          @mouseleave="expr = 'happy'"
        >
          <div class="absolute inset-x-4 bottom-2 h-10 rounded-full bg-rune-400/20 blur-xl" />
          <GameCharacterSprite :def="avatarDef(a, name)" :expr="expr" class="relative" />
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
</style>
