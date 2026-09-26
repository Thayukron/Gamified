<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const items = [
  { icon: '🗺️', title: 'เลือกเควสต์', desc: 'เลือกเนื้อเรื่องเกมจำลองสถานการณ์ที่เปิดให้เล่น', phase: 2 },
  { icon: '🃏', title: 'การ์ดตัวละครของฉัน', desc: 'ดู Archetype Card ที่สรุปจุดแข็งของคุณ', phase: 2 },
  { icon: '🕘', title: 'ประวัติการเล่น', desc: 'ย้อนดูผลการเล่นในแต่ละภาคเรียน', phase: 2 },
]
</script>

<template>
  <div class="space-y-6">
    <div class="card bg-gradient-to-r from-indigo-600 to-violet-600 text-white ring-0">
      <p class="text-sm text-indigo-100">ยินดีต้อนรับ</p>
      <h1 class="text-2xl font-bold">{{ auth.user?.full_name }}</h1>
      <p class="mt-1 text-sm text-indigo-100">รหัสนักศึกษา {{ auth.user?.student_code }}</p>
    </div>
    <ComingSoonGrid :items="items" />
  </div>
</template>
