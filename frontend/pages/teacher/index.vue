<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const items = [
  { icon: '📚', title: 'คลังเนื้อเรื่อง', desc: 'คัดลอกเนื้อเรื่องส่วนกลางไปใช้ได้ทันที', phase: 3 },
  { icon: '✏️', title: 'Scenario Builder', desc: 'สร้างฉาก ตัวเลือก และผูกคะแนนคุณลักษณะ', phase: 3 },
  { icon: '📊', title: 'แดชบอร์ดห้องเรียน', desc: 'กราฟสัดส่วน VARK / RIASEC / Mindset และ Radar รายบุคคล', phase: 4 },
  { icon: '🤖', title: 'AI วิเคราะห์แผนการสอน', desc: 'คำแนะนำการสอนตามบริบทรายวิชา พร้อม Cache', phase: 5 },
  { icon: '📄', title: 'ส่งออกรายงาน', desc: 'PDF / Excel สำหรับ ว.PA และวิจัยชั้นเรียน', phase: 6 },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">สวัสดี {{ auth.user?.full_name }}</h1>
      <p class="text-slate-500">แดชบอร์ดครูผู้สอน</p>
    </div>
    <ComingSoonGrid :items="items" />
  </div>
</template>
