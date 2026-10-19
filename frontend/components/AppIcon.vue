<script setup lang="ts">
// Minimal line-icon set (24x24, stroke based) so the theme isn't tied to emoji.
const props = defineProps<{ name: string; size?: number; stroke?: number }>()

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
  // archetypes
  hammer: 'M14 6l4 4 M15 3l6 6-3 3-6-6Z M12 6 3 15l3 3 9-9',
  telescope: 'M4 14l12-7 2 4-12 7Z M16 7l2-1 2 4-2 1 M9 16l-2 5 M10 15l3 6',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 2-1 3-1a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z M7.5 11h.01 M10 7h.01 M15 7.5h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z M9 12l2 2 4-4',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5Z M5 19h14',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M15.5 8.5l-2 5-5 2 2-5Z',
  // controls
  volume: 'M4 9v6h4l5 4V5L8 9Z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
  mute: 'M4 9v6h4l5 4V5L8 9Z M17 9l5 6 M22 9l-5 6',
  play: 'M7 4l13 8-13 8Z',
  back: 'M15 18l-6-6 6-6',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M8.6 13.5l6.8 4 M15.4 6.5l-6.8 4',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 20h16',
  check: 'M5 12l5 5L20 7',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 2',
  ear: 'M7 10a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0 M10 10a2 2 0 0 1 4 0',
  hand: 'M8 13V5a1.5 1.5 0 0 1 3 0v6 M11 11V3.5a1.5 1.5 0 0 1 3 0V11 M14 11V5a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.7L8 14',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
  flag: 'M5 21V4 M5 4h11l-2 4 2 4H5',
  herb: 'M12 21V10 M12 14c-4 0-6-3-6-7 4 0 6 3 6 7Z M12 11c0-4 2-7 6-7 0 4-2 7-6 7Z',
  megaphone: 'M3 10v4h3l8 5V5L6 10Z M17 9a3 3 0 0 1 0 6 M6 14l1 5h3l-1-4',
  scale: 'M12 3v18 M8 21h8 M5 7h14 M5 7l-3 7a3 3 0 0 0 6 0Z M19 7l-3 7a3 3 0 0 0 6 0Z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7Z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z',
  lantern: 'M9 3h6 M12 3v2 M7 8a5 5 0 0 1 10 0v6a5 5 0 0 1-10 0Z M7 11h10 M10 19v2h4v-2',
  gem: 'M6 3h12l4 6-10 12L2 9Z M2 9h20 M9 3 7 9l5 12 5-12-2-6',
  bag: 'M5 8h14l-1 13H6Z M9 8V6a3 3 0 0 1 6 0v2',
  forward: 'M4 5l8 7-8 7Z M12 5l8 7-8 7Z',
  // staff / dashboard set
  home: "M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-6h4v6",
  plus: "M12 5v14 M5 12h14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M2 21a7 7 0 0 1 14 0 M16 3.5a4 4 0 0 1 0 7.5 M18 14.5a6 6 0 0 1 4 6.5",
  file: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z M14 3v5h5 M9 13h6 M9 17h6",
  clipboard: "M9 3h6v3H9Z M9 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-3 M9 13l2 2 4-4",
  list: "M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01",
  bulb: "M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z",
  database: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  sliders: "M4 6h9 M17 6h3 M15 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h11 M19 18h1 M17 16v4",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  x: "M6 6l12 12 M18 6 6 18",
  layers: "M12 3l9 5-9 5-9-5Z M3 13l9 5 9-5",
  trend: "M3 17l6-6 4 4 8-8 M15 7h6v6",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  chevron: "M9 6l6 6-6 6",
  grid: "M4 4h7v7H4Z M13 4h7v7h-7Z M4 13h7v7H4Z M13 13h7v7h-7Z",
  building: "M4 21V5l8-2v18 M12 7l8 2v12 M2 21h20 M7 9h2 M7 13h2 M7 17h2 M15 12h2 M15 16h2",
  calendar: "M4 6h16v15H4Z M4 10h16 M8 3v4 M16 3v4",
  graduation: "M2 9l10-5 10 5-10 5Z M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5 M22 9v6",
  sparkle:'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8L16.5 19.5l1.8-.7Z',
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
    :stroke-width="stroke ?? 1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="d" />
  </svg>
</template>
