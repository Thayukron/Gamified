<script setup lang="ts">
// Rotating arcane sigil. Outer ring carries runes (Elder Futhark) on a text path.
const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹ ᚺᚾᛁᛃᛇᛈᛉᛊ ᛏᛒᛖᛗᛚᛜᛞᛟ '.repeat(2)
const uid = `mc-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <div class="relative aspect-square" aria-hidden="true">
    <!-- outer rune ring -->
    <svg viewBox="0 0 200 200" class="absolute inset-0 h-full w-full animate-spin-slow text-rune-400/70">
      <defs>
        <path :id="uid" d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" stroke-width="0.6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" stroke-width="0.6" />
      <text fill="currentColor" font-size="10" letter-spacing="3">
        <textPath :href="`#${uid}`">{{ runes }}</textPath>
      </text>
    </svg>
    <!-- inner geometry -->
    <svg viewBox="0 0 200 200" class="absolute inset-0 h-full w-full animate-spin-rev text-arcane-300/60">
      <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 4" />
      <polygon points="100,32 159,134 41,134" fill="none" stroke="currentColor" stroke-width="0.7" />
      <polygon points="100,168 41,66 159,66" fill="none" stroke="currentColor" stroke-width="0.7" />
      <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" stroke-width="0.6" />
      <g fill="currentColor">
        <circle cx="100" cy="30" r="2" /><circle cx="160.6" cy="65" r="2" /><circle cx="160.6" cy="135" r="2" />
        <circle cx="100" cy="170" r="2" /><circle cx="39.4" cy="135" r="2" /><circle cx="39.4" cy="65" r="2" />
      </g>
    </svg>
    <!-- core glow -->
    <div class="absolute inset-[30%] rounded-full bg-rune-400/20 blur-2xl" />
    <div class="absolute inset-0 flex items-center justify-center">
      <slot />
    </div>
  </div>
</template>
