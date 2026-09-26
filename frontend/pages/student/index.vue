<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const items = [
  { icon: 'map', title: 'เลือกเควสต์', desc: 'ก้าวเข้าสู่เรื่องราวลึกลับ ทุกทางเลือกจะเผยตัวตนของคุณ', phase: 2 },
  { icon: 'card', title: 'การ์ดตัวละครของฉัน', desc: 'ค้นพบ Archetype ที่ซ่อนอยู่ภายใน และพลังพิเศษของคุณ', phase: 2 },
  { icon: 'hourglass', title: 'บันทึกการเดินทาง', desc: 'ย้อนรอยการผจญภัยในแต่ละภาคเรียน', phase: 2 },
]
</script>

<template>
  <div class="space-y-8">
    <section class="card animate-fade-up overflow-hidden border-rune-400/30 !p-0">
      <div class="absolute -right-16 -top-16 w-64 opacity-50 sm:w-72">
        <MagicCircle />
      </div>
      <div class="relative p-6 sm:p-8">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">WELCOME, TRAVELER</p>
        <h1 class="title-glow mt-2 text-2xl sm:text-3xl">{{ auth.user?.full_name }}</h1>
        <p class="mt-1 text-sm text-slate-400">
          รหัสนักผจญภัย <span class="font-mono text-rune-300">{{ auth.user?.student_code }}</span>
        </p>
        <p class="mt-5 max-w-md text-sm leading-relaxed text-slate-300">
          ในความมืดมีเรื่องราวรอคุณอยู่… เลือกเส้นทางของคุณ แล้วตัวตนที่แท้จริงจะปรากฏ
        </p>
        <div class="mt-5 flex items-center gap-2 text-xs text-slate-400">
          <span class="h-2 w-2 animate-pulse rounded-full bg-rune-400 shadow-glow-gold" />
          ยังไม่พบ Archetype ของคุณ — การเดินทางยังไม่เริ่มต้น
        </div>
      </div>
    </section>

    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">QUESTS</span></div>

    <ComingSoonGrid :items="items" />
  </div>
</template>
