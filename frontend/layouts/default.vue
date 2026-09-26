<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const roleLabel = { student: 'ผู้เรียน', teacher: 'ครูผู้สอน', admin: 'ผู้ดูแลระบบ' }
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold text-indigo-700">
          <span class="text-2xl">🎮</span>
          <span class="hidden sm:inline">Gamified Profiling</span>
        </NuxtLink>
        <div v-if="auth.user" class="flex items-center gap-3 text-sm">
          <div class="text-right leading-tight">
            <div class="font-medium text-slate-800">{{ auth.user.full_name }}</div>
            <div class="text-xs text-slate-500">{{ roleLabel[auth.user.role] }}</div>
          </div>
          <button class="btn-ghost text-sm" @click="auth.logout()">ออกจากระบบ</button>
        </div>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
