<script setup lang="ts">
const links = [
  { to: "/admin/import", icon: "upload", tone: "indigo", title: "นำเข้าข้อมูล", desc: "แผนก · ครู · นักศึกษา · รายวิชา · การลงทะเบียน จากไฟล์ Excel / CSV" },
  { to: "/admin/data", icon: "database", tone: "emerald", title: "ข้อมูลในระบบ", desc: "แผนกวิชา รายวิชา/กลุ่มเรียน ผู้ใช้ · รีเซ็ตรหัสผ่าน · ลบรายวิชา" },
  { to: "/admin/ai", icon: "sparkle", tone: "fuchsia", title: "ตั้งค่า AI ของระบบ", desc: "เปิด/ปิด AI · Key กลาง (ไม่บังคับ) · อนุญาตครูรายคน · ดูการใช้งาน" },
]

const api = useApi()
const inst = reactive({ name: '', affiliation: '' })
const instMsg = ref('')
const pendingResets = ref(0)
const counts = ref<Record<string, number> | null>(null)
onMounted(async () => {
  Object.assign(inst, await api('/admin/institution'))
  pendingResets.value = (await api<any>('/admin/reset-requests')).requests.length
  counts.value = (await api<any>('/admin/overview')).counts
})
async function saveInst() {
  instMsg.value = ''
  try {
    Object.assign(inst, await api('/admin/institution', { method: 'PUT', body: inst }))
    instMsg.value = 'บันทึกแล้ว — ใช้บนหน้าปกรายงาน ว.PA'
  } catch (e) {
    instMsg.value = apiErrorMessage(e)
  }
}
</script>

<template>
  <div class="space-y-8">
    <section class="staff-hero">
      <div class="relative">
        <p class="text-sm text-indigo-100/90">ผู้ดูแลระบบ</p>
        <h1 class="mt-1 text-2xl font-semibold sm:text-3xl">ภาพรวมระบบ</h1>
        <p class="mt-1 max-w-xl text-indigo-100/90">จัดการข้อมูลผู้ใช้ รายวิชา และการตั้งค่าส่วนกลางของสถานศึกษา</p>
      </div>
      <div class="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:max-w-3xl">
        <div v-for="s in [{ v: counts?.students, l: 'นักศึกษา' }, { v: counts?.teachers, l: 'ครูผู้สอน' }, { v: counts?.courses, l: 'รายวิชา' }, { v: counts?.departments, l: 'แผนกวิชา' }]" :key="s.l" class="rounded-2xl bg-snow/10 px-4 py-3 ring-1 ring-inset ring-snow/15 backdrop-blur">
          <p class="font-display text-2xl font-semibold tabular-nums">{{ s.v ?? '–' }}</p>
          <p class="text-xs text-indigo-100/90">{{ s.l }}</p>
        </div>
      </div>
    </section>

    <NuxtLink v-if="pendingResets" to="/admin/data#requests" class="card card-hover flex items-center gap-4 !py-4" data-testid="pending-resets">
      <StaffIcon name="lock" tone="amber" size="sm" />
      <span class="flex-1 text-slate-100">มีคำขอรีเซ็ตรหัสผ่าน <b class="text-amber-200">{{ pendingResets }}</b> รายการรอดำเนินการ</span>
      <span class="text-sm font-medium text-rune-300">จัดการ →</span>
    </NuxtLink>

    <section class="space-y-4">
      <h2 class="staff-section">เครื่องมือผู้ดูแลระบบ</h2>
      <div class="grid gap-4 lg:grid-cols-3">
        <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="card card-hover group flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <StaffIcon :name="l.icon" :tone="l.tone" size="lg" />
            <AppIcon name="chevron" :size="18" class="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-rune-300" />
          </div>
          <div>
            <p class="font-display text-lg font-semibold text-slate-50">{{ l.title }}</p>
            <p class="mt-1 text-sm text-slate-400">{{ l.desc }}</p>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section class="card">
      <div class="flex items-center gap-3">
        <StaffIcon name="building" tone="sky" size="sm" />
        <h2 class="text-lg font-semibold text-slate-50">ข้อมูลสถานศึกษา <span class="text-sm font-normal text-slate-400">(แสดงบนหน้าปกรายงาน)</span></h2>
      </div>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div><p class="label">ชื่อสถานศึกษา</p><input v-model="inst.name" class="input"></div>
        <div><p class="label">สังกัด</p><input v-model="inst.affiliation" class="input"></div>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <button class="btn-primary !py-2 text-sm" @click="saveInst">บันทึก</button>
        <span class="text-sm text-slate-400">{{ instMsg }}</span>
      </div>
    </section>
  </div>
</template>
