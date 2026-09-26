<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const roleLabel = { student: 'นักผจญภัย', teacher: 'ผู้พิทักษ์ความรู้', admin: 'ผู้คุมหอคอย' }
</script>

<template>
  <div class="relative min-h-screen">
    <MysticBackground />
    <header class="sticky top-0 z-20 border-b border-arcane-400/15 bg-abyss-950/60 backdrop-blur-xl">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NuxtLink to="/" class="group flex items-center gap-2.5">
          <span class="flex h-9 w-9 items-center justify-center rounded-full border border-rune-400/50 text-rune-300 shadow-glow-gold transition duration-700 group-hover:rotate-180">
            <AppIcon name="eye" :size="18" />
          </span>
          <span class="hidden font-display text-sm font-bold tracking-[0.25em] text-rune-300 sm:inline">ARCANA PROFILE</span>
        </NuxtLink>
        <div v-if="auth.user" class="flex items-center gap-3 text-sm">
          <div class="text-right leading-tight">
            <div class="font-medium text-slate-100">{{ auth.user.full_name }}</div>
            <div class="text-xs text-rune-400/80">{{ roleLabel[auth.user.role] }}</div>
          </div>
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
