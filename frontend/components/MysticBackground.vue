<script setup lang="ts">
// Layered night sky: nebula glow, twinkling stars, drifting fog, rising embers.
const rand = (min: number, max: number) => min + Math.random() * (max - min)

const stars = Array.from({ length: 90 }, () => ({
  left: `${rand(0, 100)}%`,
  top: `${rand(0, 100)}%`,
  size: `${rand(1, 2.6)}px`,
  delay: `${rand(0, 4)}s`,
  duration: `${rand(2, 5)}s`,
}))

const embers = Array.from({ length: 22 }, () => ({
  left: `${rand(0, 100)}%`,
  size: `${rand(2, 5)}px`,
  delay: `${rand(0, 12)}s`,
  duration: `${rand(9, 18)}s`,
  gold: Math.random() > 0.4,
}))
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-abyss-950" aria-hidden="true">
    <!-- nebula -->
    <div class="absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-arcane-600/25 blur-[120px]" />
    <div class="absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full bg-fuchsia-700/15 blur-[120px]" />
    <div class="absolute left-1/2 top-1/3 h-[30vmax] w-[30vmax] -translate-x-1/2 rounded-full bg-rune-500/10 blur-[100px]" />

    <!-- stars -->
    <span
      v-for="(s, i) in stars"
      :key="'s' + i"
      class="absolute animate-twinkle rounded-full bg-white"
      :style="{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.duration }"
    />

    <!-- fog -->
    <div class="fog absolute inset-x-[-20%] bottom-0 h-1/2 animate-drift opacity-60" />

    <!-- embers -->
    <span
      v-for="(e, i) in embers"
      :key="'e' + i"
      class="absolute -bottom-4 animate-rise rounded-full"
      :class="e.gold ? 'bg-rune-300 shadow-[0_0_8px_2px_rgba(245,196,81,0.7)]' : 'bg-arcane-300 shadow-[0_0_8px_2px_rgba(167,139,250,0.7)]'"
      :style="{ left: e.left, width: e.size, height: e.size, animationDelay: e.delay, animationDuration: e.duration }"
    />

    <!-- vignette -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,3,13,0.85)_100%)]" />
  </div>
</template>

<style scoped>
.fog {
  background:
    radial-gradient(ellipse 40% 60% at 20% 100%, rgba(139, 92, 246, 0.18), transparent 70%),
    radial-gradient(ellipse 35% 50% at 60% 100%, rgba(196, 181, 253, 0.12), transparent 70%),
    radial-gradient(ellipse 45% 55% at 90% 100%, rgba(139, 92, 246, 0.15), transparent 70%);
  filter: blur(20px);
}
</style>
