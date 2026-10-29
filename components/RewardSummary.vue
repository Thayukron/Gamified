<script setup lang="ts">
import { RARITY, type Rarity } from '~/utils/progression'

// Quest-complete rewards: XP, coins, card rarity and level-up.
const props = defineProps<{
  xp: number
  coins: number
  rarity?: Rarity
  levelBefore?: number
  levelAfter?: number
}>()

const leveled = computed(() => !!props.levelBefore && !!props.levelAfter && props.levelAfter > props.levelBefore)
const shownXp = ref(0)
const shownCoins = ref(0)
onMounted(() => {
  const start = performance.now()
  const tick = (t: number) => {
    const k = Math.min(1, (t - start) / 1200)
    shownXp.value = Math.round(props.xp * k)
    shownCoins.value = Math.round(props.coins * k)
    if (k < 1) requestAnimationFrame(tick)
  }
  setTimeout(() => requestAnimationFrame(tick), 1300)
})
</script>

<template>
  <section class="card animate-fade-up overflow-hidden border-rune-400/40 !p-4" style="animation-delay: 1.05s">
    <div class="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-rune-400/20 blur-2xl" />
    <p class="relative font-display text-xs tracking-[0.3em] text-rune-300">QUEST REWARDS</p>
    <div class="relative mt-3 flex flex-wrap items-center gap-3">
      <div class="reward">
        <span class="font-display text-2xl font-bold text-sky-300">+{{ shownXp }}</span>
        <span class="text-xs text-slate-400">XP</span>
      </div>
      <div class="reward">
        <span class="coin !h-5 !w-5" />
        <span class="font-display text-2xl font-bold text-amber-300">+{{ shownCoins }}</span>
      </div>
      <div v-if="rarity" class="reward" :style="{ borderColor: RARITY[rarity].color }">
        <span class="font-display text-sm font-bold" :style="{ color: RARITY[rarity].color }">✦ {{ RARITY[rarity].label }}</span>
        <span class="text-xs text-slate-400">การ์ด{{ RARITY[rarity].th }}</span>
      </div>
      <div v-if="leveled" class="reward levelup border-rune-400">
        <span class="font-display text-sm font-black text-rune-200">LEVEL UP!</span>
        <span class="text-xs text-rune-100">Lv.{{ levelBefore }} → Lv.{{ levelAfter }}</span>
      </div>
    </div>
    <p v-if="rarity === 'rare'" class="relative mt-3 text-xs text-slate-400">เคล็ดลับ: ผ่านมินิเกมครบทุกด่านเพื่อรับการ์ดระดับ EPIC ✦</p>
  </section>
</template>

<style scoped>
.reward {
  @apply flex items-center gap-2 rounded-xl border border-white/10 bg-abyss-950/60 px-3 py-2;
}
.levelup {
  animation: pulse-gold 1.6s ease-in-out infinite;
}
@keyframes pulse-gold {
  0%, 100% { box-shadow: 0 0 0 rgba(245, 196, 81, 0); }
  50% { box-shadow: 0 0 24px rgba(245, 196, 81, 0.7); }
}
</style>
