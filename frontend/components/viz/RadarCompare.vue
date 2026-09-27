<script setup lang="ts">
import { Chart, Filler, Legend, LineElement, PointElement, RadarController, RadialLinearScale, Tooltip } from 'chart.js'
import { VIZ } from '~/utils/viz'

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// Radar comparing up to two series (e.g. a student vs. the class average), values in %.
const props = defineProps<{
  labels: string[]
  series: { label: string; values: number[] }[]
}>()

const canvas = ref<HTMLCanvasElement>()
let chart: Chart | null = null
const colors = [VIZ.series1, VIZ.series2]

function build() {
  chart?.destroy()
  chart = new Chart(canvas.value!, {
    type: 'radar',
    data: {
      labels: props.labels,
      datasets: props.series.map((s, i) => ({
        label: s.label,
        data: s.values,
        borderColor: colors[i],
        backgroundColor: `${colors[i]}33`,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: colors[i],
        pointBorderColor: '#120c24',
        pointBorderWidth: 2,
        fill: i === 0,
        borderDash: i === 1 ? [6, 4] : [],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? false : undefined,
      scales: {
        r: {
          beginAtZero: true,
          angleLines: { color: VIZ.grid },
          grid: { color: VIZ.grid },
          pointLabels: { color: VIZ.textPrimary, font: { family: 'Kanit', size: 12 } },
          ticks: { display: false, stepSize: 10 },
        },
      },
      plugins: {
        legend: { position: 'bottom', labels: { color: VIZ.textSecondary, font: { family: 'Kanit' }, usePointStyle: true } },
        tooltip: {
          backgroundColor: '#0b0718',
          borderColor: 'rgba(245,196,81,.4)',
          borderWidth: 1,
          titleFont: { family: 'Kanit' },
          bodyFont: { family: 'Kanit' },
          callbacks: { label: (c) => ` ${c.dataset.label}: ${c.formattedValue}%` },
        },
      },
    },
  })
}

onMounted(build)
watch(() => props.series, build, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="relative h-full w-full">
    <canvas ref="canvas" role="img" :aria-label="`กราฟเรดาร์ ${series.map((s) => s.label).join(' เทียบ ')}`" />
  </div>
</template>
