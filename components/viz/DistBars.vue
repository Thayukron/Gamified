<script setup lang="ts">
import { pct, VIZ } from '~/utils/viz'

// Horizontal distribution bars (single series, one hue) with direct count + % labels and hover detail.
const props = defineProps<{
  rows: { key: string; label: string; sub?: string; value: number }[]
  total: number
  color?: string
  highlight?: string | null
  /** values are already percentages: show "42%" instead of "n (x%)" */
  percent?: boolean
}>()
const emit = defineEmits<{ pick: [key: string] }>()
const max = computed(() => Math.max(1, ...props.rows.map((r) => r.value)))
</script>

<template>
  <ul class="space-y-2.5">
    <li v-for="r in rows" :key="r.key">
      <button
        class="group w-full text-left"
        :title="percent ? `${r.label}: ${Math.round(r.value)}%` : `${r.label}: ${r.value} คน (${pct(r.value, total)}%) — คลิกเพื่อกรองรายชื่อ`"
        @click="emit('pick', r.key)"
      >
        <div class="mb-1 flex items-baseline justify-between gap-2 text-sm">
          <span class="truncate text-slate-200" :class="{ 'font-semibold text-rune-200': highlight === r.key }">
            {{ r.label }} <span v-if="r.sub" class="text-xs text-slate-500">{{ r.sub }}</span>
          </span>
          <span v-if="percent" class="shrink-0 tabular-nums text-slate-300">{{ Math.round(r.value) }}%</span>
          <span v-else class="shrink-0 tabular-nums text-slate-300">{{ r.value }} <span class="text-xs text-slate-500">({{ pct(r.value, total) }}%)</span></span>
        </div>
        <div class="h-3 rounded-full bg-white/5">
          <div
            class="h-full rounded-full transition-all duration-700 group-hover:brightness-125"
            :style="{ width: `${percent ? r.value : (r.value / max) * 100}%`, background: color ?? VIZ.series1, minWidth: r.value ? '4px' : '0' }"
          />
        </div>
      </button>
    </li>
  </ul>
</template>
