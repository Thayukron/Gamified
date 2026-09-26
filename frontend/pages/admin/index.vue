<script setup lang="ts">
const items = [
  { icon: '🏫', title: 'รายวิชาและแผนกวิชา', desc: 'จัดการข้อมูลรายวิชา แผนก และกลุ่มเรียน', phase: 6 },
  { icon: '📥', title: 'นำเข้าข้อมูลนักศึกษา', desc: 'นำเข้าผ่านไฟล์ CSV / Excel', phase: 6 },
  { icon: '🌐', title: 'ชุดเนื้อเรื่องสากล', desc: 'เปิด/ปิดชุดเนื้อเรื่องมาตรฐานกลาง (Core Profile)', phase: 3 },
  { icon: '🔑', title: 'ตั้งค่า AI (BYOK)', desc: 'จัดการ API Key และเปิด/ปิดฟังก์ชัน AI', phase: 5 },
]
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-slate-800">ผู้ดูแลระบบ</h1>
      <p class="text-slate-500">บริหารจัดการข้อมูลส่วนกลาง</p>
    </div>
    <ComingSoonGrid :items="items" />
  </div>
</template>
