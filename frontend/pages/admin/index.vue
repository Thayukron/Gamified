<script setup lang="ts">
const items = [
  { icon: 'castle', title: 'รายวิชาและแผนกวิชา', desc: 'จัดการอาณาจักร รายวิชา แผนก และกลุ่มเรียน', phase: 6 },
  { icon: 'upload', title: 'นำเข้าข้อมูลนักศึกษา', desc: 'อัญเชิญรายชื่อผ่านไฟล์ CSV / Excel', phase: 6 },
  { icon: 'globe', title: 'ชุดเนื้อเรื่องสากล', desc: 'เปิด/ปิดชุดเนื้อเรื่องมาตรฐานกลาง (Core Profile)', phase: 3 },
  { icon: 'key', title: 'กุญแจเวท AI (BYOK)', desc: 'จัดการ API Key และเปิด/ปิดพลัง AI', phase: 5 },
]
</script>

<template>
  <div class="space-y-8">
    <div class="animate-fade-up">
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">TOWER WARDEN</p>
      <h1 class="title-glow mt-2 text-3xl">หอคอยผู้คุมระบบ</h1>
      <p class="mt-1 text-slate-400">ควบคุมกลไกและผนึกทั้งหมดของอาณาจักร</p>
    </div>
    <div class="divider-rune text-xs tracking-[0.4em]"><span class="font-display">CONTROLS</span></div>
    <ComingSoonGrid :items="items" />
  </div>
</template>
