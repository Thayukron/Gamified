<script setup lang="ts">
// Visual-novel style half-body characters drawn in SVG, with expressions.
// kinds: mage (hairStyle + accessories), owl, golem. A def with `image`/`images` renders artwork files instead.
import type { CharacterDef, Expr } from '~/utils/game'

const props = defineProps<{ def: CharacterDef; expr?: Expr }>()

const e = computed<Expr>(() => props.expr ?? 'neutral')
const has = (a: string) => props.def.accessory?.includes(a)
const robe = computed(() => props.def.robe ?? '#6d28d9')
const skin = computed(() => props.def.skin ?? '#fde2cf')
const hair = computed(() => props.def.hair ?? '#1f2937')
const iris = computed(() => props.def.eyes ?? '#7c3aed')
const glow = computed(() => props.def.color ?? '#f5c451')
const style = computed(() => props.def.hairStyle ?? 'bob')
const imageSrc = computed(() => props.def.images?.[e.value] ?? props.def.image)
const uid = `c${Math.random().toString(36).slice(2, 8)}`

// ---- eye geometry (relative to each eye centre; right eye is mirrored) ----
const EYE = 'M-15 1 Q-8 -10 7 -8.5 Q14 -6.5 16.5 0.5 Q6 8 -7 7.5 Q-13 5.5 -15 1Z'
const lash = computed(() => ({
  neutral: 'M-16.5 1.5 Q-8 -11 8 -9 Q14 -7 17.5 0',
  surprised: 'M-16.5 1.5 Q-8 -11 8 -9 Q14 -7 17.5 0',
  sad: 'M-16.5 0 Q0 -5 17.5 -7',
  determined: 'M-16.5 -6 Q0 -5.5 17.5 -1',
  happy: 'M-14 3 Q0 -9 15 2',
})[e.value])
const lid = computed(() => ({
  sad: 'M-18 -16 L19 -16 L19 -7 L-18 -0.5Z',
  determined: 'M-18 -16 L19 -16 L19 -1 L-18 -6.5Z',
} as Record<string, string>)[e.value])
const brow = computed(() => ({
  neutral: 'M-15 -18 Q-2 -23 14 -19',
  happy: 'M-15 -20 Q-2 -25 14 -21',
  surprised: 'M-15 -24 Q-2 -29 14 -25',
  sad: 'M-15 -18 Q0 -20 14 -26',
  determined: 'M-15 -22 Q0 -21 15 -15',
})[e.value])

// ---- hair shapes -----------------------------------------------------------
const backHair = computed(() => ({
  long: 'M94 112 C88 46 126 30 150 30 C174 30 212 46 206 112 C212 200 226 290 242 344 Q204 330 188 288 L112 288 Q96 330 58 344 C74 290 88 200 94 112Z',
  bob: 'M94 112 C90 48 126 32 150 32 C174 32 210 48 206 112 C210 160 208 200 198 218 Q176 226 160 214 L140 214 Q124 226 102 218 C92 200 90 160 94 112Z',
  short: 'M98 114 C94 52 126 36 150 36 C174 36 206 52 202 114 C204 142 200 162 194 170 L106 170 C100 162 96 142 98 114Z',
} as Record<string, string>)[style.value])
const BANGS = 'M98 122 C92 60 124 38 150 38 C178 38 208 58 202 122 C196 104 190 94 182 88 C184 102 180 112 173 118 C171 102 165 92 157 86 C157 100 151 110 143 116 C143 102 139 94 133 90 C129 102 121 110 111 114 C112 106 112 98 114 92 C106 100 101 110 98 122Z'
</script>

<template>
  <!-- ─────────── ARTWORK FILE ─────────── -->
  <img v-if="imageSrc" :src="imageSrc" :alt="def.name" class="h-full w-full object-contain object-bottom" draggable="false">

  <!-- ─────────── MAGE (half body) ─────────── -->
  <svg v-else-if="def.kind === 'mage'" viewBox="0 -70 300 530" class="h-full w-full overflow-visible">
    <defs>
      <linearGradient :id="`${uid}-shade`" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity=".12" />
        <stop offset=".45" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".4" />
      </linearGradient>
      <linearGradient :id="`${uid}-vshade`" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".18" />
        <stop offset=".5" stop-color="#000" stop-opacity="0" />
        <stop offset="1" stop-color="#000" stop-opacity=".35" />
      </linearGradient>
      <linearGradient :id="`${uid}-iris`" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stop-color="#140a24" />
        <stop offset=".45" :stop-color="iris" />
        <stop offset="1" :stop-color="iris" stop-opacity=".55" />
      </linearGradient>
      <radialGradient :id="`${uid}-cheek`">
        <stop offset="0" stop-color="#fb7185" stop-opacity=".55" />
        <stop offset="1" stop-color="#fb7185" stop-opacity="0" />
      </radialGradient>
      <clipPath :id="`${uid}-eye`"><path :d="EYE" /></clipPath>
    </defs>

    <g :transform="has('child') ? 'translate(150 460) scale(.86) translate(-150 -460)' : ''">
      <!-- hood (back) -->
      <path v-if="has('hood')" d="M84 150 C76 60 118 24 150 24 C182 24 224 60 216 150 C216 200 202 228 188 244 L112 244 C98 228 84 200 84 150Z" :fill="robe" />
      <path v-if="has('hood')" d="M84 150 C76 60 118 24 150 24 C182 24 224 60 216 150 C216 200 202 228 188 244 L112 244 C98 228 84 200 84 150Z" fill="#000" opacity=".35" />

      <!-- back hair -->
      <template v-if="!has('hood')">
        <path :d="backHair" :fill="hair" />
        <path :d="backHair" :fill="`url(#${uid}-shade)`" />
      </template>

      <!-- torso / robe -->
      <path d="M52 460 L58 318 Q62 262 112 242 L150 270 L188 242 Q238 262 242 318 L248 460Z" :fill="robe" />
      <path d="M52 460 L58 318 Q62 262 112 242 L150 270 L188 242 Q238 262 242 318 L248 460Z" :fill="`url(#${uid}-shade)`" />
      <path d="M92 460 Q96 380 104 330 M208 460 Q204 380 196 330 M130 460 Q134 400 140 350" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="3" />
      <!-- shirt + lapels -->
      <path d="M118 240 L150 306 L182 240 Q150 252 118 240Z" fill="#e2e8f0" />
      <path d="M118 240 L150 306 L182 240 Q150 252 118 240Z" :fill="`url(#${uid}-shade)`" />
      <path d="M112 242 L150 312 L188 242" fill="none" stroke="#f5c451" stroke-width="3.5" stroke-linejoin="round" />
      <path d="M150 312 L150 460" stroke="#f5c451" stroke-opacity=".5" stroke-width="2" />
      <!-- high collar -->
      <path d="M108 246 Q98 222 116 204 L130 232Z" :fill="robe" stroke="#f5c451" stroke-width="2" />
      <path d="M192 246 Q202 222 184 204 L170 232Z" :fill="robe" stroke="#f5c451" stroke-width="2" />
      <!-- brooch -->
      <circle cx="150" cy="316" r="9" fill="#b7791f" />
      <circle cx="150" cy="316" r="6" :fill="glow" />
      <circle cx="148" cy="314" r="2" fill="#fff" opacity=".8" />

      <!-- neck -->
      <path d="M134 188 L134 232 Q150 242 166 232 L166 188Z" :fill="skin" />
      <path d="M134 196 Q150 220 166 196 L166 214 Q150 230 134 214Z" fill="#7c2d12" opacity=".22" />

      <!-- ears -->
      <template v-if="!has('hood') && !has('cat')">
        <ellipse cx="104" cy="140" rx="8" ry="14" :fill="skin" />
        <ellipse cx="196" cy="140" rx="8" ry="14" :fill="skin" />
      </template>

      <!-- face -->
      <path d="M104 118 C104 76 124 58 150 58 C176 58 196 76 196 118 C196 152 188 176 172 192 C163 201 157 207 150 207 C143 207 137 201 128 192 C112 176 104 152 104 118Z" :fill="skin" />
      <path d="M104 118 C104 76 124 58 150 58 C176 58 196 76 196 118 C196 152 188 176 172 192 C163 201 157 207 150 207 C143 207 137 201 128 192 C112 176 104 152 104 118Z" fill="#7c2d12" opacity=".08" transform="translate(6 0)" />
      <!-- cheeks -->
      <ellipse cx="124" cy="164" rx="13" ry="7" :fill="`url(#${uid}-cheek)`" :opacity="e === 'happy' ? 1 : 0.6" />
      <ellipse cx="176" cy="164" rx="13" ry="7" :fill="`url(#${uid}-cheek)`" :opacity="e === 'happy' ? 1 : 0.6" />
      <!-- nose -->
      <path d="M151 148 Q154 158 149 162" fill="none" stroke="#9a3412" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round" />

      <!-- mouth -->
      <g stroke-linecap="round" stroke-linejoin="round">
        <path v-if="e === 'neutral'" d="M142 180 Q150 184 158 180" fill="none" stroke="#9f4a54" stroke-width="2.2" />
        <template v-else-if="e === 'happy'">
          <path d="M139 176 Q150 193 161 176 Q150 180 139 176Z" fill="#7f1d1d" stroke="#9f4a54" stroke-width="1.6" />
          <path d="M143 186 Q150 190 157 186" fill="none" stroke="#fb7185" stroke-width="2.5" />
        </template>
        <ellipse v-else-if="e === 'surprised'" cx="150" cy="183" rx="4.2" ry="6" fill="#7f1d1d" stroke="#9f4a54" stroke-width="1.4" />
        <path v-else-if="e === 'sad'" d="M143 184 Q150 178 157 184" fill="none" stroke="#9f4a54" stroke-width="2.2" />
        <path v-else d="M142 181 Q152 183 159 177" fill="none" stroke="#9f4a54" stroke-width="2.4" />
      </g>

      <!-- beard -->
      <template v-if="has('beard')">
        <path d="M112 162 Q116 204 150 272 Q184 204 188 162 Q176 196 150 202 Q124 196 112 162Z" :fill="hair" />
        <path d="M112 162 Q116 204 150 272 Q184 204 188 162 Q176 196 150 202 Q124 196 112 162Z" :fill="`url(#${uid}-shade)`" />
        <path d="M134 176 Q150 166 166 176 Q158 180 150 175 Q142 180 134 176Z" :fill="hair" stroke="#000" stroke-opacity=".15" />
      </template>

      <!-- front hair / hood rim -->
      <template v-if="has('hood')">
        <path d="M112 112 C116 86 132 74 150 74 C168 74 184 86 188 112 C178 100 170 96 162 96 C160 104 154 108 148 110 C146 102 142 98 136 98 C128 102 120 106 112 112Z" :fill="hair" />
        <path d="M96 132 C92 70 122 40 150 40 C178 40 208 70 204 132 C198 96 178 70 150 68 C122 70 102 96 96 132Z" :fill="robe" />
        <path d="M96 132 C92 70 122 40 150 40 C178 40 208 70 204 132 C198 96 178 70 150 68 C122 70 102 96 96 132Z" :fill="`url(#${uid}-shade)`" />
        <path d="M100 124 C100 80 124 52 150 52 C176 52 200 80 200 124" fill="none" stroke="#f5c451" stroke-opacity=".6" stroke-width="2" />
      </template>
      <template v-else>
        <path v-if="style !== 'short'" d="M104 112 C98 146 100 178 108 206 Q114 176 114 138Z M196 112 C202 146 200 178 192 206 Q186 176 186 138Z" :fill="hair" />
        <path v-if="style === 'long'" d="M106 150 C100 210 96 262 84 318 Q104 300 112 256 C116 216 114 180 114 150Z M194 150 C200 210 204 262 216 318 Q196 300 188 256 C184 216 186 180 186 150Z" :fill="hair" />
        <path :d="BANGS" :fill="hair" />
        <path :d="BANGS" :fill="`url(#${uid}-vshade)`" />
        <path d="M116 66 Q150 50 184 66" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="5" stroke-linecap="round" />
        <path d="M132 90 Q136 100 133 110 M157 86 Q160 98 156 108" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="2" stroke-linecap="round" />
      </template>

      <!-- cat ears -->
      <template v-if="has('cat')">
        <path d="M106 76 L96 14 L142 50Z" :fill="hair" /><path d="M110 64 L104 30 L130 50Z" fill="#fda4af" />
        <path d="M194 76 L204 14 L158 50Z" :fill="hair" /><path d="M190 64 L196 30 L170 50Z" fill="#fda4af" />
      </template>

      <!-- eyes -->
      <g v-for="side in [-1, 1]" :key="side" :transform="`translate(${150 + side * 25} 141) scale(${-side * (e === 'surprised' ? 1.22 : 1.14)} ${e === 'surprised' ? 1.26 : 1.16})`">
        <template v-if="e !== 'happy'">
          <g :clip-path="`url(#${uid}-eye)`">
            <path :d="EYE" fill="#fff" />
            <circle cx="1" cy="0.5" :r="e === 'surprised' ? 7.2 : 8" :fill="`url(#${uid}-iris)`" stroke="#140a24" stroke-opacity=".6" stroke-width=".8" />
            <ellipse cx="1" cy="1" rx="3.3" ry="4" fill="#0f0a1e" />
            <circle cx="-2.6" cy="-3.2" r="2.7" fill="#fff" />
            <circle cx="4.2" cy="3.8" r="1.3" fill="#fff" opacity=".85" />
            <path d="M-17 -12 L18 -12 L18 -3 Q0 -10 -17 -2Z" fill="#000" opacity=".14" />
            <path v-if="lid" :d="lid" :fill="skin" />
          </g>
          <path d="M-4 8 Q4 9 10 5.5" fill="none" stroke="#1a1025" stroke-opacity=".3" stroke-width="1" />
        </template>
        <path :d="lash" fill="none" stroke="#1a1025" stroke-width="2.7" stroke-linecap="round" />
        <path v-if="e !== 'happy'" d="M-12 -4 Q-4 -9.5 6 -8.5" fill="none" stroke="#1a1025" stroke-width="1.6" stroke-linecap="round" />
        <path :d="brow" fill="none" :stroke="hair" stroke-width="2.3" stroke-linecap="round" />
        <path :d="brow" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2.3" stroke-linecap="round" />
      </g>
      <!-- sad tear -->
      <path v-if="e === 'sad'" d="M122 152 Q118 162 122 166 Q126 162 122 152Z" fill="#bae6fd" opacity=".85" />

      <!-- glasses -->
      <g v-if="has('glasses')" fill="none" stroke="#f5c451" stroke-width="2.2">
        <circle cx="125" cy="141" r="18" /><circle cx="175" cy="141" r="18" /><path d="M143 139 Q150 134 157 139 M107 137 L100 133 M193 137 L200 133" />
        <circle cx="125" cy="141" r="18" fill="#bae6fd" fill-opacity=".08" stroke="none" />
        <circle cx="175" cy="141" r="18" fill="#bae6fd" fill-opacity=".08" stroke="none" />
      </g>

      <!-- witch hat -->
      <g v-if="has('hat')">
        <path d="M96 60 Q118 -20 204 -64 Q174 0 206 60Z" :fill="robe" />
        <path d="M96 60 Q118 -20 204 -64 Q174 0 206 60Z" :fill="`url(#${uid}-shade)`" />
        <path d="M100 48 Q150 38 202 48 L204 62 Q150 52 98 62Z" fill="#f5c451" />
        <ellipse cx="150" cy="64" rx="98" ry="17" :fill="robe" />
        <ellipse cx="150" cy="64" rx="98" ry="17" fill="#000" opacity=".25" />
        <path d="M188 -50 l3.5 8 8.5 1 -6 6 1.5 8.5 -7.5 -4 -7.5 4 1.5 -8.5 -6 -6 8.5 -1Z" fill="#fde68a" />
      </g>
    </g>
  </svg>

  <!-- ─────────── OWL (Lumin) ─────────── -->
  <svg v-else-if="def.kind === 'owl'" viewBox="0 -70 300 530" class="h-full w-full overflow-visible">
    <defs>
      <radialGradient :id="`${uid}-owl`" cx=".45" cy=".3" r=".75">
        <stop offset="0" stop-color="#fffbeb" />
        <stop offset=".55" stop-color="#fde68a" />
        <stop offset="1" :stop-color="glow" />
      </radialGradient>
      <radialGradient :id="`${uid}-aura`">
        <stop offset="0" :stop-color="glow" stop-opacity=".35" />
        <stop offset="1" :stop-color="glow" stop-opacity="0" />
      </radialGradient>
      <radialGradient :id="`${uid}-oiris`">
        <stop offset="0" stop-color="#fef3c7" />
        <stop offset=".5" stop-color="#f59e0b" />
        <stop offset="1" stop-color="#78350f" />
      </radialGradient>
    </defs>
    <g transform="translate(10 30) scale(1.4)">
      <circle cx="100" cy="150" r="110" :fill="`url(#${uid}-aura)`" />
      <!-- wings -->
      <g class="wing-l">
        <path d="M44 120 Q10 160 22 226 Q40 214 56 190 Z" :fill="glow" />
        <path d="M24 170 Q34 176 44 170 M22 190 Q34 196 46 188 M26 208 Q36 212 48 204" fill="none" stroke="#b45309" stroke-opacity=".35" stroke-width="2" />
      </g>
      <g class="wing-r">
        <path d="M156 120 Q190 160 178 226 Q160 214 144 190 Z" :fill="glow" />
        <path d="M176 170 Q166 176 156 170 M178 190 Q166 196 154 188 M174 208 Q164 212 152 204" fill="none" stroke="#b45309" stroke-opacity=".35" stroke-width="2" />
      </g>
      <!-- ear tufts -->
      <path d="M54 96 L56 40 Q70 56 86 82 Z" :fill="glow" /><path d="M146 96 L144 40 Q130 56 114 82 Z" :fill="glow" />
      <!-- body -->
      <ellipse cx="100" cy="158" rx="64" ry="80" :fill="`url(#${uid}-owl)`" />
      <ellipse cx="100" cy="194" rx="40" ry="44" fill="#fff7ed" opacity=".9" />
      <g fill="none" :stroke="glow" stroke-width="2" stroke-linecap="round" opacity=".8">
        <path d="M78 172 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0" />
        <path d="M74 190 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0" />
        <path d="M80 208 q5 6 10 0 q5 6 10 0 q5 6 10 0 q5 6 10 0" />
      </g>
      <!-- face discs -->
      <circle cx="76" cy="128" r="28" fill="#fff7ed" /><circle cx="124" cy="128" r="28" fill="#fff7ed" />
      <path d="M58 110 Q76 96 94 110 M106 110 Q124 96 142 110" fill="none" :stroke="glow" stroke-width="3" opacity=".7" />
      <!-- eyes -->
      <g v-for="x in [76, 124]" :key="x" :transform="`translate(${x} 128)`">
        <path v-if="e === 'happy'" d="M-12 3 Q0 -11 12 3" fill="none" stroke="#1e1b2e" stroke-width="5" stroke-linecap="round" />
        <template v-else>
          <circle :r="e === 'surprised' ? 19 : 16" fill="#1e1b2e" />
          <circle :r="e === 'surprised' ? 13 : 11" :fill="`url(#${uid}-oiris)`" />
          <circle r="5" fill="#1e1b2e" />
          <circle cx="5" cy="-6" r="5" fill="#fff" />
          <circle cx="-5" cy="5" r="2" fill="#fff" opacity=".8" />
          <path v-if="e === 'determined'" d="M-19 -8 L19 -2 L19 -20 L-19 -20Z" fill="#fff7ed" :transform="x > 100 ? 'scale(-1 1)' : ''" />
          <path v-if="e === 'sad'" d="M-19 -2 L19 -10 L19 -20 L-19 -20Z" fill="#fff7ed" :transform="x > 100 ? 'scale(-1 1)' : ''" />
        </template>
      </g>
      <!-- beak -->
      <path d="M91 146 L109 146 L100 164 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round" />
      <path d="M94 147 L100 147 L98 154Z" fill="#fff" opacity=".4" />
      <path v-if="e === 'surprised' || e === 'happy'" d="M94 151 L106 151 L100 159 Z" fill="#9f1239" />
      <!-- feet -->
      <path d="M80 236 l-6 10 M84 236 v12 M88 236 l6 10 M112 236 l-6 10 M116 236 v12 M120 236 l6 10" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" />
    </g>
  </svg>

  <!-- ─────────── GOLEM ─────────── -->
  <svg v-else viewBox="0 -70 300 530" class="h-full w-full overflow-visible">
    <defs>
      <linearGradient :id="`${uid}-stone`" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#94a3b8" />
        <stop offset="1" stop-color="#334155" />
      </linearGradient>
    </defs>
    <g transform="translate(5 -10) scale(1.45)">
      <!-- arms -->
      <rect x="12" y="140" width="38" height="100" rx="14" :fill="`url(#${uid}-stone)`" stroke="#1e293b" stroke-width="3" />
      <rect x="150" y="140" width="38" height="100" rx="14" :fill="`url(#${uid}-stone)`" stroke="#1e293b" stroke-width="3" />
      <path d="M22 180 h18 M160 190 h18" stroke="#1e293b" stroke-width="2" opacity=".5" />
      <!-- body -->
      <rect x="42" y="128" width="116" height="136" rx="24" :fill="`url(#${uid}-stone)`" stroke="#1e293b" stroke-width="3" />
      <path d="M60 150 l14 18 -8 22 M140 240 l-16 -14 6 -18" fill="none" :stroke="glow" stroke-opacity=".55" stroke-width="2.5" />
      <circle cx="100" cy="196" r="26" :fill="glow" opacity=".2" />
      <path d="M100 176 l13 20 -13 20 -13 -20 Z" :fill="glow" class="rune-pulse" />
      <circle cx="100" cy="196" r="30" fill="none" :stroke="glow" stroke-opacity=".4" stroke-dasharray="3 5" />
      <!-- moss -->
      <path d="M42 150 q12 -10 26 -2 q10 -8 22 0 M120 132 q10 -8 20 0" fill="none" stroke="#4ade80" stroke-width="5" stroke-linecap="round" opacity=".7" />
      <!-- head -->
      <rect x="52" y="40" width="96" height="92" rx="22" :fill="`url(#${uid}-stone)`" stroke="#1e293b" stroke-width="3" />
      <path d="M70 52 l10 12 M132 110 l-12 -8" :stroke="glow" stroke-opacity=".45" stroke-width="2" />
      <!-- eyes -->
      <g v-for="x in [80, 120]" :key="x" :transform="`translate(${x} 84)`">
        <path v-if="e === 'happy'" d="M-10 4 Q0 -8 10 4" fill="none" :stroke="glow" stroke-width="6" stroke-linecap="round" />
        <template v-else>
          <rect x="-12" y="-11" width="24" height="22" rx="6" :fill="glow" opacity=".3" filter="blur(3px)" />
          <rect :x="e === 'surprised' ? -11 : -9" :y="e === 'determined' ? -4 : e === 'surprised' ? -11 : -8" :width="e === 'surprised' ? 22 : 18" :height="e === 'determined' ? 8 : e === 'surprised' ? 22 : 16" rx="4" :fill="glow" />
        </template>
        <path v-if="e === 'sad'" :d="x < 100 ? 'M-12 -12 L8 -18' : 'M-8 -18 L12 -12'" stroke="#1e293b" stroke-width="4" stroke-linecap="round" />
      </g>
      <rect v-if="e !== 'surprised'" x="84" y="108" width="32" height="6" rx="3" fill="#1e293b" :transform="e === 'sad' ? 'rotate(-6 100 111)' : ''" />
      <rect v-else x="90" y="104" width="20" height="14" rx="5" fill="#1e293b" />
    </g>
  </svg>
</template>

<style scoped>
.wing-l { transform-origin: 50px 130px; animation: flap 1.6s ease-in-out infinite; }
.wing-r { transform-origin: 150px 130px; animation: flap-r 1.6s ease-in-out infinite; }
@keyframes flap { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-12deg); } }
@keyframes flap-r { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(12deg); } }
.rune-pulse { animation: rune 2s ease-in-out infinite; }
@keyframes rune { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
</style>
