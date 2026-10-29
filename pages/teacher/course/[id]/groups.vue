<script setup lang="ts">
import { RIASEC } from '~/utils/profile'

interface Member {
  id: number
  code: string
  name: string
  profiled: boolean
  riasec: string[]
  vark: string | null
  mindset: 'growth' | 'mixed' | 'fixed' | null
  archetype: { name: string; icon: string; color: string } | null
  role: string
}
interface Group { no: number; members: Member[]; interests: string[]; styles: string[]; fixed: number; notes: string[] }

const route = useRoute()
const api = useApi()
const course = ref<any>(null)
const groups = ref<Group[]>([])
const unassigned = ref<Member[]>([])
const savedAt = ref<string | null>(null)
const dirty = ref(false)
const busy = ref(false)
const msg = ref<{ ok: boolean; text: string } | null>(null)
const settings = reactive({ size: 4, mode: 'mixed' as 'mixed' | 'similar', include_unprofiled: true })

const VARK_TH: Record<string, string> = { V: 'ภาพ', A: 'ฟัง', R: 'อ่านเขียน', K: 'ลงมือทำ', M: 'หลายช่องทาง' }
const MINDSET_TH: Record<string, string> = { growth: 'Growth', mixed: 'Mixed', fixed: 'Fixed' }

onMounted(async () => {
  const [dash, saved] = await Promise.all([api(`/teacher/courses/${route.params.id}/dashboard`), api(`/teacher/courses/${route.params.id}/groups`)])
  course.value = dash.course
  if (saved.saved) {
    apply(saved.saved)
    settings.size = saved.saved.settings.size
    settings.mode = saved.saved.settings.mode
    savedAt.value = saved.saved.saved_at
  }
})

function apply(res: { groups: Group[]; unassigned: Member[] }) {
  groups.value = res.groups
  unassigned.value = res.unassigned
}

async function run(fn: () => Promise<void>) {
  busy.value = true
  msg.value = null
  try {
    await fn()
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}

const generate = () =>
  run(async () => {
    apply(await api(`/teacher/courses/${route.params.id}/groups/preview`, { method: 'POST', body: { ...settings } }))
    dirty.value = true
  })

function moveMember(m: Member, from: number, to: number) {
  const src = from < 0 ? unassigned.value : groups.value[from].members
  src.splice(src.findIndex((x) => x.id === m.id), 1)
  if (to === -2) groups.value.push({ no: groups.value.length + 1, members: [m], interests: [], styles: [], fixed: 0, notes: [] })
  else if (to < 0) unassigned.value.push(m)
  else groups.value[to].members.push(m)
  groups.value = groups.value.filter((g) => g.members.length)
  dirty.value = true
  recompute()
}

// After a manual move, recompute roles/notes server-side without saving (dry_run).
async function recompute() {
  await run(async () => {
    const ids = groups.value.map((g) => g.members.map((m) => m.id))
    const res = await api(`/teacher/courses/${route.params.id}/groups`, { method: 'PUT', body: { mode: settings.mode, size: settings.size, groups: ids, dry_run: true } })
    apply(res.saved)
  })
}

const save = () =>
  run(async () => {
    const ids = groups.value.map((g) => g.members.map((m) => m.id))
    const res = await api(`/teacher/courses/${route.params.id}/groups`, { method: 'PUT', body: { mode: settings.mode, size: settings.size, groups: ids } })
    apply(res.saved)
    savedAt.value = res.saved.saved_at
    dirty.value = false
    msg.value = { ok: true, text: 'บันทึกการจัดกลุ่มแล้ว — จะใช้ในรายงาน ว.PA' }
  })

const printPage = () => window.print()
const fmt = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const totalMembers = computed(() => groups.value.reduce((n, g) => n + g.members.length, 0))
</script>

<template>
  <div class="print-doc">
    <div class="no-print flex flex-wrap items-center justify-between gap-2">
      <NuxtLink :to="`/teacher/course/${route.params.id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> กลับแดชบอร์ด</NuxtLink>
      <button v-if="groups.length" class="btn-ghost !py-2 text-sm" @click="printPage"><AppIcon name="download" :size="16" /> พิมพ์ / บันทึก PDF</button>
    </div>

    <div class="mt-3 space-y-6">
      <p class="print-only">ARCANA PROFILE · ระบบประเมินโปรไฟล์ผู้เรียน · พิมพ์เมื่อ {{ new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) }}</p>
      <header>
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">SMART GROUPING</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">การจัดกลุ่มผู้เรียน</h1>
        <p v-if="course" class="mt-1 text-slate-200">{{ course.code }} {{ course.name }} · {{ course.section }}</p>
        <p class="text-sm text-slate-400">
          {{ settings.mode === 'mixed' ? 'แบบคละจุดแข็ง (งานกลุ่ม/โปรเจกต์)' : 'แบบสไตล์การเรียนเดียวกัน (ซ่อมเสริม)' }}
          <template v-if="groups.length"> · {{ groups.length }} กลุ่ม · {{ totalMembers }} คน</template>
          <template v-if="savedAt"> · บันทึกล่าสุด {{ fmt(savedAt) }}</template>
        </p>
      </header>

      <!-- controls -->
      <section class="no-print card">
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <p class="label">จุดประสงค์</p>
            <div class="flex gap-2">
              <button class="opt" :class="{ 'opt-on': settings.mode === 'mixed' }" @click="settings.mode = 'mixed'">คละจุดแข็ง · งานกลุ่ม</button>
              <button class="opt" :class="{ 'opt-on': settings.mode === 'similar' }" @click="settings.mode = 'similar'">สไตล์เดียวกัน · ซ่อมเสริม</button>
            </div>
          </div>
          <div>
            <p class="label">คนต่อกลุ่ม</p>
            <div class="flex gap-1.5">
              <button v-for="n in [2, 3, 4, 5, 6]" :key="n" class="opt !px-3" :class="{ 'opt-on': settings.size === n }" @click="settings.size = n">{{ n }}</button>
            </div>
          </div>
          <label class="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-300">
            <input v-model="settings.include_unprofiled" type="checkbox" class="h-4 w-4 accent-amber-400"> รวมผู้เรียนที่ยังไม่เล่นเกมด้วย
          </label>
          <div class="ml-auto flex gap-2">
            <button class="btn-primary" :disabled="busy" @click="generate"><AppIcon name="sparkle" :size="16" /> {{ groups.length ? 'สุ่มจัดใหม่' : 'จัดกลุ่มอัตโนมัติ' }}</button>
            <button v-if="groups.length" class="btn-ghost" :disabled="busy || !dirty" @click="save"><AppIcon name="check" :size="16" /> บันทึก</button>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-400">
          <template v-if="settings.mode === 'mixed'">คละความสนใจ (RIASEC) และสไตล์การเรียน (VARK) ให้หลากหลายในแต่ละกลุ่ม และเกลี่ยผู้เรียน Fixed Mindset ให้อยู่กับเพื่อนที่พร้อมช่วยเหลือ</template>
          <template v-else>รวมผู้เรียนสไตล์การเรียนเดียวกัน เพื่อให้ครูใช้วิธีซ่อมเสริมแบบเดียวกันได้ทั้งกลุ่ม</template>
          · ย้ายสมาชิกข้ามกลุ่มได้จากเมนู “ย้ายไป”
        </p>
        <p v-if="dirty" class="mt-2 text-xs text-amber-300">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</p>
        <p v-if="msg" class="mt-3 rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'">{{ msg.text }}</p>
      </section>

      <p v-if="!groups.length" class="card text-slate-400">ยังไม่ได้จัดกลุ่ม — เลือกจุดประสงค์และขนาดกลุ่ม แล้วกด “จัดกลุ่มอัตโนมัติ”</p>

      <!-- groups -->
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section v-for="(g, gi) in groups" :key="gi" class="card group-card !p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-slate-50">กลุ่มที่ {{ gi + 1 }} <span class="text-sm font-normal text-slate-400">· {{ g.members.length }} คน</span></h2>
            <div class="flex gap-1">
              <span v-for="l in g.interests" :key="l" class="rounded bg-white/10 px-1.5 text-xs text-slate-200" :title="RIASEC[l as keyof typeof RIASEC]?.th">{{ l }}</span>
            </div>
          </div>
          <!-- print: compact table -->
          <table class="print-only-table mt-2 w-full">
            <thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th>บทบาทที่แนะนำ</th><th>ความสนใจ</th><th>สไตล์</th><th>Mindset</th></tr></thead>
            <tbody>
              <tr v-for="m in g.members" :key="m.id">
                <td>{{ m.code }}</td><td>{{ m.name }}</td><td>{{ m.role }}</td>
                <td>{{ m.riasec.join('') || '-' }}</td><td>{{ m.profiled ? VARK_TH[m.vark ?? 'M'] : '-' }}</td><td>{{ m.mindset ? MINDSET_TH[m.mindset] : '-' }}</td>
              </tr>
            </tbody>
          </table>
          <ul class="screen-list mt-3 space-y-2">
            <li v-for="m in g.members" :key="m.id" class="member">
              <div class="flex items-start gap-2">
                <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border" :style="m.archetype ? { borderColor: m.archetype.color, color: m.archetype.color } : {}">
                  <AppIcon :name="m.archetype?.icon ?? 'eye'" :size="14" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-slate-100"><span class="font-mono text-xs text-slate-500">{{ m.code }}</span> {{ m.name }}</p>
                  <p class="text-xs text-rune-300">{{ m.role }}</p>
                  <p v-if="m.profiled" class="text-xs text-slate-400">
                    {{ m.riasec.join('') }} · {{ VARK_TH[m.vark ?? 'M'] }} · <span :class="{ 'text-[#e8845a]': m.mindset === 'fixed' }">{{ MINDSET_TH[m.mindset ?? 'mixed'] }}</span>
                  </p>
                </div>
                <select class="no-print move" :value="gi" @change="moveMember(m, gi, Number(($event.target as HTMLSelectElement).value))">
                  <option disabled :value="gi">ย้ายไป…</option>
                  <option v-for="(_, ti) in groups" v-show="ti !== gi" :key="ti" :value="ti">กลุ่มที่ {{ ti + 1 }}</option>
                  <option :value="-2">กลุ่มใหม่</option>
                  <option :value="-1">นำออกจากกลุ่ม</option>
                </select>
              </div>
            </li>
          </ul>
          <ul v-if="g.notes.length" class="mt-3 space-y-0.5 border-t border-white/10 pt-2 text-xs text-slate-400">
            <li v-for="n in g.notes" :key="n">• {{ n }}</li>
          </ul>
        </section>
      </div>

      <section v-if="unassigned.length" class="card">
        <h2 class="text-lg font-medium text-slate-50">ยังไม่อยู่ในกลุ่ม <span class="text-sm font-normal text-slate-400">· {{ unassigned.length }} คน</span></h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <span v-for="m in unassigned" :key="m.id" class="inline-flex items-center gap-2 rounded-full bg-white/5 py-1 pl-3 pr-1 text-sm text-slate-200">
            {{ m.code }} {{ m.name }}
            <select v-if="groups.length" class="no-print move" value="" @change="moveMember(m, -1, Number(($event.target as HTMLSelectElement).value))">
              <option disabled value="">เพิ่มเข้า…</option>
              <option v-for="(_, ti) in groups" :key="ti" :value="ti">กลุ่มที่ {{ ti + 1 }}</option>
            </select>
          </span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.opt {
  @apply rounded-xl border border-arcane-400/30 bg-abyss-900/70 px-4 py-2 text-sm text-slate-300 transition hover:border-rune-400/60;
}
.opt-on {
  @apply border-rune-400 bg-rune-400/15 text-rune-200 shadow-glow-gold;
}
.member {
  @apply rounded-xl border border-white/5 bg-abyss-950/40 p-2;
}
.move {
  @apply shrink-0 rounded-lg border border-white/10 bg-abyss-900 px-1.5 py-1 text-xs text-slate-300;
}
.print-only-table {
  display: none;
}
@media print {
  .group-card {
    break-inside: avoid;
  }
  .print-only-table {
    display: table !important;
  }
  .screen-list {
    display: none !important;
  }
}
</style>
