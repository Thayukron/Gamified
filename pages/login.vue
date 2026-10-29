<script setup lang="ts">
import { homeFor, useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'blank' })

const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const shake = ref(false)

async function submit() {
  error.value = ''
  loading.value = true
  try {
    const user = await auth.login(username.value, password.value)
    await navigateTo(user.must_change_password ? '/account' : homeFor(user.role))
  } catch (e) {
    error.value = apiErrorMessage(e)
    shake.value = true
    setTimeout(() => (shake.value = false), 500)
  } finally {
    loading.value = false
  }
}

// forgot password: no e-mail for students, so the request goes to the admin / course teachers
const forgotOpen = ref(false)
const forgotUser = ref('')
const forgotNote = ref('')
const forgotMsg = ref('')
const forgotErr = ref('')
async function sendForgot() {
  forgotErr.value = ''
  try {
    forgotMsg.value = (await useApi()<any>('/auth/forgot', { method: 'POST', body: { username: forgotUser.value, note: forgotNote.value } })).message
  } catch (e) {
    forgotErr.value = apiErrorMessage(e)
  }
}
function openForgot() {
  forgotOpen.value = true
  forgotUser.value = username.value
  forgotMsg.value = ''
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-10">
    <div class="w-full max-w-sm">
      <!-- sigil -->
      <div class="mx-auto -mb-10 w-56 animate-fade-up sm:w-64">
        <MagicCircle>
          <div class="flex h-16 w-16 animate-float items-center justify-center rounded-full border border-rune-300/60 bg-abyss-900/80 text-rune-200 shadow-glow-gold">
            <AppIcon name="eye" :size="30" />
          </div>
        </MagicCircle>
      </div>

      <div class="relative text-center animate-fade-up" style="animation-delay: 200ms">
        <h1 class="title-glow text-3xl font-black tracking-[0.2em]">ARCANA</h1>
        <p class="mt-1 font-display text-xs tracking-[0.5em] text-arcane-300/80">PROFILE · CHRONICLES</p>
        <p class="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
          ทุกการตัดสินใจเผยตัวตนที่ซ่อนอยู่ ·
          <span class="text-rune-300/90">ประตูแห่งการค้นพบกำลังรอคุณ</span>
        </p>
      </div>

      <div class="mt-8 animate-fade-up" style="animation-delay: 400ms">
        <form class="card space-y-5 border-rune-400/25" :class="{ 'animate-shake': shake }" @submit.prevent="submit">
        <span class="absolute left-3 top-3 h-5 w-5 border-l border-t border-rune-400/50" />
        <span class="absolute right-3 top-3 h-5 w-5 border-r border-t border-rune-400/50" />
        <span class="absolute bottom-3 left-3 h-5 w-5 border-b border-l border-rune-400/50" />
        <span class="absolute bottom-3 right-3 h-5 w-5 border-b border-r border-rune-400/50" />

        <div>
          <label class="label">นามผู้เดินทาง</label>
          <input v-model="username" class="input" placeholder="ชื่อผู้ใช้ / รหัสนักศึกษา" autocomplete="username" required>
        </div>
        <div>
          <label class="label">รหัสลับ</label>
          <input v-model="password" type="password" class="input" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <p v-if="error" class="rounded-xl border border-red-500/30 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          ✦ {{ error }}
        </p>
        <button class="btn-primary w-full !py-3 text-base font-semibold" :disabled="loading">
          <AppIcon name="sparkle" :size="18" />
          {{ loading ? 'กำลังเปิดประตูมิติ...' : 'เปิดประตูสู่การผจญภัย' }}
        </button>
        <p class="text-center">
          <a href="#" class="text-sm text-slate-400 underline-offset-4 hover:text-rune-300 hover:underline" data-testid="forgot-link" @click.prevent="openForgot">ลืมรหัสผ่าน?</a>
        </p>
        </form>

        <div v-if="forgotOpen" class="card mt-4 space-y-3 border-arcane-400/30" data-testid="forgot">
          <div class="flex items-start justify-between gap-2">
            <h2 class="font-medium text-slate-100">ลืมรหัสผ่าน</h2>
            <a href="#" class="text-sm text-slate-500 hover:text-slate-300" @click.prevent="forgotOpen = false">ปิด ✕</a>
          </div>
          <template v-if="!forgotMsg">
            <p class="text-sm text-slate-400">ส่งคำขอให้ผู้ดูแลระบบหรือครูประจำวิชารีเซ็ตรหัสผ่าน · หรือแจ้งครูในชั้นเรียนได้ทันที</p>
            <input v-model="forgotUser" class="input" placeholder="ชื่อผู้ใช้ / รหัสนักศึกษา" data-testid="forgot-user">
            <input v-model="forgotNote" class="input" maxlength="200" placeholder="ข้อความถึงผู้ดูแล (ไม่บังคับ) เช่น ห้อง/เบอร์ติดต่อ">
            <p v-if="forgotErr" class="text-sm text-red-300">{{ forgotErr }}</p>
            <a href="#" class="btn-ghost w-full !py-2 text-sm" :class="!forgotUser.trim() && 'pointer-events-none opacity-50'" data-testid="forgot-send" @click.prevent="sendForgot">ส่งคำขอรีเซ็ตรหัสผ่าน</a>
          </template>
          <p v-else class="rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300" data-testid="forgot-msg">{{ forgotMsg }}</p>
        </div>
      </div>

      <p class="mt-6 text-center text-xs tracking-widest text-slate-600">— เล่นเกม · ค้นหาตัวตน · ปลดล็อกศักยภาพ —</p>
    </div>
  </div>
</template>

