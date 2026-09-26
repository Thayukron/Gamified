<script setup lang="ts">
import type { AssessmentResult } from '~/utils/profile'

const route = useRoute()
const api = useApi()
const audio = useGameAudio()

const result = ref<AssessmentResult | null>(null)
const profile = ref<{ completed: number; total: number } | null>(null)
const error = ref('')
const phase = ref<'charging' | 'revealed'>(route.query.reveal ? 'charging' : 'revealed')
// Rewards from the just-finished run (level-up info) — falls back to what the result stored.
const lastRewards = useState<any>('lastRewards')
const fresh = route.query.reveal ? lastRewards.value : null
lastRewards.value = null

onMounted(async () => {
  try {
    const [r, p] = await Promise.all([api(`/student/results/${route.params.id}`), api('/student/profile')])
    result.value = r.result
    profile.value = p
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
  if (phase.value === 'charging') {
    setTimeout(() => {
      phase.value = 'revealed'
      audio.reveal()
      navigateTo({ query: {} }, { replace: true })
    }, 2000)
  }
})
</script>

<template>
  <div>
    <div v-if="phase === 'charging'" class="fixed inset-0 z-40 flex flex-col items-center justify-center bg-abyss-950/95">
      <MysticBackground />
      <div class="w-72 animate-[spin_3s_linear_infinite]"><MagicCircle /></div>
      <p class="title-glow mt-8 animate-pulse text-xl">ผลึกกำลังเผยตัวตนของคุณ...</p>
    </div>

    <p v-if="error" class="card text-red-300">{{ error }}</p>

    <ProfileReport
      v-else-if="result && phase === 'revealed'"
      :result="result"
      heading="ตัวตนที่เควสต์นี้เผยให้เห็น"
      :subheading="`จากเควสต์ “${result.scenario_title}” · ภาคเรียน ${result.semester}/${result.academic_year}`"
    >
      <RewardSummary
        :xp="fresh?.xp ?? result.xp_gained ?? 0"
        :coins="fresh?.coins ?? result.coins_gained ?? 0"
        :rarity="result.rarity"
        :level-before="fresh?.level_before"
        :level-after="fresh?.level_after"
      />
      <NuxtLink
        v-if="profile"
        to="/student/profile"
        class="card card-hover flex animate-fade-up items-center gap-4 border-rune-400/40 !p-4"
        style="animation-delay: 1.1s"
      >
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rune-400/60 text-rune-300 shadow-glow-gold">
          <AppIcon name="gem" />
        </div>
        <div class="flex-1">
          <div class="font-medium text-slate-100">ดู Core Profile รวมทุกเควสต์</div>
          <div class="text-xs text-slate-400">
            ค้นพบแล้ว {{ profile.completed }}/{{ profile.total }} เควสต์ — ยิ่งเล่นมาก ผลยิ่งแม่นยำ
          </div>
        </div>
        <AppIcon name="back" :size="18" class="rotate-180 text-slate-500" />
      </NuxtLink>
    </ProfileReport>
  </div>
</template>
