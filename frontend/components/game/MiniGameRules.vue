<script setup lang="ts">
// Rules card shown before every mini-game; the player starts it when ready.
defineProps<{ title: string; icon: string; rules: string[]; goal: string }>()
const emit = defineEmits<{ start: [] }>()
</script>

<template>
  <div class="absolute inset-0 z-40 flex items-center justify-center bg-abyss-950/70 p-5 backdrop-blur-sm">
    <div class="card w-full max-w-sm animate-fade-up border-rune-400/50 text-center">
      <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-rune-300 bg-abyss-950 text-rune-200 shadow-glow-gold">
        <AppIcon :name="icon" :size="28" />
      </div>
      <p class="mt-3 font-display text-xs tracking-[0.4em] text-arcane-300">MINI GAME</p>
      <h2 class="title-glow text-2xl">{{ title }}</h2>
      <ol class="mt-4 space-y-2 text-left text-sm text-slate-200">
        <li v-for="(r, i) in rules" :key="i" class="flex gap-2">
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rune-400 font-display text-xs font-bold text-abyss-950">{{ i + 1 }}</span>
          <span>{{ r }}</span>
        </li>
      </ol>
      <p class="mt-4 rounded-xl border border-rune-400/30 bg-rune-400/10 px-3 py-2 text-sm text-rune-100">🎯 {{ goal }}</p>
      <p class="mt-2 text-xs text-slate-400">พลาดก็ไม่เป็นไร เรื่องราวจะดำเนินต่อ</p>
      <button class="btn-primary mt-4 w-full !py-3 text-base" @click="emit('start')">
        <AppIcon name="play" :size="18" /> เริ่มเลย!
      </button>
    </div>
  </div>
</template>
