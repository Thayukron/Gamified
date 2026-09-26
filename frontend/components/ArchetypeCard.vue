<script setup lang="ts">
import { MINDSET, RIASEC, varkLabel, type AssessmentResult } from '~/utils/profile'

// Tarot-style archetype card. Rendered at a fixed width so it saves nicely as an image.
const props = defineProps<{ result: AssessmentResult; owner?: string }>()

const vark = computed(() => varkLabel(props.result.dominant_vark))
const mindset = computed(() => MINDSET[props.result.mindset_type] ?? MINDSET.mixed)
const holland = computed(() => props.result.dominant_riasec.split(''))
</script>

<template>
  <div
    class="relative w-[320px] overflow-hidden rounded-[22px] border-2 p-[3px]"
    :style="{ borderColor: `${result.color}aa`, boxShadow: `0 0 50px -8px ${result.color}` }"
  >
    <div class="relative overflow-hidden rounded-[18px] bg-abyss-900 px-6 pb-6 pt-5 text-center">
      <!-- aura -->
      <div class="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-50 blur-3xl" :style="{ background: result.color }" />
      <div class="absolute inset-3 rounded-[14px] border border-rune-400/25" />

      <div class="relative">
        <p class="font-display text-[10px] tracking-[0.5em] text-rune-300/80">ARCHETYPE</p>

        <div class="mx-auto mt-4 w-36">
          <MagicCircle>
            <div
              class="flex h-16 w-16 items-center justify-center rounded-full border-2 bg-abyss-950/80 text-white"
              :style="{ borderColor: result.color, boxShadow: `0 0 30px ${result.color}` }"
            >
              <AppIcon :name="result.icon" :size="32" />
            </div>
          </MagicCircle>
        </div>

        <h2 class="title-glow mt-3 text-2xl font-black tracking-wider">{{ result.archetype_name }}</h2>
        <p class="mt-1 text-lg font-medium" :style="{ color: result.color }">{{ result.archetype_title }}</p>
        <p v-if="owner" class="mt-1 text-xs text-slate-500">ของ {{ owner }}</p>

        <p class="mt-4 text-sm leading-relaxed text-slate-300">{{ result.archetype_description }}</p>

        <div class="divider-rune my-4 text-[10px] tracking-[0.3em]"><span class="font-display">POWERS</span></div>
        <div class="flex flex-wrap justify-center gap-1.5">
          <span
            v-for="s in result.strengths"
            :key="s"
            class="rounded-full border border-rune-400/30 bg-rune-400/10 px-2.5 py-1 text-xs text-rune-200"
          >✦ {{ s }}</span>
        </div>

        <div class="mt-5 grid grid-cols-3 gap-2 text-left">
          <div class="rounded-xl border border-arcane-400/20 bg-abyss-950/60 p-2">
            <div class="text-[9px] uppercase tracking-widest text-arcane-300/70">Holland</div>
            <div class="font-display text-lg font-bold text-rune-300">{{ result.dominant_riasec }}</div>
            <div class="truncate text-[10px] text-slate-400">{{ RIASEC[holland[0] as keyof typeof RIASEC]?.th }}</div>
          </div>
          <div class="rounded-xl border border-arcane-400/20 bg-abyss-950/60 p-2">
            <div class="text-[9px] uppercase tracking-widest text-arcane-300/70">เรียนรู้</div>
            <div class="font-display text-lg font-bold text-rune-300">{{ result.dominant_vark ?? '-' }}</div>
            <div class="truncate text-[10px] text-slate-400">{{ vark.th }}</div>
          </div>
          <div class="rounded-xl border border-arcane-400/20 bg-abyss-950/60 p-2">
            <div class="text-[9px] uppercase tracking-widest text-arcane-300/70">Mindset</div>
            <div class="font-display text-lg font-bold capitalize text-rune-300">{{ result.mindset_type }}</div>
            <div class="truncate text-[10px] text-slate-400">{{ mindset.th }}</div>
          </div>
        </div>

        <p class="mt-5 font-display text-[9px] tracking-[0.4em] text-slate-600">ARCANA PROFILE</p>
      </div>
    </div>
  </div>
</template>
