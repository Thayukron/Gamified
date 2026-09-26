<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import type { AssessmentResult } from '~/utils/profile'

interface Quest {
  id: number
  title: string
  description: string
  is_universal: number
  status: 'new' | 'in_progress' | 'completed'
  result_id: number | null
  saved_at: string | null
}

const auth = useAuthStore()
const api = useApi()
const quests = ref<Quest[]>([])
const latest = ref<AssessmentResult | null>(null)
const term = ref<{ semester: number; academic_year: number } | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [q, r] = await Promise.all([api('/student/quests'), api('/student/results')])
    quests.value = q.quests
    term.value = q.term
    latest.value = r.results[0] ?? null
  } finally {
    loading.value = false
  }
})

const statusBadge = {
  new: { text: 'เควสต์ใหม่', cls: 'border-rune-400/50 bg-rune-400/15 text-rune-200' },
  in_progress: { text: 'เดินทางค้างไว้', cls: 'border-arcane-400/50 bg-arcane-500/15 text-arcane-300' },
  completed: { text: 'สำเร็จแล้ว', cls: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' },
}
const fmtTime = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
</script>

<template>
  <div class="space-y-8">
    <!-- hero -->
    <section class="card animate-fade-up overflow-hidden border-rune-400/30 !p-0">
      <div class="absolute -right-16 -top-16 w-64 opacity-50 sm:w-72">
        <MagicCircle />
      </div>
      <div class="relative p-6 sm:p-8">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">WELCOME, TRAVELER</p>
        <h1 class="title-glow mt-2 text-2xl sm:text-3xl">{{ auth.user?.full_name }}</h1>
        <p class="mt-1 text-sm text-slate-400">
          รหัสนักผจญภัย <span class="font-mono text-rune-300">{{ auth.user?.student_code }}</span>
          <template v-if="term"> · ภาคเรียน {{ term.semester }}/{{ term.academic_year }}</template>
        </p>

        <NuxtLink
          v-if="latest"
          :to="`/student/result/${latest.id}`"
          class="mt-5 flex max-w-md items-center gap-4 rounded-xl border bg-abyss-950/60 p-3 transition hover:bg-abyss-950/90"
          :style="{ borderColor: `${latest.color}88`, boxShadow: `0 0 24px -8px ${latest.color}` }"
        >
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2" :style="{ borderColor: latest.color, color: latest.color }">
            <AppIcon :name="latest.icon" />
          </div>
          <div>
            <div class="text-xs text-slate-400">ตัวตนของคุณคือ</div>
            <div class="font-display font-bold text-rune-200">{{ latest.archetype_name }}</div>
            <div class="text-sm" :style="{ color: latest.color }">{{ latest.archetype_title }}</div>
          </div>
        </NuxtLink>
        <template v-else>
          <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300">
            ในความมืดมีเรื่องราวรอคุณอยู่… เลือกเส้นทางของคุณ แล้วตัวตนที่แท้จริงจะปรากฏ
          </p>
          <div class="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span class="h-2 w-2 animate-pulse rounded-full bg-rune-400 shadow-glow-gold" />
            ยังไม่พบ Archetype ของคุณ — การเดินทางยังไม่เริ่มต้น
          </div>
        </template>
      </div>
    </section>

    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">QUESTS</span></div>

    <p v-if="loading" class="text-center text-slate-500">กำลังค้นหาเควสต์...</p>
    <p v-else-if="!quests.length" class="card text-center text-slate-400">ยังไม่มีเควสต์เปิดให้เล่นในขณะนี้</p>

    <div class="grid gap-4 md:grid-cols-2">
      <div
        v-for="(q, i) in quests"
        :key="q.id"
        class="card card-hover group animate-fade-up overflow-hidden"
        :class="{ 'animate-pulseglow border-rune-400/40': q.status === 'new' }"
        :style="{ animationDelay: `${150 + i * 90}ms` }"
      >
        <span class="absolute left-2 top-2 h-4 w-4 border-l border-t border-rune-400/40" />
        <span class="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-rune-400/40" />
        <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-arcane-500/20 blur-2xl transition duration-700 group-hover:bg-rune-400/30" />

        <div class="relative">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border px-2.5 py-0.5 text-xs" :class="statusBadge[q.status].cls">{{ statusBadge[q.status].text }}</span>
            <span v-if="q.is_universal" class="text-xs text-slate-500">✦ Core Profile</span>
          </div>
          <h3 class="mt-3 font-display text-xl text-slate-50">{{ q.title }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-slate-400">{{ q.description }}</p>
          <p v-if="q.status === 'in_progress' && q.saved_at" class="mt-2 flex items-center gap-1 text-xs text-arcane-300">
            <AppIcon name="clock" :size="12" /> บันทึกล่าสุด {{ fmtTime(q.saved_at) }}
          </p>

          <div class="mt-4">
            <NuxtLink v-if="q.status === 'completed'" :to="`/student/result/${q.result_id}`" class="btn-ghost">
              <AppIcon name="card" :size="16" /> ดูการ์ดตัวละคร
            </NuxtLink>
            <NuxtLink v-else :to="`/student/play/${q.id}`" class="btn-primary">
              <AppIcon name="play" :size="16" /> {{ q.status === 'in_progress' ? 'เดินทางต่อ' : 'เริ่มเควสต์' }}
            </NuxtLink>
          </div>
        </div>
      </div>

      <NuxtLink to="/student/history" class="card card-hover group flex animate-fade-up items-center gap-4" style="animation-delay: 400ms">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rune-400/30 bg-abyss-900/80 text-rune-300 shadow-glow transition duration-500 group-hover:rotate-6">
          <AppIcon name="hourglass" />
        </div>
        <div>
          <div class="font-medium text-slate-100">บันทึกการเดินทาง</div>
          <p class="text-sm text-slate-400">ย้อนดูการ์ดตัวละครในแต่ละภาคเรียน</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
