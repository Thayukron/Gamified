<script setup lang="ts">
import { toPng } from 'html-to-image'
import { useAuthStore } from '~/stores/auth'
import { MINDSET, RIASEC, VARK, varkLabel, type AssessmentResult } from '~/utils/profile'

// Archetype card + detailed profile (RIASEC radar, VARK bars, mindset, tips, items), with share/save.
const props = defineProps<{ result: AssessmentResult; heading: string; subheading: string }>()

const auth = useAuthStore()
const cardEl = ref<HTMLElement>()
const busy = ref(false)
const toast = ref('')

const riasecKeys = ['R', 'I', 'A', 'S', 'E', 'C'] as const
const r = computed(() => props.result as any)
const riasecValues = computed(() => riasecKeys.map((k) => r.value[`riasec_${k.toLowerCase()}`] ?? 0))
const varkRows = computed(() => {
  const vals = (['V', 'A', 'R', 'K'] as const).map((k) => ({ k, v: r.value[`vark_${k.toLowerCase()}`] ?? 0 }))
  const total = vals.reduce((s, x) => s + x.v, 0) || 1
  return vals.map((x) => ({ ...x, pct: Math.round((x.v / total) * 100), ...VARK[x.k] }))
})
const growthPct = computed(() => {
  const t = props.result.mindset_growth + props.result.mindset_fixed
  return t ? Math.round((props.result.mindset_growth / t) * 100) : 50
})
const mindset = computed(() => MINDSET[props.result.mindset_type] ?? MINDSET.mixed)

function flash(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2500)
}

const cardImage = () => toPng(cardEl.value!, { pixelRatio: 2, backgroundColor: '#05030d', cacheBust: true })

async function saveImage() {
  busy.value = true
  try {
    const a = document.createElement('a')
    a.href = await cardImage()
    a.download = `arcana-${props.result.archetype_code.toLowerCase()}.png`
    a.click()
    flash('บันทึกการ์ดแล้ว')
  } catch {
    flash('บันทึกรูปไม่สำเร็จ ลองใหม่อีกครั้ง')
  } finally {
    busy.value = false
  }
}

async function share() {
  const res = props.result
  const text = `ผลึกแห่งอาร์คานาเผยว่าฉันคือ ${res.archetype_name} — ${res.archetype_title} ✦ Holland ${res.dominant_riasec} · เรียนรู้แบบ ${varkLabel(res.dominant_vark).th}`
  busy.value = true
  try {
    const blob = await (await fetch(await cardImage())).blob()
    const file = new File([blob], 'arcana-card.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text, title: 'Arcana Profile' })
    } else if (navigator.share) {
      await navigator.share({ text, title: 'Arcana Profile' })
    } else {
      await navigator.clipboard.writeText(text)
      flash('คัดลอกข้อความแล้ว นำไปแชร์ได้เลย')
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') flash('แชร์ไม่สำเร็จ')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid items-start gap-8 lg:grid-cols-[auto_1fr]">
    <!-- card + actions -->
    <div class="flex flex-col items-center gap-5">
      <div class="reveal-card">
        <div ref="cardEl" class="p-2">
          <ArchetypeCard :result="result" :owner="auth.user?.full_name" />
        </div>
      </div>
      <div class="flex animate-fade-up flex-wrap justify-center gap-2" style="animation-delay: 1.2s">
        <button class="btn-primary" :disabled="busy" @click="share"><AppIcon name="share" :size="16" /> แชร์ผลลัพธ์</button>
        <button class="btn-ghost" :disabled="busy" @click="saveImage"><AppIcon name="download" :size="16" /> บันทึกเป็นรูป</button>
      </div>
    </div>

    <!-- details -->
    <div class="space-y-5">
      <div class="animate-fade-up" style="animation-delay: 1s">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">YOUR PROFILE</p>
        <h1 class="title-glow mt-1 text-2xl">{{ heading }}</h1>
        <p class="mt-1 text-sm text-slate-400">{{ subheading }}</p>
      </div>

      <slot />

      <div class="grid gap-5 md:grid-cols-2">
        <section class="card animate-fade-up" style="animation-delay: 1.15s">
          <h3 class="font-medium text-rune-300">ความสนใจแบบ RIASEC</h3>
          <p class="text-xs text-slate-500">Holland Code: <b class="text-rune-200">{{ result.dominant_riasec }}</b></p>
          <div class="mx-auto mt-2 aspect-square max-w-[280px] px-6">
            <RadarChart :labels="riasecKeys.map((k) => `${k} ${RIASEC[k].th}`)" :values="riasecValues" :color="result.color" />
          </div>
        </section>

        <section class="card animate-fade-up space-y-4" style="animation-delay: 1.3s">
          <div>
            <h3 class="font-medium text-rune-300">สไตล์การเรียนรู้ VARK</h3>
            <p class="text-sm text-slate-300">{{ varkLabel(result.dominant_vark).th }} — {{ varkLabel(result.dominant_vark).desc }}</p>
          </div>
          <div v-for="row in varkRows" :key="row.k">
            <div class="mb-1 flex justify-between text-xs">
              <span class="text-slate-300"><b class="font-display text-rune-300">{{ row.k }}</b> · {{ row.th }}</span>
              <span class="text-slate-500">{{ row.pct }}%</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-white/5">
              <div class="bar h-full rounded-full bg-gradient-to-r from-arcane-500 to-rune-400" :style="{ width: `${row.pct}%` }" />
            </div>
          </div>
        </section>
      </div>

      <section class="card animate-fade-up" style="animation-delay: 1.45s">
        <h3 class="font-medium text-rune-300">{{ mindset.name }} · {{ mindset.th }}</h3>
        <p class="mt-1 text-sm text-slate-300">{{ mindset.desc }}</p>
        <div class="mt-4 flex items-center gap-3 text-xs text-slate-400">
          <span>มั่นคง</span>
          <div class="relative h-2 flex-1 rounded-full bg-gradient-to-r from-arcane-600/60 via-slate-600/40 to-rune-400/70">
            <span class="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-rune-300 shadow-glow-gold transition-all duration-1000" :style="{ left: `${growthPct}%` }" />
          </div>
          <span>เติบโต</span>
        </div>
      </section>

      <section v-if="result.items?.length" class="card animate-fade-up" style="animation-delay: 1.55s">
        <h3 class="font-medium text-rune-300">ไอเทมที่สะสมได้ในเควสต์นี้</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="(it, i) in result.items" :key="i" class="inline-flex items-center gap-1.5 rounded-full border border-rune-400/30 bg-abyss-950/60 px-3 py-1 text-sm text-rune-100">
            <AppIcon :name="it.icon" :size="15" class="text-rune-300" /> {{ it.name }}
          </span>
        </div>
      </section>

      <section class="card animate-fade-up" style="animation-delay: 1.65s">
        <h3 class="font-medium text-rune-300">คำแนะนำสำหรับการเรียนของคุณ</h3>
        <ul class="mt-2 space-y-1.5 text-sm text-slate-300">
          <li v-for="t in result.tips" :key="t" class="flex gap-2"><span class="text-rune-400">✦</span>{{ t }}</li>
          <li class="flex gap-2"><span class="text-rune-400">✦</span>{{ varkLabel(result.dominant_vark).desc }}</li>
        </ul>
      </section>

      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/student" class="btn-ghost"><AppIcon name="map" :size="16" /> แผนที่เควสต์</NuxtLink>
        <NuxtLink to="/student/history" class="btn-ghost"><AppIcon name="hourglass" :size="16" /> บันทึกการเดินทาง</NuxtLink>
      </div>
    </div>

    <Transition enter-from-class="opacity-0 translate-y-2" leave-to-class="opacity-0" enter-active-class="transition" leave-active-class="transition">
      <div v-if="toast" class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-rune-400/40 bg-abyss-900/95 px-4 py-2 text-sm text-rune-200 shadow-glow-gold">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.reveal-card { perspective: 1200px; }
.reveal-card > div { animation: flip-in 1.1s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
@keyframes flip-in {
  0% { transform: rotateY(90deg) scale(0.6); opacity: 0; filter: brightness(3) blur(4px); }
  60% { transform: rotateY(-8deg) scale(1.03); opacity: 1; filter: brightness(1.4); }
  100% { transform: rotateY(0) scale(1); filter: none; }
}
.bar { animation: fill 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) both 1.4s; transform-origin: left; }
@keyframes fill { from { transform: scaleX(0); } }
</style>
