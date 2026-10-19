<script setup lang="ts">
import { homeFor, useAuthStore } from '~/stores/auth'

const auth = useAuthStore()
const api = useApi()
const profile = ref<any>(null)
const name = ref('')
const nameMsg = ref<{ ok: boolean; text: string } | null>(null)
const pw = reactive({ current: '', next: '', confirm: '' })
const pwMsg = ref<{ ok: boolean; text: string } | null>(null)
const busy = ref(false)
const show = ref(false)
const uname = reactive({ open: false, value: '', password: '' })
const unameMsg = ref<{ ok: boolean; text: string } | null>(null)
// set right after a forced first-login password change: invite placeholder accounts to pick their own name
const justSetPassword = ref(false)
const unameValid = computed(() => /^[A-Za-z0-9._-]{3,50}$/.test(uname.value))

const ROLE_TH: Record<string, string> = { student: 'นักศึกษา', teacher: 'ครูผู้สอน', admin: 'ผู้ดูแลระบบ' }

onMounted(async () => {
  profile.value = (await api<any>('/me/profile')).profile
  name.value = profile.value.full_name
})
const forced = computed(() => !!auth.user?.must_change_password)

// live checks shown under the new-password box
const checks = computed(() => [
  { ok: pw.next.length >= 6, text: 'อย่างน้อย 6 ตัวอักษร' },
  { ok: !!pw.next && pw.next.toLowerCase() !== (profile.value?.username ?? '').toLowerCase(), text: 'ไม่เหมือนชื่อผู้ใช้/รหัสนักศึกษา' },
  { ok: !!pw.next && pw.next === pw.confirm, text: 'พิมพ์ยืนยันตรงกัน' },
])
const canSave = computed(() => pw.current && checks.value.every((c) => c.ok))

async function saveName() {
  nameMsg.value = null
  try {
    profile.value = (await api<any>('/me/profile', { method: 'PUT', body: { full_name: name.value } })).profile
    if (auth.user) auth.user.full_name = profile.value.full_name
    nameMsg.value = { ok: true, text: 'บันทึกชื่อแล้ว' }
  } catch (e) {
    nameMsg.value = { ok: false, text: apiErrorMessage(e) }
  }
}

function openUsername() {
  Object.assign(uname, { open: true, value: profile.value.username, password: '' })
  unameMsg.value = null
}

async function changeUsername() {
  unameMsg.value = null
  busy.value = true
  try {
    const res = await api<any>('/me/username', { method: 'PUT', body: { username: uname.value.trim(), current_password: uname.password } })
    profile.value = res.profile
    if (auth.user) auth.user.username = res.profile.username
    Object.assign(uname, { open: false, password: '' })
    justSetPassword.value = false
    unameMsg.value = { ok: true, text: res.message }
  } catch (e) {
    unameMsg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}

async function changePassword() {
  pwMsg.value = null
  busy.value = true
  try {
    const res = await api<any>('/me/password', { method: 'PUT', body: { current_password: pw.current, new_password: pw.next } })
    const wasForced = forced.value
    if (auth.user) auth.user.must_change_password = false
    Object.assign(pw, { current: '', next: '', confirm: '' })
    pwMsg.value = { ok: true, text: res.message }
    // students go straight in; staff may still want to replace a placeholder username first
    if (wasForced && profile.value.can_edit_name) justSetPassword.value = true
    else if (wasForced) setTimeout(() => navigateTo(homeFor(auth.user!.role)), 1500)
  } catch (e) {
    pwMsg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <NuxtLink v-if="!forced && auth.user" :to="homeFor(auth.user.role)" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> กลับหน้าหลัก</NuxtLink>
    <div>
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">MY ACCOUNT</p>
      <h1 class="title-glow mt-1 text-2xl sm:text-3xl">บัญชีของฉัน</h1>
    </div>

    <div v-if="forced" class="flex gap-3 rounded-xl border border-rune-400/40 bg-rune-400/10 px-4 py-3 text-sm text-rune-100" data-testid="forced">
      <AppIcon name="lock" :size="18" class="mt-0.5 shrink-0 text-rune-300" />
      <p>รหัสผ่านของคุณเป็นรหัสชั่วคราว (ตั้งโดยระบบ/ผู้ดูแล) — <b>กรุณาตั้งรหัสผ่านใหม่ก่อนเริ่มใช้งาน</b> · รหัสผ่านปัจจุบัน = ชื่อผู้ใช้/รหัสนักศึกษาของคุณ</p>
    </div>

    <p v-if="!profile" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <section class="card space-y-3">
        <h2 class="text-lg font-medium text-slate-50">ข้อมูลของฉัน</h2>
        <div v-if="justSetPassword" class="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" data-testid="uname-invite">
          <p class="flex-1">ตั้งรหัสผ่านแล้ว · ถ้าชื่อผู้ใช้ <b>{{ profile.username }}</b> เป็นชื่อชั่วคราวที่ได้รับมา เปลี่ยนเป็นชื่อของคุณเองได้เลย</p>
          <button class="btn-ghost !py-1.5 text-sm" @click="openUsername">เปลี่ยนชื่อผู้ใช้</button>
          <NuxtLink :to="homeFor(profile.role)" class="text-sm text-slate-300 underline">ใช้ชื่อเดิม ไปหน้าหลัก</NuxtLink>
        </div>
        <dl class="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt class="text-slate-400">ชื่อผู้ใช้</dt>
          <dd class="flex flex-wrap items-center gap-2 text-slate-100">
            <span data-testid="username">{{ profile.username }}</span>
            <button v-if="profile.can_edit_name && !uname.open && !forced" class="text-xs text-rune-300 underline hover:text-rune-200" data-testid="uname-edit" @click="openUsername">เปลี่ยนชื่อผู้ใช้</button>
            <span v-else-if="profile.role === 'student'" class="text-xs text-slate-500">(รหัสนักศึกษา · แก้ไขได้โดยผู้ดูแลระบบ)</span>
          </dd>
          <dt class="text-slate-400">บทบาท</dt><dd class="text-slate-100">{{ ROLE_TH[profile.role] }}</dd>
          <dt class="text-slate-400">แผนกวิชา</dt><dd class="text-slate-100">{{ profile.department_name ?? '-' }}</dd>
          <template v-if="profile.role === 'student'">
            <dt class="text-slate-400">กลุ่มเรียน</dt><dd class="text-slate-100">{{ profile.class_group ?? '-' }}</dd>
          </template>
          <dt class="text-slate-400">ชื่อ-สกุล</dt>
          <dd v-if="!profile.can_edit_name" class="text-slate-100">{{ profile.full_name }} <span class="text-xs text-slate-500">(แก้ไขได้โดยผู้ดูแลระบบ)</span></dd>
        </dl>
        <form v-if="uname.open" class="space-y-3 rounded-xl border border-arcane-400/30 bg-abyss-900/40 p-4" data-testid="uname-form" @submit.prevent="changeUsername">
          <p class="text-sm text-slate-300">ชื่อผู้ใช้ใหม่ใช้เข้าสู่ระบบครั้งต่อไป · ใช้ตัวอักษรอังกฤษ ตัวเลข หรือ <code>. _ -</code> ยาว 3–50 ตัว ไม่มีช่องว่าง (เช่น <code>somchai.j</code>)</p>
          <div><p class="label">ชื่อผู้ใช้ใหม่</p><input v-model="uname.value" class="input" autocomplete="off" maxlength="50" data-testid="uname-new"></div>
          <div><p class="label">ยืนยันด้วยรหัสผ่านปัจจุบัน</p><input v-model="uname.password" type="password" class="input" autocomplete="current-password" data-testid="uname-pw"></div>
          <p v-if="uname.value && !unameValid" class="text-xs text-red-300">รูปแบบไม่ถูกต้อง — ห้ามมีช่องว่างหรือภาษาไทย</p>
          <div class="flex gap-2">
            <button class="btn-primary !py-2 text-sm" :disabled="busy || !unameValid || !uname.password || uname.value === profile.username" data-testid="uname-save">บันทึกชื่อผู้ใช้</button>
            <button type="button" class="btn-ghost !py-2 text-sm" @click="uname.open = false">ยกเลิก</button>
          </div>
        </form>
        <p v-if="unameMsg" class="rounded-xl px-3 py-2 text-sm" :class="unameMsg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="uname-msg">{{ unameMsg.text }}</p>
        <div v-if="profile.can_edit_name" class="flex flex-wrap items-center gap-2">
          <input v-model="name" class="input !w-80" maxlength="150" data-testid="name">
          <button class="btn-ghost !py-2 text-sm" :disabled="!name.trim() || name === profile.full_name || forced" @click="saveName">บันทึกชื่อ</button>
          <span v-if="nameMsg" class="text-sm" :class="nameMsg.ok ? 'text-emerald-300' : 'text-red-300'">{{ nameMsg.text }}</span>
        </div>
      </section>

      <section class="card space-y-4" :class="forced && 'border-rune-400/50'">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-medium text-slate-50">เปลี่ยนรหัสผ่าน</h2>
          <label class="flex items-center gap-2 text-sm text-slate-400"><input v-model="show" type="checkbox"> แสดงรหัสผ่าน</label>
        </div>
        <form class="space-y-3" @submit.prevent="changePassword">
          <input :value="profile.username" autocomplete="username" class="hidden" readonly>
          <div><p class="label">รหัสผ่านปัจจุบัน</p><input v-model="pw.current" :type="show ? 'text' : 'password'" class="input" autocomplete="current-password" data-testid="pw-current"></div>
          <div><p class="label">รหัสผ่านใหม่</p><input v-model="pw.next" :type="show ? 'text' : 'password'" class="input" autocomplete="new-password" data-testid="pw-new"></div>
          <div><p class="label">ยืนยันรหัสผ่านใหม่</p><input v-model="pw.confirm" :type="show ? 'text' : 'password'" class="input" autocomplete="new-password" data-testid="pw-confirm"></div>
          <ul class="space-y-0.5 text-xs">
            <li v-for="c in checks" :key="c.text" :class="c.ok ? 'text-emerald-300' : 'text-slate-500'">{{ c.ok ? '✓' : '○' }} {{ c.text }}</li>
          </ul>
          <p v-if="pwMsg" class="rounded-xl px-3 py-2 text-sm" :class="pwMsg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="pw-msg">{{ pwMsg.text }}</p>
          <button class="btn-primary" :disabled="busy || !canSave" data-testid="pw-save"><AppIcon name="lock" :size="16" /> เปลี่ยนรหัสผ่าน</button>
        </form>
      </section>

      <p class="text-center text-xs text-slate-500">ลืมรหัสผ่าน? ออกจากระบบแล้วกด “ลืมรหัสผ่าน?” ที่หน้าเข้าสู่ระบบ หรือแจ้งครูประจำวิชา/ผู้ดูแลระบบ</p>
    </template>
  </div>
</template>
