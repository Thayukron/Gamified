<script setup lang="ts">
const items = [
  { icon: 'castle', title: 'รายวิชาและแผนกวิชา', desc: 'จัดการอาณาจักร รายวิชา แผนก และกลุ่มเรียน', phase: 6 },
  { icon: 'upload', title: 'นำเข้าข้อมูลนักศึกษา', desc: 'อัญเชิญรายชื่อผ่านไฟล์ CSV / Excel', phase: 6 },
  { icon: 'globe', title: 'ชุดเนื้อเรื่องสากล', desc: 'เปิด/ปิดชุดเนื้อเรื่องมาตรฐานกลาง (Core Profile)', phase: 3 },
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
    <NuxtLink to="/admin/ai" class="card card-hover flex items-center gap-4 border-sky-400/30">
      <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/50 text-sky-300"><AppIcon name="key" /></span>
      <div class="flex-1">
        <p class="font-medium text-slate-100">ตั้งค่า AI ของระบบ</p>
        <p class="text-sm text-slate-400">เปิด/ปิด AI · Key กลาง (ไม่บังคับ) · อนุญาตครูรายคน · ดูการใช้งาน</p>
      </div>
      <AppIcon name="back" :size="18" class="rotate-180 text-slate-500" />
    </NuxtLink>
    <ComingSoonGrid :items="items" />
  </div>
</template>
