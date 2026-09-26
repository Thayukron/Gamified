<script setup lang="ts">
// Lightweight SVG radar chart; values are scaled to the largest value (or `max`).
const props = defineProps<{
  labels: string[]
  values: number[]
  max?: number
  color?: string
}>()

const size = 260
const c = size / 2
const r = 90
const n = computed(() => props.labels.length)
const top = computed(() => props.max ?? Math.max(1, ...props.values))

function point(i: number, ratio: number) {
  const a = (Math.PI * 2 * i) / n.value - Math.PI / 2
  return [c + Math.cos(a) * r * ratio, c + Math.sin(a) * r * ratio]
}

const rings = [0.25, 0.5, 0.75, 1]
const ringPath = (ratio: number) => props.labels.map((_, i) => point(i, ratio).join(',')).join(' ')
const shape = computed(() => props.values.map((v, i) => point(i, Math.max(v / top.value, 0.04)).join(',')).join(' '))
</script>

<template>
  <svg :viewBox="`0 0 ${size} ${size}`" class="h-full w-full overflow-visible">
    <polygon v-for="ring in rings" :key="ring" :points="ringPath(ring)" fill="none" stroke="rgba(196,181,253,0.18)" />
    <line
      v-for="(_, i) in labels"
      :key="'ax' + i"
      :x1="c" :y1="c" :x2="point(i, 1)[0]" :y2="point(i, 1)[1]"
      stroke="rgba(196,181,253,0.15)"
    />
    <polygon :points="shape" :fill="color ?? '#f5c451'" fill-opacity="0.25" :stroke="color ?? '#f5c451'" stroke-width="2" class="radar-shape" />
    <circle
      v-for="(v, i) in values"
      :key="'pt' + i"
      :cx="point(i, Math.max(v / top, 0.04))[0]"
      :cy="point(i, Math.max(v / top, 0.04))[1]"
      r="3.5"
      :fill="color ?? '#f5c451'"
    />
    <text
      v-for="(label, i) in labels"
      :key="'lb' + i"
      :x="point(i, 1.28)[0]"
      :y="point(i, 1.28)[1]"
      text-anchor="middle"
      dominant-baseline="middle"
      class="fill-slate-300 text-[11px]"
    >{{ label }}</text>
  </svg>
</template>

<style scoped>
.radar-shape {
  transform-origin: center;
  transform-box: fill-box;
  animation: grow 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) both 0.3s;
}
@keyframes grow {
  from { transform: scale(0); opacity: 0; }
}
</style>
