<script setup lang="ts">
// Minimal line-icon set (24x24, stroke based) so the theme isn't tied to emoji.
const props = defineProps<{ name: string; size?: number }>()

const paths: Record<string, string> = {
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z M9 4v14 M15 6v14',
  card: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z M12 8l1.8 3.6L12 15l-1.8-3.4Z M8 6h.01 M16 18h.01',
  hourglass: 'M6 2h12 M6 22h12 M7 2c0 5 5 6 5 10s-5 5-5 10 M17 2c0 5-5 6-5 10s5 5 5 10',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z M4 21a2 2 0 0 1 2-2h13v2H6 M9 7h6',
  quill: 'M20 4C10 4 6 10 5 19 M20 4c-1 6-5 10-11 11 M5 19l-1 2',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  orb: 'M12 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M9 8a3 3 0 0 1 3-2 M7 21h10 M8 17l-1 4 M16 17l1 4',
  scroll: 'M8 3h11a2 2 0 0 1 0 4h-1v12a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1V5a2 2 0 0 1 1-2Z M7 17h9 M11 8h4 M11 12h4',
  castle: 'M3 21V9l3 2V7l3 2V4h6v5l3-2v4l3-2v12Z M10 21v-4a2 2 0 0 1 4 0v4',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M3 12h18 M12 3c3 3 3 15 0 18 M12 3c-3 3-3 15 0 18',
  key: 'M14 10a4 4 0 1 0-3.9 4L10 14H8v2H6v2H3v-3l7.1-7.1 M15 7h.01',
  lock: 'M6 11h12v10H6Z M8 11V8a4 4 0 0 1 8 0v3 M12 15v2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h11',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8L16.5 19.5l1.8-.7Z',
}

const d = computed(() => paths[props.name] ?? paths.sparkle)
</script>

<template>
  <svg
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="d" />
  </svg>
</template>
