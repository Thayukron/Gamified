<script setup lang="ts">
// Built-in illustrated backdrops (gradients + SVG silhouettes). A URL renders as a cover image.
const props = defineProps<{ name?: string }>()

// Painted artwork for the built-in scenes (public/backgrounds); the SVG versions remain as fallback.
const PAINTED_BACKGROUNDS = ['night', 'gate', 'hall', 'library', 'corridor', 'courtyard', 'crystal', 'market', 'alley', 'sky', 'observatory']
const src = computed(() => {
  if (!props.name) return null
  if (/^(https?:)?\/|^data:/.test(props.name)) return props.name
  return PAINTED_BACKGROUNDS.includes(props.name) ? `/backgrounds/${props.name}.webp` : null
})

const gradients: Record<string, string> = {
  night: 'radial-gradient(ellipse at 70% 20%, #2d1f5e 0%, #0b0718 55%, #05030d 100%)',
  gate: 'radial-gradient(ellipse at 50% 60%, #4c1d95 0%, #1f1542 45%, #05030d 100%)',
  hall: 'radial-gradient(ellipse at 50% 30%, #78350f55 0%, #1f1542 50%, #05030d 100%)',
  corridor: 'radial-gradient(ellipse at 50% 50%, #3b2a7a 0%, #140d2b 45%, #05030d 100%)',
  library: 'radial-gradient(ellipse at 50% 20%, #5b3a1a66 0%, #1a1230 50%, #05030d 100%)',
  courtyard: 'radial-gradient(ellipse at 50% 15%, #1e3a8a 0%, #0f172a 50%, #05030d 100%)',
  crystal: 'radial-gradient(ellipse at 50% 45%, #7c3aed 0%, #2d1f5e 35%, #05030d 100%)',
  market: 'radial-gradient(ellipse at 50% 10%, #9a3412aa 0%, #3b0764 45%, #0b0718 100%)',
  alley: 'radial-gradient(ellipse at 50% 40%, #44403c 0%, #1c1917 50%, #05030d 100%)',
  sky: 'linear-gradient(180deg, #020617 0%, #1e1b4b 55%, #312e81 100%)',
  observatory: 'radial-gradient(ellipse at 50% 20%, #1e3a8a 0%, #172554 40%, #05030d 100%)',
}

const motes = Array.from({ length: 14 }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${40 + Math.random() * 60}%`,
  delay: `${Math.random() * 6}s`,
  dur: `${6 + Math.random() * 6}s`,
}))
const skyStars = Array.from({ length: 60 }, () => ({ x: Math.random() * 400, y: Math.random() * 420, r: Math.random() * 1.6 + 0.4, d: Math.random() * 3 }))
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
        <img v-if="src" :src="src" alt="" class="bg-img h-full w-full object-cover">
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

          <!-- market: lantern strings and stalls -->
          <svg v-else-if="name === 'market'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <path d="M-10 90 Q200 170 410 90 M-10 170 Q200 240 410 170" fill="none" stroke="#fbbf24" stroke-opacity=".35" />
            <g v-for="i in 9" :key="'la' + i" class="lantern" :style="{ animationDelay: `${i * 0.3}s` }">
              <ellipse :cx="i * 44 - 20" :cy="100 + Math.sin(i) * 12 + (i % 2) * 70" rx="11" ry="15" fill="#f97316" opacity=".9" />
              <ellipse :cx="i * 44 - 20" :cy="100 + Math.sin(i) * 12 + (i % 2) * 70" rx="24" ry="28" fill="#fbbf24" opacity=".14" />
            </g>
            <g fill="#05030d" opacity=".9">
              <path d="M0 330 h110 l-15 -30 h-80 Z M5 330 h100 v270 H5 Z" />
              <path d="M290 330 h110 v270 H290 Z M280 330 l15 -30 h90 l15 30 Z" />
              <path d="M150 380 h100 v220 h-100 Z M140 380 l20 -26 h80 l20 26 Z" />
            </g>
            <g fill="#fbbf24" opacity=".25"><rect x="20" y="350" width="70" height="8" /><rect x="305" y="350" width="80" height="8" /><rect x="165" y="400" width="70" height="8" /></g>
          </svg>

          <!-- alley: narrow walls with glowing footprints -->
          <svg v-else-if="name === 'alley'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <path d="M0 0 L150 200 L150 480 L0 600 Z" fill="#0c0a09" /><path d="M400 0 L250 200 L250 480 L400 600 Z" fill="#0c0a09" />
            <rect x="30" y="120" width="40" height="60" fill="#fbbf24" opacity=".25" /><rect x="320" y="160" width="36" height="50" fill="#fbbf24" opacity=".18" />
            <g fill="#fbbf24" opacity=".6">
              <ellipse cx="190" cy="560" rx="8" ry="12" /><ellipse cx="212" cy="520" rx="7" ry="11" /><ellipse cx="192" cy="482" rx="6" ry="9" /><ellipse cx="208" cy="450" rx="5" ry="8" />
            </g>
          </svg>

          <!-- sky: open starfield with shooting star -->
          <svg v-else-if="name === 'sky'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <circle v-for="(s, i) in skyStars" :key="'st' + i" :cx="s.x" :cy="s.y" :r="s.r" fill="#fff" class="twinkle" :style="{ animationDelay: `${s.d}s` }" />
            <path d="M60 80 L200 150" stroke="url(#shoot)" stroke-width="2" class="shoot" />
            <defs><linearGradient id="shoot"><stop offset="0" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#fff" /></linearGradient></defs>
            <path d="M0 520 Q100 470 200 500 T400 480 V600 H0 Z" fill="#05030d" />
            <path d="M270 500 v-60 a30 30 0 0 1 60 0 v60 Z" fill="#05030d" />
          </svg>

          <!-- observatory: dome with telescope -->
          <svg v-else-if="name === 'observatory'" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" class="absolute inset-0 h-full w-full">
            <path d="M20 330 a180 180 0 0 1 360 0 Z" fill="#0b1025" stroke="#93c5fd" stroke-opacity=".25" stroke-width="3" />
            <path d="M170 150 a40 180 0 0 1 60 0 L230 330 L170 330 Z" fill="#1e3a8a" opacity=".6" />
            <circle v-for="(s, i) in skyStars.slice(0, 12)" :key="'ds' + i" :cx="175 + (s.x % 50)" :cy="160 + (s.y % 150)" r="1.4" fill="#fff" class="twinkle" :style="{ animationDelay: `${s.d}s` }" />
            <g transform="rotate(-35 200 360)">
              <rect x="150" y="330" width="130" height="34" rx="10" fill="#f5c451" opacity=".85" />
              <rect x="270" y="324" width="22" height="46" rx="6" fill="#b7791f" />
            </g>
            <path d="M200 380 l-40 120 M200 380 l40 120 M200 380 v120" stroke="#94a3b8" stroke-width="6" />
            <rect x="0" y="500" width="400" height="100" fill="#05030d" />
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
    <span
      v-for="(m, i) in motes"
      :key="'m' + i"
      class="mote absolute h-1.5 w-1.5 rounded-full bg-rune-200"
      :style="{ left: m.left, top: m.top, animationDelay: m.delay, animationDuration: m.dur }"
    />
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(5,3,13,0.8)_100%)]" />
  </div>
</template>

<style scoped>
.bg-img { animation: kenburns 30s ease-in-out infinite alternate; }
@keyframes kenburns { from { transform: scale(1); } to { transform: scale(1.08); } }
.mote { box-shadow: 0 0 8px 2px rgba(253, 230, 138, 0.6); animation: mote 8s ease-in-out infinite; opacity: 0; }
@keyframes mote { 0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: .8; } 100% { transform: translate(30px, -160px); opacity: 0; } }
.lantern { animation: sway 3s ease-in-out infinite; transform-box: fill-box; transform-origin: top center; }
@keyframes sway { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }
.twinkle { animation: tw 2.5s ease-in-out infinite; }
@keyframes tw { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
.shoot { stroke-dasharray: 160; animation: shoot 4s ease-in infinite; }
@keyframes shoot { 0% { stroke-dashoffset: 160; opacity: 0; } 10% { opacity: 1; } 30%, 100% { stroke-dashoffset: -160; opacity: 0; } }
</style>
