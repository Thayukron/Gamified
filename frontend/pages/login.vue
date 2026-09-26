<script setup lang="ts">
import { homeFor, useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'blank' })

const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(username.value, password.value)
    await navigateTo(homeFor(user.role))
  } catch (e) {
    error.value = apiErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="mb-6 text-center text-white">
        <div class="text-5xl">🎮</div>
        <h1 class="mt-2 text-2xl font-bold">Gamified Student Profiling</h1>
        <p class="text-sm text-indigo-100">เล่นเกมเพื่อค้นหาตัวตนของคุณ</p>
      </div>
      <form class="card space-y-4" @submit.prevent="submit">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">ชื่อผู้ใช้ / รหัสนักศึกษา</label>
          <input v-model="username" class="input" autocomplete="username" required>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">รหัสผ่าน</label>
          <input v-model="password" type="password" class="input" autocomplete="current-password" required>
        </div>
        <p v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{{ error }}</p>
        <button class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}
        </button>
      </form>
    </div>
  </div>
</template>
