<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const items = [
  { icon: 'book', title: 'คลังเนื้อเรื่อง', desc: 'คัมภีร์เรื่องเล่าส่วนกลาง คัดลอกไปใช้ได้ทันที', phase: 3 },
  { icon: 'quill', title: 'Scenario Builder', desc: 'รังสรรค์ฉาก ทางเลือก และผูกค่าพลังคุณลักษณะ', phase: 3 },
  { icon: 'chart', title: 'แดชบอร์ดห้องเรียน', desc: 'สัดส่วน VARK / RIASEC / Mindset และ Radar รายบุคคล', phase: 4 },
  { icon: 'orb', title: 'ลูกแก้วพยากรณ์ AI', desc: 'คำแนะนำการสอนตามบริบทรายวิชา พร้อมระบบ Cache', phase: 5 },
  { icon: 'scroll', title: 'ส่งออกรายงาน', desc: 'PDF / Excel สำหรับ ว.PA และวิจัยชั้นเรียน', phase: 6 },
]
</script>

<template>
  <div class="space-y-8">
    <div class="animate-fade-up">
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">KEEPER OF KNOWLEDGE</p>
      <h1 class="title-glow mt-2 text-3xl">สวัสดี {{ auth.user?.full_name }}</h1>
      <p class="mt-1 text-slate-400">หอสังเกตการณ์ของผู้พิทักษ์ความรู้ — มองเห็นศักยภาพที่ซ่อนอยู่ในผู้เรียนทุกคน</p>
    </div>
    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">ARTIFACTS</span></div>
    <ComingSoonGrid :items="items" />
  </div>
</template>
