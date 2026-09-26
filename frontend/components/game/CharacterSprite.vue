<script setup lang="ts">
// Chibi-style SVG characters with expressions. kinds: mage (with accessories), owl, golem.
import type { CharacterDef, Expr } from '~/utils/game'

const props = defineProps<{ def: CharacterDef; expr?: Expr }>()

const e = computed<Expr>(() => props.expr ?? 'neutral')
const has = (a: string) => props.def.accessory?.includes(a)
const robe = computed(() => props.def.robe ?? '#6d28d9')
const skin = computed(() => props.def.skin ?? '#fde2cf')
const hair = computed(() => props.def.hair ?? '#1f2937')
const iris = computed(() => props.def.eyes ?? '#7c3aed')
const glow = computed(() => props.def.color ?? '#f5c451')
const uid = `c${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <!-- ─────────── MAGE ─────────── -->
  <svg v-if="def.kind === 'mage'" viewBox="0 -40 200 320" class="h-full w-full overflow-visible">
    <defs>
      <linearGradient :id="`${uid}-robe`" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="robe" />
        <stop offset="1" :stop-color="robe" stop-opacity=".75" />
      </linearGradient>
    </defs>
    <ellipse cx="100" cy="272" rx="58" ry="8" fill="#000" opacity=".35" />

    <!-- body -->
    <path d="M60 168 Q100 150 140 168 L166 262 Q100 282 34 262 Z" :fill="`url(#${uid}-robe)`" />
    <path d="M34 262 Q100 282 166 262" fill="none" stroke="#f5c451" stroke-width="4" opacity=".8" />
    <path d="M100 162 L100 274" stroke="#000" stroke-opacity=".2" stroke-width="3" />
    <circle cx="100" cy="186" r="6" fill="#f5c451" />
    <!-- sleeves + hands -->
    <path d="M64 176 Q38 206 48 238" fill="none" :stroke="robe" stroke-width="22" stroke-linecap="round" />
    <path d="M136 176 Q162 206 152 238" fill="none" :stroke="robe" stroke-width="22" stroke-linecap="round" />
    <circle cx="49" cy="244" r="9" :fill="skin" />
    <circle cx="151" cy="244" r="9" :fill="skin" />

    <!-- back hair / hood -->
    <circle v-if="has('hood')" cx="100" cy="108" r="64" :fill="robe" />
    <path v-else d="M46 110 Q40 40 100 42 Q160 40 154 110 L158 160 Q130 150 128 120 L72 120 Q70 150 42 160 Z" :fill="hair" />

    <!-- cat ears -->
    <template v-if="has('cat')">
      <path d="M54 80 L50 30 L88 58 Z" :fill="hair" /><path d="M60 72 L58 42 L80 60 Z" fill="#fda4af" />
      <path d="M146 80 L150 30 L112 58 Z" :fill="hair" /><path d="M140 72 L142 42 L120 60 Z" fill="#fda4af" />
    </template>

    <!-- head -->
    <circle cx="100" cy="110" r="50" :fill="skin" />

    <!-- fringe / hood rim -->
    <path v-if="has('hood')" d="M42 118 Q44 44 100 42 Q156 44 158 118 Q146 70 100 68 Q54 70 42 118 Z" :fill="robe" stroke="#000" stroke-opacity=".15" />
    <path v-else d="M50 106 Q52 52 100 54 Q148 52 150 106 Q138 80 120 86 Q106 68 92 84 Q72 74 50 106 Z" :fill="hair" />

    <!-- blush -->
    <ellipse cx="70" cy="132" rx="9" ry="5" fill="#fb7185" opacity=".35" />
    <ellipse cx="130" cy="132" rx="9" ry="5" fill="#fb7185" opacity=".35" />

    <!-- eyes -->
    <g v-for="x in [80, 120]" :key="x" :transform="`translate(${x} 116)`">
      <template v-if="e === 'happy'">
        <path d="M-8 2 Q0 -9 8 2" fill="none" stroke="#1e1b2e" stroke-width="4" stroke-linecap="round" />
      </template>
      <template v-else>
        <ellipse :rx="e === 'surprised' ? 9 : 7" :ry="e === 'surprised' ? 11 : e === 'determined' ? 7 : 9" :fill="iris" />
        <ellipse :rx="e === 'surprised' ? 4 : 4" :ry="e === 'surprised' ? 5 : 5" fill="#1e1b2e" />
        <circle cx="2.5" cy="-3.5" r="2.6" fill="#fff" />
        <circle cx="-3" cy="3" r="1.2" fill="#fff" opacity=".8" />
      </template>
      <!-- brows -->
      <path v-if="e === 'sad'" :d="x < 100 ? 'M-10 -12 L6 -16' : 'M-6 -16 L10 -12'" stroke="#1e1b2e" stroke-width="3" stroke-linecap="round" />
      <path v-if="e === 'determined'" :d="x < 100 ? 'M-10 -16 L7 -11' : 'M-7 -11 L10 -16'" stroke="#1e1b2e" stroke-width="3.5" stroke-linecap="round" />
    </g>

    <!-- mouth -->
    <path v-if="e === 'neutral'" d="M93 140 Q100 145 107 140" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round" />
    <path v-else-if="e === 'happy'" d="M89 136 Q100 152 111 136 Z" fill="#9f1239" stroke="#7f1d1d" stroke-width="2" stroke-linejoin="round" />
    <ellipse v-else-if="e === 'surprised'" cx="100" cy="143" rx="5" ry="7" fill="#9f1239" />
    <path v-else-if="e === 'sad'" d="M92 145 Q100 138 108 145" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round" />
    <path v-else d="M92 141 Q102 144 109 138" fill="none" stroke="#7f1d1d" stroke-width="3" stroke-linecap="round" />

    <!-- cat whiskers -->
    <g v-if="has('cat')" stroke="#1e1b2e" stroke-width="1.5" opacity=".6">
      <path d="M58 132 L40 128 M58 137 L40 140" /><path d="M142 132 L160 128 M142 137 L160 140" />
    </g>

    <!-- glasses -->
    <g v-if="has('glasses')" fill="none" stroke="#f5c451" stroke-width="3">
      <circle cx="80" cy="116" r="14" /><circle cx="120" cy="116" r="14" /><path d="M94 114 Q100 110 106 114" />
    </g>

    <!-- witch hat -->
    <g v-if="has('hat')">
      <path d="M58 64 Q84 0 138 -34 Q118 10 142 64 Z" :fill="robe" stroke="#000" stroke-opacity=".2" />
      <rect x="62" y="50" width="78" height="10" rx="3" fill="#f5c451" />
      <ellipse cx="100" cy="64" rx="76" ry="13" :fill="robe" stroke="#000" stroke-opacity=".25" />
      <path d="M126 -24 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill="#fde68a" />
    </g>
  </svg>

  <!-- ─────────── OWL (Lumin) ─────────── -->
  <svg v-else-if="def.kind === 'owl'" viewBox="0 -40 200 320" class="h-full w-full overflow-visible">
    <defs>
      <radialGradient :id="`${uid}-owl`" cx=".5" cy=".35" r=".7">
        <stop offset="0" stop-color="#fffbeb" />
        <stop offset=".6" stop-color="#fde68a" />
        <stop offset="1" :stop-color="glow" />
      </radialGradient>
    </defs>
    <circle cx="100" cy="150" r="96" :fill="glow" opacity=".12" />
    <ellipse cx="100" cy="272" rx="40" ry="6" fill="#000" opacity=".25" />
    <!-- wings -->
    <g class="wing-l"><ellipse cx="42" cy="170" rx="22" ry="48" :fill="glow" transform="rotate(20 42 170)" /></g>
    <g class="wing-r"><ellipse cx="158" cy="170" rx="22" ry="48" :fill="glow" transform="rotate(-20 158 170)" /></g>
    <!-- ear tufts -->
    <path d="M52 92 L56 42 L86 80 Z" :fill="glow" /><path d="M148 92 L144 42 L114 80 Z" :fill="glow" />
    <!-- body -->
    <ellipse cx="100" cy="158" rx="64" ry="80" :fill="`url(#${uid}-owl)`" />
    <ellipse cx="100" cy="190" rx="38" ry="44" fill="#fff7ed" opacity=".85" />
    <path d="M86 180 l6 6 6-6 M102 180 l6 6 6-6 M94 198 l6 6 6-6" fill="none" :stroke="glow" stroke-width="2.5" stroke-linecap="round" />
    <!-- face discs -->
    <circle cx="76" cy="128" r="27" fill="#fff7ed" />
    <circle cx="124" cy="128" r="27" fill="#fff7ed" />
    <!-- eyes -->
    <g v-for="x in [76, 124]" :key="x" :transform="`translate(${x} 128)`">
      <path v-if="e === 'happy'" d="M-11 3 Q0 -11 11 3" fill="none" stroke="#1e1b2e" stroke-width="5" stroke-linecap="round" />
      <template v-else>
        <circle :r="e === 'surprised' ? 18 : 15" fill="#1e1b2e" />
        <circle :r="e === 'surprised' ? 8 : 7" fill="#f59e0b" opacity=".6" />
        <circle cx="5" cy="-6" r="5" fill="#fff" />
        <circle cx="-5" cy="5" r="2" fill="#fff" opacity=".8" />
        <!-- lids -->
        <path v-if="e === 'determined'" d="M-17 -8 L17 -2 L17 -18 L-17 -18 Z" fill="#fff7ed" :transform="x > 100 ? 'scale(-1 1)' : ''" />
        <path v-if="e === 'sad'" d="M-17 -2 L17 -10 L17 -18 L-17 -18 Z" fill="#fff7ed" :transform="x > 100 ? 'scale(-1 1)' : ''" />
      </template>
    </g>
    <!-- beak -->
    <path d="M92 146 L108 146 L100 162 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round" />
    <path v-if="e === 'surprised' || e === 'happy'" d="M94 150 L106 150 L100 158 Z" fill="#9f1239" />
    <!-- feet -->
    <path d="M80 236 l-6 10 M84 236 v12 M88 236 l6 10 M112 236 l-6 10 M116 236 v12 M120 236 l6 10" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" />
  </svg>

  <!-- ─────────── GOLEM ─────────── -->
  <svg v-else viewBox="0 -40 200 320" class="h-full w-full overflow-visible">
    <ellipse cx="100" cy="272" rx="74" ry="9" fill="#000" opacity=".35" />
    <!-- arms -->
    <rect x="14" y="140" width="36" height="96" rx="14" fill="#475569" stroke="#1e293b" stroke-width="3" />
    <rect x="150" y="140" width="36" height="96" rx="14" fill="#475569" stroke="#1e293b" stroke-width="3" />
    <!-- body -->
    <rect x="42" y="128" width="116" height="136" rx="24" fill="#64748b" stroke="#1e293b" stroke-width="3" />
    <path d="M60 150 l14 18 -8 22 M140 240 l-16 -14 6 -18" fill="none" stroke="#334155" stroke-width="3" />
    <circle cx="100" cy="196" r="20" :fill="glow" opacity=".25" />
    <path d="M100 180 l10 16 -10 16 -10 -16 Z" :fill="glow" class="rune-pulse" />
    <!-- moss -->
    <path d="M42 150 q12 -10 26 -2 q10 -8 22 0" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round" opacity=".7" />
    <!-- head -->
    <rect x="52" y="40" width="96" height="92" rx="22" fill="#94a3b8" stroke="#1e293b" stroke-width="3" />
    <path d="M70 52 l10 12 M132 110 l-12 -8" stroke="#475569" stroke-width="3" />
    <!-- eyes -->
    <g v-for="x in [80, 120]" :key="x" :transform="`translate(${x} 84)`">
      <path v-if="e === 'happy'" d="M-10 4 Q0 -8 10 4" fill="none" :stroke="glow" stroke-width="6" stroke-linecap="round" />
      <template v-else>
        <rect :x="e === 'surprised' ? -11 : -9" :y="e === 'determined' ? -4 : e === 'surprised' ? -11 : -8" :width="e === 'surprised' ? 22 : 18" :height="e === 'determined' ? 8 : e === 'surprised' ? 22 : 16" rx="4" :fill="glow" />
        <rect x="-9" y="-8" width="18" height="16" rx="4" :fill="glow" opacity=".35" filter="blur(4px)" />
      </template>
      <path v-if="e === 'sad'" :d="x < 100 ? 'M-12 -12 L8 -18' : 'M-8 -18 L12 -12'" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />
    </g>
    <!-- mouth -->
    <rect v-if="e !== 'surprised'" x="84" y="108" width="32" height="6" rx="3" fill="#334155" :transform="e === 'sad' ? 'rotate(-6 100 111)' : ''" />
    <rect v-else x="90" y="104" width="20" height="14" rx="5" fill="#334155" />
  </svg>
</template>

<style scoped>
.wing-l { transform-origin: 60px 150px; animation: flap 1.6s ease-in-out infinite; }
.wing-r { transform-origin: 140px 150px; animation: flap-r 1.6s ease-in-out infinite; }
@keyframes flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-12deg); } }
@keyframes flap-r { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(12deg); } }
.rune-pulse { animation: rune 2s ease-in-out infinite; }
@keyframes rune { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
</style>
