<script setup lang="ts">
// Gradient icon tile for the staff (teacher/admin) pages: each feature keeps its own hue.
const props = withDefaults(defineProps<{ name: string; tone?: Tone; size?: 'sm' | 'md' | 'lg' }>(), { tone: 'indigo', size: 'md' })

type Tone = 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'fuchsia' | 'slate'
const TONES: Record<Tone, string> = {
  indigo: 'from-indigo-500 to-blue-600 shadow-indigo-500/30',
  violet: 'from-violet-500 to-purple-600 shadow-violet-500/30',
  sky: 'from-sky-400 to-blue-500 shadow-sky-500/30',
  emerald: 'from-emerald-400 to-teal-600 shadow-emerald-500/30',
  amber: 'from-amber-400 to-orange-500 shadow-amber-500/30',
  rose: 'from-rose-400 to-pink-600 shadow-rose-500/30',
  cyan: 'from-cyan-400 to-sky-600 shadow-cyan-500/30',
  fuchsia: 'from-fuchsia-500 to-violet-600 shadow-fuchsia-500/30',
  slate: 'from-slate-500 to-slate-700 shadow-slate-500/20',
}
const SIZES = { sm: ['h-8 w-8 rounded-lg', 16], md: ['h-11 w-11 rounded-xl', 20], lg: ['h-14 w-14 rounded-2xl', 26] } as const
const box = computed(() => SIZES[props.size][0])
const px = computed(() => SIZES[props.size][1])
</script>

<template>
  <span class="flex shrink-0 items-center justify-center bg-gradient-to-br text-snow shadow-lg" :class="[box, TONES[tone]]">
    <AppIcon :name="name" :size="px" :stroke="2" />
  </span>
</template>
