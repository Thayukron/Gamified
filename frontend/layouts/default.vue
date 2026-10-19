<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const roleLabel = { student: 'นักผจญภัย', teacher: 'ครูผู้สอน', admin: 'ผู้ดูแลระบบ' }

// Learners keep the ARCANA fantasy look; teachers and admins get the formal light theme.
const staff = computed(() =>
  /^\/(teacher|admin)(\/|$)/.test(route.path) || (route.path === '/account' && !!auth.user && auth.user.role !== 'student'),
)
useHead(() => ({ htmlAttrs: { class: staff.value ? 'theme-staff' : '' } }))
</script>

<template>
  <div class="relative min-h-screen">
    <MysticBackground v-if="!staff" class="no-print" />
    <header
      class="no-print sticky top-0 z-20 border-b"
      :class="staff ? 'border-slate-800 shadow-sm' : 'border-arcane-400/15 bg-abyss-950/60 backdrop-blur-xl'"
      :style="staff ? 'background:#fff' : ''"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <span
            v-if="staff"
            class="flex h-9 w-9 items-center justify-center rounded-lg"
            style="background: rgb(28 74 154); color: #fff"
          >
            <AppIcon name="eye" :size="18" />
          </span>
          <span v-else class="flex h-9 w-9 items-center justify-center rounded-full border border-rune-400/50 text-rune-300 shadow-glow-gold transition duration-700 group-hover:rotate-180">
            <AppIcon name="eye" :size="18" />
          </span>
          <span v-if="staff" class="hidden leading-tight sm:block">
            <span class="block text-sm font-bold tracking-wide text-slate-50">ARCANA PROFILE</span>
            <span class="block text-xs text-slate-400">ระบบวิเคราะห์ผู้เรียนเพื่อการจัดการเรียนรู้</span>
          </span>
          <span v-else class="hidden font-display text-sm font-bold tracking-[0.25em] text-rune-300 sm:inline">ARCANA PROFILE</span>
        </NuxtLink>
        <div v-if="auth.user" class="flex items-center gap-3 text-sm">
          <NuxtLink to="/account" class="group flex items-center gap-2 rounded-xl px-2 py-1 transition hover:bg-white/5" title="บัญชีของฉัน · เปลี่ยนรหัสผ่าน" data-testid="account-link">
            <div class="text-right leading-tight">
              <div class="font-medium text-slate-100 group-hover:text-rune-200">{{ auth.user.full_name }}</div>
              <div class="text-xs" :class="staff ? 'text-slate-400' : 'text-rune-400/80'">{{ roleLabel[auth.user.role] }} · บัญชีของฉัน</div>
            </div>
            <AppIcon name="lock" :size="16" class="text-slate-500 group-hover:text-rune-300" />
          </NuxtLink>
          <button class="btn-ghost !px-3 !py-2" title="ออกจากระบบ" @click="auth.logout()">
            <AppIcon name="logout" :size="18" />
            <span class="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
    <main class="relative mx-auto max-w-6xl px-4 py-8">
      <slot />
    </main>
  </div>
</template>
