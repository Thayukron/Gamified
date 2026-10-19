<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

// App shell for teachers and admins: left sidebar (drawer on mobile) + content area.
const auth = useAuthStore()
const route = useRoute()
const open = ref(false)
watch(() => route.fullPath, () => (open.value = false))

interface Item { to: string; label: string; icon: string; exact?: boolean }

const courseId = computed(() => {
  const m = route.path.match(/^\/teacher\/course\/(\d+)/)
  return m ? m[1] : null
})

const main = computed<Item[]>(() =>
  auth.user?.role === 'admin'
    ? [
        { to: '/admin', label: 'ภาพรวมระบบ', icon: 'grid', exact: true },
        { to: '/admin/import', label: 'นำเข้าข้อมูล', icon: 'upload' },
        { to: '/admin/data', label: 'ข้อมูลในระบบ', icon: 'database' },
        { to: '/admin/ai', label: 'ตั้งค่า AI ของระบบ', icon: 'sparkle' },
      ]
    : [
        { to: '/teacher', label: 'รายวิชาของฉัน', icon: 'home', exact: true },
        { to: '/teacher/course/new', label: 'สร้างรายวิชา', icon: 'plus', exact: true },
        { to: '/teacher/settings', label: 'ตั้งค่า AI ของฉัน', icon: 'sparkle' },
      ],
)

const course = computed<Item[]>(() => {
  if (!courseId.value) return []
  const b = `/teacher/course/${courseId.value}`
  return [
    { to: b, label: 'แดชบอร์ดผู้เรียน', icon: 'chart', exact: true },
    { to: `${b}/guide`, label: 'ไกด์การสอน', icon: 'bulb' },
    { to: `${b}/groups`, label: 'จัดกลุ่มผู้เรียน', icon: 'users' },
    { to: `${b}/plans`, label: 'แผนการจัดการเรียนรู้', icon: 'file' },
    { to: `${b}/report`, label: 'รายงาน ว.PA', icon: 'clipboard' },
    { to: `${b}/students`, label: 'รายชื่อ / แก้ไขวิชา', icon: 'list' },
  ]
})

const active = (i: Item) => (i.exact ? route.path === i.to : route.path === i.to || route.path.startsWith(`${i.to}/`))
const roleLabel = computed(() => (auth.user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ครูผู้สอน'))
const initials = computed(() => (auth.user?.full_name ?? '?').replace(/^(ครู|นาย|นางสาว|นาง|ดร\.)\s*/, '').slice(0, 1))
</script>

<template>
  <div class="min-h-screen lg:pl-72">
    <!-- mobile top bar -->
    <header class="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-snow/90 px-4 py-3 backdrop-blur lg:hidden">
      <NuxtLink to="/" class="flex items-center gap-2.5">
        <span class="brand-mark h-9 w-9"><AppIcon name="eye" :size="18" :stroke="2" /></span>
        <span class="font-display text-[15px] font-semibold text-slate-50">ARCANA PROFILE</span>
      </NuxtLink>
      <button class="rounded-lg p-2 text-slate-300 hover:bg-white/5" aria-label="เปิดเมนู" @click="open = true"><AppIcon name="menu" :stroke="2" /></button>
    </header>

    <div v-if="open" class="no-print fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden" style="background: rgba(15, 23, 42, 0.4)" @click="open = false" />

    <aside
      class="no-print fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-snow transition-transform duration-200 lg:translate-x-0"
      :class="open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
      data-testid="staff-sidebar"
    >
      <div class="flex items-center gap-3 px-5 pb-4 pt-5">
        <span class="brand-mark h-10 w-10"><AppIcon name="eye" :size="20" :stroke="2" /></span>
        <div class="min-w-0 leading-tight">
          <p class="font-display text-[15px] font-semibold text-slate-50">ARCANA PROFILE</p>
          <p class="truncate text-xs text-slate-500">ระบบวิเคราะห์ผู้เรียนเพื่อการจัดการเรียนรู้</p>
        </div>
        <button class="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="ปิดเมนู" @click="open = false"><AppIcon name="x" :size="18" :stroke="2" /></button>
      </div>

      <nav class="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        <div>
          <p class="nav-heading">เมนูหลัก</p>
          <NuxtLink v-for="i in main" :key="i.to" :to="i.to" class="nav-item" :class="active(i) && 'nav-item-active'">
            <AppIcon :name="i.icon" :size="19" :stroke="1.8" /> {{ i.label }}
          </NuxtLink>
        </div>
        <div v-if="course.length">
          <p class="nav-heading">รายวิชานี้</p>
          <NuxtLink v-for="i in course" :key="i.to" :to="i.to" class="nav-item" :class="active(i) && 'nav-item-active'">
            <AppIcon :name="i.icon" :size="19" :stroke="1.8" /> {{ i.label }}
          </NuxtLink>
        </div>
      </nav>

      <div v-if="auth.user" class="border-t border-slate-800 p-3">
        <NuxtLink to="/account" class="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5" :class="route.path === '/account' && 'bg-white/5'" data-testid="account-link">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-snow">{{ initials }}</span>
          <span class="min-w-0 flex-1 leading-tight">
            <span class="block truncate text-sm font-medium text-slate-50">{{ auth.user.full_name }}</span>
            <span class="block truncate text-xs text-slate-500">{{ roleLabel }} · {{ auth.user.username }}</span>
          </span>
          <AppIcon name="user" :size="18" class="text-slate-500" />
        </NuxtLink>
        <button class="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-300" @click="auth.logout()">
          <AppIcon name="logout" :size="18" /> ออกจากระบบ
        </button>
      </div>
    </aside>

    <main class="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.brand-mark {
  @apply flex shrink-0 items-center justify-center rounded-xl text-snow;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  box-shadow: 0 8px 18px -8px rgba(79, 70, 229, 0.7);
}
.nav-heading {
  @apply mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500;
}
.nav-item {
  @apply relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] text-slate-300 transition hover:bg-white/5 hover:text-slate-50;
}
.nav-item-active {
  @apply font-medium text-rune-200;
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.06));
}
.nav-item-active::before {
  content: '';
  @apply absolute -left-3 top-2 bottom-2 w-1 rounded-r-full;
  background: linear-gradient(180deg, #6366f1, #8b5cf6);
}
</style>
