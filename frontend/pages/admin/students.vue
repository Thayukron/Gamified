<script setup lang="ts">
// Class groups over the years: promote a whole group (same accounts, no re-import) and set student status
// (graduated / dropped out / closed) for a whole group or selected students. Data is kept, only hidden.
const api = useApi()
const groups = ref<any[]>([])
const STATUS_TH = ref<Record<string, string>>({})
const msg = ref<{ ok: boolean; text: string } | null>(null)
const busy = ref(false)
const filter = ref('')
const showClosed = ref(false)
const open = ref('')           // expanded group
const members = ref<any[]>([])
const picked = ref<Set<number>>(new Set())
const promote = reactive({ group: '', to: '' })

const STATUS_CLS: Record<string, string> = {
  studying: 'bg-emerald-500/15 text-emerald-300',
  graduated: 'bg-sky-500/15 text-sky-300',
  dropped: 'bg-amber-500/15 text-amber-200',
  inactive: 'bg-white/10 text-slate-400',
}

async function load() {
  const r = await api<any>('/admin/class-groups')
  groups.value = r.groups
  STATUS_TH.value = r.status_th
}
onMounted(load)

const shown = computed(() => {
  const f = filter.value.trim().toLowerCase()
  return groups.value.filter((g) => (showClosed.value || g.studying > 0) && (!f || `${g.name} ${g.department_name ?? ''}`.toLowerCase().includes(f)))
})
const closedCount = computed(() => groups.value.filter((g) => g.studying === 0).length)

async function run(fn: () => Promise<string | void>) {
  busy.value = true
  msg.value = null
  try {
    const text = await fn()
    if (text) msg.value = { ok: true, text }
    await load()
    if (open.value) await loadMembers(open.value)
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}

async function loadMembers(g: string) {
  members.value = (await api<any>('/admin/class-groups/members', { query: { group: g } })).students
}
async function toggle(g: string) {
  picked.value = new Set()
  if (open.value === g) {
    open.value = ''
    return
  }
  open.value = g
  await loadMembers(g)
}

function startPromote(g: any) {
  // suggest the next year: ปวส.1/1 -> ปวส.2/1
  promote.group = g.name
  promote.to = g.name.replace(/(\D)(\d)(\/)/, (_: string, a: string, n: string, b: string) => `${a}${Number(n) + 1}${b}`)
}
const doPromote = () => run(async () => {
  if (!confirm(`ย้ายนักศึกษาที่กำลังศึกษาทั้งหมดในกลุ่ม ${promote.group} ไปเป็นกลุ่ม ${promote.to}?\n(ใช้บัญชีเดิม ไม่ต้องนำเข้าใหม่)`)) return
  const r = await api<any>('/admin/class-groups/rename', { method: 'POST', body: { from: promote.group, to: promote.to } })
  if (open.value === promote.group) open.value = ''
  promote.group = ''
  return r.message
})

const setGroupStatus = (g: any, status: string) => run(async () => {
  if (!confirm(`เปลี่ยนนักศึกษาทั้งกลุ่ม ${g.name} (${g.total} คน) เป็น “${STATUS_TH.value[status]}”?\n${status === 'studying' ? 'นักศึกษาจะเข้าระบบได้อีกครั้ง' : 'นักศึกษาจะเข้าสู่ระบบไม่ได้และไม่แสดงในรายวิชา — ข้อมูลเดิมยังเก็บไว้ครบ เปลี่ยนกลับได้'}`)) return
  return (await api<any>('/admin/students/status', { method: 'POST', body: { class_group: g.name, status } })).message
})
const setPickedStatus = (status: string) => run(async () => {
  if (!confirm(`เปลี่ยนนักศึกษาที่เลือก ${picked.value.size} คน เป็น “${STATUS_TH.value[status]}”?`)) return
  const r = await api<any>('/admin/students/status', { method: 'POST', body: { student_ids: [...picked.value], status } })
  picked.value = new Set()
  return r.message
})
function pick(id: number) {
  const s = new Set(picked.value)
  s.has(id) ? s.delete(id) : s.add(id)
  picked.value = s
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div>
      <h1 class="title-glow text-2xl sm:text-3xl">นักศึกษาและกลุ่มเรียน</h1>
      <p class="mt-1 text-sm text-slate-400">เลื่อนชั้นทั้งกลุ่มโดยใช้รายชื่อเดิม · ตั้งสถานะสำเร็จการศึกษา / ออกกลางคัน ทั้งกลุ่มหรือรายคน — ข้อมูลไม่ถูกลบ แค่ซ่อนจากรายวิชาและเข้าระบบไม่ได้ เปลี่ยนกลับได้เสมอ</p>
    </div>

    <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'" data-testid="msg">{{ msg.text }}</p>

    <div class="flex flex-wrap items-center gap-3">
      <input v-model="filter" class="input !w-72 !py-2" placeholder="ค้นหากลุ่มเรียน / แผนก">
      <label v-if="closedCount" class="flex items-center gap-2 text-sm text-slate-400"><input v-model="showClosed" type="checkbox"> แสดงกลุ่มที่ไม่มีผู้กำลังศึกษา ({{ closedCount }})</label>
    </div>

    <section class="card overflow-hidden !p-0">
      <table class="w-full text-sm">
        <thead class="bg-abyss-700/60 text-left text-slate-400">
          <tr>
            <th class="px-4 py-3">กลุ่มเรียน</th>
            <th class="px-4 py-3">แผนก</th>
            <th class="px-4 py-3 text-center">กำลังศึกษา</th>
            <th class="px-4 py-3 text-center">สำเร็จ / ออก / ปิด</th>
            <th class="px-4 py-3 text-right">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in shown" :key="g.name">
            <tr class="border-t border-white/5" :data-testid="`group-${g.name}`">
              <td class="px-4 py-3">
                <button class="flex items-center gap-2 font-medium text-slate-50 hover:text-rune-300" @click="toggle(g.name)">
                  <AppIcon name="chevron" :size="14" class="transition" :class="open === g.name && 'rotate-90'" /> {{ g.name }}
                </button>
              </td>
              <td class="px-4 py-3 text-slate-400">{{ g.department_name ?? '-' }}</td>
              <td class="px-4 py-3 text-center font-medium text-slate-100">{{ g.studying }}</td>
              <td class="px-4 py-3 text-center text-slate-400">{{ g.graduated }} / {{ g.dropped }} / {{ g.inactive }}</td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <button v-if="g.studying" class="mr-3 text-sm font-medium text-rune-300 hover:underline" :disabled="busy" :data-testid="`promote-${g.name}`" @click="startPromote(g)">เลื่อนชั้น / เปลี่ยนชื่อกลุ่ม</button>
                <button v-if="g.studying" class="mr-3 text-sm text-sky-300 hover:underline" :disabled="busy" :data-testid="`graduate-${g.name}`" @click="setGroupStatus(g, 'graduated')">สำเร็จการศึกษาทั้งกลุ่ม</button>
                <button v-else class="text-sm text-emerald-300 hover:underline" :disabled="busy" @click="setGroupStatus(g, 'studying')">กลับมากำลังศึกษา</button>
              </td>
            </tr>
            <tr v-if="promote.group === g.name" class="bg-rune-400/5">
              <td colspan="5" class="px-4 py-3">
                <div class="flex flex-wrap items-center gap-3 text-sm">
                  <span class="text-slate-300">ย้ายผู้ที่กำลังศึกษาในกลุ่ม <b>{{ g.name }}</b> ({{ g.studying }} คน) ไปเป็นกลุ่ม</span>
                  <input v-model="promote.to" class="input !w-40 !py-1.5" maxlength="30" data-testid="promote-to">
                  <button class="btn-primary !py-1.5 text-sm" :disabled="busy || !promote.to.trim() || promote.to === g.name" data-testid="promote-save" @click="doPromote">ยืนยันเลื่อนชั้น</button>
                  <button class="btn-ghost !py-1.5 text-sm" @click="promote.group = ''">ยกเลิก</button>
                  <span class="w-full text-xs text-slate-500">ใช้บัญชีเดิมทั้งหมด ผลโปรไฟล์และประวัติยังอยู่ · รายวิชาเดิมไม่เปลี่ยน — ครูเพิ่มกลุ่มชื่อใหม่เข้ารายวิชาของภาคเรียนใหม่ได้เลย</span>
                </div>
              </td>
            </tr>
            <tr v-if="open === g.name">
              <td colspan="5" class="bg-abyss-700/30 px-4 py-3">
                <div class="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span class="text-slate-400">เลือกแล้ว {{ picked.size }} คน</span>
                  <template v-if="picked.size">
                    <button v-for="st in ['dropped', 'graduated', 'inactive', 'studying']" :key="st" class="btn-ghost !px-3 !py-1 text-xs" :disabled="busy" :data-testid="`set-${st}`" @click="setPickedStatus(st)">→ {{ STATUS_TH[st] }}</button>
                  </template>
                </div>
                <div class="max-h-80 overflow-auto rounded-xl ring-1 ring-white/10">
                  <table class="w-full text-sm">
                    <tbody>
                      <tr v-for="s in members" :key="s.id" class="border-t border-white/5 first:border-0">
                        <td class="w-10 px-3 py-2"><input type="checkbox" :checked="picked.has(s.id)" :data-testid="`pick-${s.student_code}`" @change="pick(s.id)"></td>
                        <td class="px-3 py-2 text-slate-300">{{ s.student_code }}</td>
                        <td class="px-3 py-2 text-slate-100">{{ s.full_name }}</td>
                        <td class="px-3 py-2 text-right"><span class="rounded-full px-2 py-0.5 text-xs" :class="STATUS_CLS[s.status]">{{ STATUS_TH[s.status] }}</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </template>
          <tr v-if="!shown.length"><td colspan="5" class="px-4 py-8 text-center text-slate-500">ไม่พบกลุ่มเรียน</td></tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
