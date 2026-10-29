<script setup lang="ts">
const api = useApi()
const data = ref<any>(null)
const q = ref('')
const role = ref('')
const users = ref<any[]>([])
const msg = ref<{ ok: boolean; text: string } | null>(null)
const courseFilter = ref('')

const ROLE_TH: Record<string, string> = { student: 'นักศึกษา', teacher: 'ครู', admin: 'ผู้ดูแลระบบ' }

async function load() {
  data.value = await api('/admin/overview')
}
async function search() {
  users.value = (await api<any>('/admin/users', { query: { q: q.value, role: role.value } })).users
}
let timer: ReturnType<typeof setTimeout>
watch([q, role], () => {
  clearTimeout(timer)
  timer = setTimeout(search, 300)
})
const requests = ref<any[]>([])
async function loadRequests() {
  requests.value = (await api<any>('/admin/reset-requests')).requests
}
onMounted(() => Promise.all([load(), search(), loadRequests()]))

async function dismiss(r: any) {
  await api(`/admin/reset-requests/${r.id}/dismiss`, { method: 'POST' })
  await Promise.all([loadRequests(), search()])
}

// edit one user
const edit = ref<any>(null)
const editErr = ref('')
function openEdit(u: any) {
  editErr.value = ''
  edit.value = { id: u.id, role: u.role, username: u.username, full_name: u.full_name, department_id: u.department_id ? Number(u.department_id) : null, class_group: u.class_group ?? '', is_active: u.is_active }
}
async function saveEdit() {
  editErr.value = ''
  try {
    const { id, role: _r, ...body } = edit.value
    await api(`/admin/users/${id}`, { method: 'PUT', body })
    msg.value = { ok: true, text: `บันทึกข้อมูล ${edit.value.full_name} แล้ว` }
    edit.value = null
    await Promise.all([search(), load()])
  } catch (e) {
    editErr.value = apiErrorMessage(e)
  }
}

// add one user (no template needed)
const add = ref<any>(null)
const addErr = ref('')
function openAdd() {
  addErr.value = ''
  add.value = { role: 'teacher', username: '', full_name: '', department_id: null, class_group: '', password: '' }
}
async function saveAdd() {
  addErr.value = ''
  try {
    const r = await api<any>('/admin/users', { method: 'POST', body: add.value })
    msg.value = { ok: true, text: r.message }
    q.value = add.value.username
    add.value = null
    await Promise.all([search(), load()])
  } catch (e) {
    addErr.value = apiErrorMessage(e)
  }
}

const courses = computed(() => {
  const f = courseFilter.value.trim().toLowerCase()
  const list = data.value?.courses ?? []
  return f ? list.filter((c: any) => `${c.code} ${c.name} ${c.section} ${c.teacher_name ?? ''} ${c.department_name ?? ''}`.toLowerCase().includes(f)) : list
})

async function resetPw(u: { id: number; full_name: string; username: string }) {
  if (!confirm(`รีเซ็ตรหัสผ่านของ ${u.full_name}?\nรหัสผ่านชั่วคราว = "${u.username}" และผู้ใช้ต้องตั้งรหัสใหม่เมื่อเข้าสู่ระบบ`)) return
  try {
    msg.value = { ok: true, text: (await api<any>(`/admin/users/${u.id}/reset-password`, { method: 'POST' })).message }
    await Promise.all([loadRequests(), search()])
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  }
}

async function removeCourse(c: any) {
  if (!confirm(`ลบรายวิชา ${c.code} ${c.name} (${c.section}) ${c.semester}/${c.academic_year}?\nการลงทะเบียน ${c.enrolled} คน และการจัดกลุ่มของวิชานี้จะถูกลบ (ผลการเล่นเกมของนักศึกษายังอยู่)`)) return
  try {
    await api(`/admin/courses/${c.id}`, { method: 'DELETE' })
    msg.value = { ok: true, text: `ลบรายวิชา ${c.code} แล้ว` }
    await load()
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> หอคอยผู้คุมระบบ</NuxtLink>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">REALM LEDGER</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">ข้อมูลในระบบ</h1>
        <p class="mt-1 text-sm text-slate-400">แผนกวิชา รายวิชา/กลุ่มเรียน และผู้ใช้ — เพิ่มผู้ใช้รายคนได้ที่นี่ หรือเพิ่มทีละมากผ่านการนำเข้าจากไฟล์</p>
      </div>
      <div class="flex gap-2">
        <button class="btn-primary !py-2 text-sm" data-testid="add-user" @click="openAdd"><AppIcon name="plus" :size="16" /> เพิ่มผู้ใช้รายคน</button>
        <NuxtLink to="/admin/import" class="btn-ghost !py-2 text-sm"><AppIcon name="upload" :size="16" /> นำเข้าจากไฟล์</NuxtLink>
      </div>
    </div>

    <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'">{{ msg.text }}</p>
    <!-- forgot-password requests -->
    <section v-if="requests.length" id="requests" class="card space-y-3 border-rune-400/40" data-testid="requests">
      <h2 class="flex items-center gap-2 text-lg font-medium text-rune-200"><AppIcon name="lock" :size="18" /> คำขอรีเซ็ตรหัสผ่าน ({{ requests.length }})</h2>
      <div v-for="r in requests" :key="r.id" class="flex flex-wrap items-center gap-3 rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
        <div class="min-w-0 flex-1">
          <p class="text-slate-100">{{ r.full_name }} <span class="text-sm text-slate-400">· {{ r.username }} · {{ ROLE_TH[r.role] }}{{ r.class_group ? ` · ${r.class_group}` : '' }}</span></p>
          <p class="text-xs text-slate-500">{{ new Date(r.created_at.replace(' ', 'T')).toLocaleString('th-TH') }}<template v-if="r.note"> · “{{ r.note }}”</template></p>
        </div>
        <button v-if="r.role !== 'admin'" class="btn-primary !px-3 !py-1.5 text-sm" @click="resetPw({ id: r.user_id, full_name: r.full_name, username: r.username })">รีเซ็ตรหัสผ่าน</button>
        <span v-else class="text-xs text-slate-400">ผู้ดูแลระบบ: ใช้คำสั่ง reset-password บนเซิร์ฟเวอร์ (ดู DEPLOY.md)</span>
        <button class="text-xs text-slate-500 hover:text-slate-300" @click="dismiss(r)">ปิดคำขอ</button>
      </div>
    </section>

    <p v-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="(label, k) in { students: 'นักศึกษา', teachers: 'ครู', departments: 'แผนกวิชา', courses: 'รายวิชา/กลุ่มเรียน' }" :key="k" class="card !p-4 text-center">
          <p class="font-display text-3xl text-rune-300">{{ data.counts[k] }}</p>
          <p class="text-sm text-slate-400">{{ label }}</p>
        </div>
      </div>

      <section class="card">
        <h2 class="text-lg font-medium text-slate-50">แผนกวิชา</h2>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="d in data.departments" :key="d.id" class="rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
            <p class="text-slate-100"><span class="font-display text-rune-300">{{ d.code }}</span> {{ d.name }}</p>
            <p class="text-xs text-slate-400">นักศึกษา {{ d.students }} · ครู {{ d.teachers }}</p>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-medium text-slate-50">รายวิชา/กลุ่มเรียน ({{ courses.length }})</h2>
          <input v-model="courseFilter" class="input !w-64 !py-1.5" placeholder="ค้นหารหัส ชื่อวิชา ครู แผนก">
        </div>
        <div class="mt-3 max-h-[50vh] overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
              <tr><th class="px-3 py-2">รหัสวิชา</th><th class="px-3 py-2">ชื่อวิชา</th><th class="px-3 py-2">กลุ่ม</th><th class="px-3 py-2">ภาค/ปี</th><th class="px-3 py-2">แผนก</th><th class="px-3 py-2">ครูผู้สอน</th><th class="px-3 py-2 text-right">ผู้เรียน</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="c in courses" :key="c.id" class="border-t border-white/5">
                <td class="whitespace-nowrap px-3 py-2 text-slate-300">{{ c.code }}</td>
                <td class="px-3 py-2 text-slate-100">{{ c.name }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-slate-300">{{ c.section }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-slate-300">{{ c.semester }}/{{ c.academic_year }}</td>
                <td class="px-3 py-2 text-slate-300">{{ c.department_name ?? '-' }}</td>
                <td class="px-3 py-2 text-slate-300">{{ c.teacher_name ?? '-' }}</td>
                <td class="px-3 py-2 text-right text-slate-100">{{ c.enrolled }}</td>
                <td class="px-3 py-2 text-right"><button class="text-xs text-red-300/80 hover:text-red-300" @click="removeCourse(c)">ลบ</button></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-medium text-slate-50">ผู้ใช้</h2>
          <div class="flex gap-2">
            <select v-model="role" class="input !w-auto !py-1.5">
              <option value="">ทุกบทบาท</option>
              <option value="student">นักศึกษา</option>
              <option value="teacher">ครู</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
            <input v-model="q" class="input !w-64 !py-1.5" placeholder="ค้นหาชื่อผู้ใช้ / ชื่อ-สกุล">
          </div>
        </div>
        <p class="mt-1 text-xs text-slate-500">แสดงไม่เกิน 100 รายการ · รีเซ็ตรหัสผ่าน = รหัสชั่วคราวเท่ากับชื่อผู้ใช้ (รหัสนักศึกษา) ผู้ใช้ต้องตั้งใหม่เมื่อเข้าสู่ระบบ และถูกออกจากระบบทุกอุปกรณ์</p>
        <div class="mt-3 max-h-[50vh] overflow-auto rounded-xl ring-1 ring-white/10">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
              <tr><th class="px-3 py-2">ชื่อผู้ใช้</th><th class="px-3 py-2">ชื่อ-สกุล</th><th class="px-3 py-2">บทบาท</th><th class="px-3 py-2">กลุ่มเรียน</th><th class="px-3 py-2">แผนก</th><th /></tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" class="border-t border-white/5" :class="!u.is_active && 'opacity-50'">
                <td class="px-3 py-2 text-slate-300">{{ u.username }}</td>
                <td class="px-3 py-2 text-slate-100">
                  {{ u.full_name }}
                  <span v-if="u.reset_requested" class="ml-1 rounded-full bg-rune-400/20 px-2 py-0.5 text-xs text-rune-200">ขอรีเซ็ตรหัสผ่าน</span>
                  <span v-else-if="u.must_change_password" class="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">รอตั้งรหัสใหม่</span>
                  <span v-if="!u.is_active" class="ml-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">ปิดใช้งาน</span>
                </td>
                <td class="px-3 py-2 text-slate-300">{{ ROLE_TH[u.role] }}</td>
                <td class="px-3 py-2 text-slate-300">{{ u.class_group ?? '-' }}</td>
                <td class="px-3 py-2 text-slate-300">{{ u.department_name ?? '-' }}</td>
                <td class="whitespace-nowrap px-3 py-2 text-right">
                  <button class="mr-3 text-xs text-sky-300/80 hover:text-sky-300" :data-testid="`edit-${u.username}`" @click="openEdit(u)">แก้ไข</button>
                  <button v-if="u.role !== 'admin'" class="text-xs text-rune-300/80 hover:text-rune-300" @click="resetPw(u)">รีเซ็ตรหัสผ่าน</button>
                </td>
              </tr>
              <tr v-if="!users.length"><td colspan="6" class="px-3 py-6 text-center text-slate-500">ไม่พบผู้ใช้</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- add user dialog -->
    <div v-if="add" class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" @click.self="add = null">
      <form class="card w-full max-w-lg space-y-3" data-testid="add-dialog" @submit.prevent="saveAdd">
        <h2 class="text-lg font-medium text-slate-50">เพิ่มผู้ใช้รายคน</h2>
        <div>
          <p class="label">บทบาท</p>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="r in ['teacher', 'student', 'admin']" :key="r" type="button" class="rounded-xl px-3 py-2 text-sm ring-1 transition" :class="add.role === r ? 'bg-rune-400/15 font-medium text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15'" :data-testid="`a-role-${r}`" @click="add.role = r">{{ ROLE_TH[r] }}</button>
          </div>
        </div>
        <div><p class="label">{{ add.role === 'student' ? 'รหัสนักศึกษา (ใช้เข้าสู่ระบบ)' : 'ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ)' }} *</p><input v-model="add.username" class="input" :placeholder="add.role === 'student' ? 'เช่น 6901001' : 'เช่น t.somchai หรือ teacher5'" data-testid="a-username"></div>
        <div><p class="label">ชื่อ-สกุล *</p><input v-model="add.full_name" class="input" :placeholder="add.role === 'student' ? 'เช่น นายกิตติ ใจดี' : 'เช่น ครูสมชาย ใจดี'" data-testid="a-name"></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="label">แผนกวิชา</p>
            <select v-model="add.department_id" class="input" data-testid="a-dept">
              <option :value="null">— ไม่ระบุ —</option>
              <option v-for="d in data?.departments ?? []" :key="d.id" :value="Number(d.id)">{{ d.code }} · {{ d.name }}</option>
            </select>
          </div>
          <div v-if="add.role === 'student'"><p class="label">กลุ่มเรียน</p><input v-model="add.class_group" class="input" placeholder="เช่น ปวส.1/1" data-testid="a-group"></div>
        </div>
        <div><p class="label">รหัสผ่าน (ไม่บังคับ)</p><input v-model="add.password" type="text" class="input" autocomplete="off" placeholder="เว้นว่าง = ใช้ชื่อผู้ใช้/รหัสนักศึกษา และต้องตั้งใหม่เมื่อเข้าครั้งแรก" data-testid="a-password"></div>
        <p v-if="addErr" class="text-sm text-red-300" data-testid="a-err">{{ addErr }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost !py-2 text-sm" @click="add = null">ยกเลิก</button>
          <button class="btn-primary !py-2 text-sm" :disabled="!add.username.trim() || !add.full_name.trim()" data-testid="a-save">เพิ่มผู้ใช้</button>
        </div>
      </form>
    </div>

    <!-- edit user dialog -->
    <div v-if="edit" class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" @click.self="edit = null">
      <div class="card w-full max-w-lg space-y-3" data-testid="edit-dialog">
        <h2 class="text-lg font-medium text-slate-50">แก้ไขผู้ใช้ · {{ ROLE_TH[edit.role] }}</h2>
        <div><p class="label">{{ edit.role === 'student' ? 'รหัสนักศึกษา (ใช้เข้าสู่ระบบ)' : 'ชื่อผู้ใช้ (ใช้เข้าสู่ระบบ)' }}</p><input v-model="edit.username" class="input" data-testid="e-username"></div>
        <div><p class="label">ชื่อ-สกุล</p><input v-model="edit.full_name" class="input" data-testid="e-name"></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <p class="label">แผนกวิชา</p>
            <select v-model="edit.department_id" class="input">
              <option :value="null">— ไม่ระบุ —</option>
              <option v-for="d in data?.departments ?? []" :key="d.id" :value="Number(d.id)">{{ d.code }} · {{ d.name }}</option>
            </select>
          </div>
          <div v-if="edit.role === 'student'"><p class="label">กลุ่มเรียน</p><input v-model="edit.class_group" class="input" placeholder="เช่น ปวส.1/1" data-testid="e-group"></div>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input v-model="edit.is_active" type="checkbox" data-testid="e-active"> เปิดใช้งานบัญชี (ปิด = เข้าสู่ระบบไม่ได้ ข้อมูลยังอยู่)
        </label>
        <p v-if="editErr" class="text-sm text-red-300">{{ editErr }}</p>
        <div class="flex justify-end gap-2">
          <button class="btn-ghost !py-2 text-sm" @click="edit = null">ยกเลิก</button>
          <button class="btn-primary !py-2 text-sm" data-testid="e-save" @click="saveEdit">บันทึก</button>
        </div>
      </div>
    </div>
  </div>
</template>
