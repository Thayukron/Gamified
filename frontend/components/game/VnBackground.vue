<script setup lang="ts">
// Built-in illustrated backdrops (gradients + SVG silhouettes). A URL renders as a cover image.
const props = defineProps<{ name?: string }>()

const isUrl = computed(() => !!props.name && /^(https?:)?\/|^data:/.test(props.name))

const gradients: Record<string, string> = {
  night: 'radial-gradient(ellipse at 70% 20%, #2d1f5e 0%, #0b0718 55%, #05030d 100%)',
  gate: 'radial-gradient(ellipse at 50% 60%, #4c1d95 0%, #1f1542 45%, #05030d 100%)',
  hall: 'radial-gradient(ellipse at 50% 30%, #78350f55 0%, #1f1542 50%, #05030d 100%)',
  corridor: 'radial-gradient(ellipse at 50% 50%, #3b2a7a 0%, #140d2b 45%, #05030d 100%)',
  library: 'radial-gradient(ellipse at 50% 20%, #5b3a1a66 0%, #1a1230 50%, #05030d 100%)',
  courtyard: 'radial-gradient(ellipse at 50% 15%, #1e3a8a 0%, #0f172a 50%, #05030d 100%)',
  crystal: 'radial-gradient(ellipse at 50% 45%, #7c3aed 0%, #2d1f5e 35%, #05030d 100%)',
}
</script>

<template>
  <div class="absolute inset-0 overflow-hidden">
    <Transition
      enter-active-class="transition-opacity duration-1000"
      leave-active-class="transition-opacity duration-1000 absolute inset-0"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div :key="name" class="absolute inset-0">
        <img v-if="isUrl" :src="name" alt="" class="h-full w-full object-cover">
        <template v-else>
          <div class="absolute inset-0" :style="{ background: gradients[name || 'night'] || gradients.night }" />

          <!-- night: moon behind a window -->
          <svg v-if="name === 'night' || !name" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <circle cx="290" cy="140" r="55" fill="#fde68a" opacity=".85" />
            <circle cx="290" cy="140" r="110" fill="#fde68a" opacity=".08" />
            <g fill="none" stroke="#05030d" stroke-width="10">
              <rect x="190" y="50" width="200" height="260" rx="100" />
              <line x1="290" y1="50" x2="290" y2="310" />
              <line x1="190" y1="190" x2="390" y2="190" />
            </g>
            <rect x="0" y="480" width="400" height="120" fill="#05030d" opacity=".9" />
          </svg>

          <!-- gate: stone arch -->
          <svg v-else-if="name === 'gate'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <path d="M80 600V260a120 120 0 0 1 240 0v340Z" fill="#05030d" opacity=".85" />
            <path d="M110 600V270a90 90 0 0 1 180 0v330Z" fill="#a78bfa" opacity=".18" />
            <path d="M110 600V270a90 90 0 0 1 180 0v330" fill="none" stroke="#f5c451" stroke-width="2" opacity=".6" />
            <circle cx="200" cy="330" r="60" fill="#f5c451" opacity=".12" />
          </svg>

          <!-- hall: pillars -->
          <svg v-else-if="name === 'hall'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <g fill="#05030d" opacity=".85">
              <rect x="10" y="80" width="50" height="520" /><rect x="110" y="140" width="34" height="460" />
              <rect x="256" y="140" width="34" height="460" /><rect x="340" y="80" width="50" height="520" />
              <rect x="0" y="60" width="400" height="30" />
            </g>
            <ellipse cx="200" cy="560" rx="160" ry="20" fill="#f5c451" opacity=".12" />
          </svg>

          <!-- corridor: receding arches -->
          <svg v-else-if="name === 'corridor'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <g fill="none" stroke="#c4b5fd" opacity=".25">
              <path d="M40 600V200a160 160 0 0 1 320 0v400" stroke-width="6" />
              <path d="M100 600V240a100 100 0 0 1 200 0v360" stroke-width="4" />
              <path d="M145 600V270a55 55 0 0 1 110 0v330" stroke-width="3" />
              <path d="M175 600V290a25 25 0 0 1 50 0v310" stroke-width="2" />
            </g>
            <circle cx="200" cy="300" r="30" fill="#f5c451" opacity=".2" />
          </svg>

          <!-- library: shelves -->
          <svg v-else-if="name === 'library'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <g fill="#05030d" opacity=".8">
              <rect x="0" y="0" width="110" height="600" /><rect x="290" y="0" width="110" height="600" />
            </g>
            <g fill="#a78bfa" opacity=".25">
              <rect v-for="i in 8" :key="'l' + i" x="12" :y="i * 70" width="86" height="6" />
              <rect v-for="i in 8" :key="'r' + i" x="302" :y="i * 70" width="86" height="6" />
            </g>
            <g fill="#f5c451" opacity=".35">
              <rect v-for="i in 8" :key="'b' + i" :x="16 + (i % 4) * 20" :y="i * 70 - 34" width="12" height="34" />
              <rect v-for="i in 8" :key="'c' + i" :x="306 + (i % 3) * 26" :y="i * 70 - 30" width="14" height="30" />
            </g>
          </svg>

          <!-- courtyard: big moon and trees -->
          <svg v-else-if="name === 'courtyard'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <circle cx="200" cy="150" r="55" fill="#e0e7ff" opacity=".55" />
            <circle cx="200" cy="150" r="120" fill="#c7d2fe" opacity=".06" />
            <path d="M0 470q60-40 120-10t140-20 140 20v140H0Z" fill="#05030d" />
            <path d="M40 470l30-120 30 120Z M320 470l25-100 25 100Z" fill="#05030d" />
          </svg>

          <!-- crystal: floating gem inside a sigil -->
          <template v-else-if="name === 'crystal'">
            <div class="absolute left-1/2 top-[38%] w-[90vmin] max-w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-70">
              <MagicCircle />
            </div>
            <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
              <g class="origin-center animate-float" style="transform-box: fill-box">
                <path d="M200 150l45 80-45 110-45-110Z" fill="#c4b5fd" opacity=".85" />
                <path d="M200 150l45 80-45 20Z" fill="#fff" opacity=".45" />
                <path d="M200 340l-45-110 45 20Z" fill="#7c3aed" opacity=".6" />
              </g>
            </svg>
          </template>
        </template>
      </div>
    </Transition>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,3,13,0.8)_100%)]" />
  </div>
</template>
