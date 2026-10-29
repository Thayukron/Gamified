<script setup lang="ts">
import { ADMIN_TYPES, IMPORT_SPEC, downloadImportTemplate, parseImportFile, type ImportType, type ParsedFile } from '~/utils/importData'

// One data type per file: pick the type, download its template, upload, check, save.
const api = useApi()
const type = ref<ImportType>('teachers')
const fileName = ref('')
const parsed = ref<ParsedFile | null>(null)
const preview = ref<Record<string, any> | null>(null)
const applied = ref<Record<string, any> | null>(null)
const busy = ref(false)
const err = ref('')
const onlyErrors = ref(false)
const dragging = ref(false)
const input = ref<HTMLInputElement>()

const CARDS: Record<string, { icon: string; tone: any; desc: string }> = {
  teachers: { icon: 'user', tone: 'indigo', desc: 'ชื่อผู้ใช้ · ชื่อ-สกุล · แผนก — ใช้ชื่อชั่วคราว teacher1, teacher2 ได้ ครูเปลี่ยนเป็นชื่อตนเองภายหลัง' },
  students: { icon: 'users', tone: 'emerald', desc: 'รหัสนักศึกษา · ชื่อ-สกุล · แผนก · กลุ่มเรียน — ทั้งวิทยาลัยครั้งเดียว (ครูนำเข้าเฉพาะวิชาตนเองได้เช่นกัน)' },
  departments: { icon: 'building', tone: 'sky', desc: 'รหัสแผนก · ชื่อแผนก — นำเข้าก่อนครู/นักศึกษา ถ้ายังไม่มีแผนกในระบบ' },
}
const STATUS = {
  new: { th: 'เพิ่มใหม่', cls: 'bg-emerald-500/15 text-emerald-300' },
  update: { th: 'อัปเดต', cls: 'bg-sky-500/15 text-sky-300' },
  error: { th: 'ผิดพลาด', cls: 'bg-red-500/15 text-red-300' },
} as const

const result = computed(() => preview.value?.[type.value])
const shownRows = computed(() => {
  const rows = result.value?.rows ?? []
  return onlyErrors.value ? rows.filter((r: any) => r.status === 'error') : rows
})
const cols = computed(() => IMPORT_SPEC[type.value].cols.filter((c) => c.key !== 'password'))

function choose(t: ImportType) {
  type.value = t
  reset()
}

async function template() {
  busy.value = true
  try { await downloadImportTemplate(type.value) } finally { busy.value = false }
}

async function pick(file?: File | null) {
  if (!file) return
  err.value = ''
  preview.value = null
  applied.value = null
  fileName.value = file.name
  busy.value = true
  try {
    parsed.value = await parseImportFile(file, type.value)
    const rows = parsed.value.payload[type.value]
    if (!rows?.length) {
      err.value = `ไม่พบข้อมูล${IMPORT_SPEC[type.value].title}ในไฟล์ — ตรวจหัวคอลัมน์ให้ตรงกับแม่แบบ (หรือเลือกประเภทข้อมูลให้ตรงกับไฟล์)`
      return
    }
    preview.value = (await api<any>('/admin/import/preview', { method: 'POST', body: { [type.value]: rows } })).result
    onlyErrors.value = result.value.summary.error > 0
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

async function commit() {
  if (!parsed.value || !result.value) return
  const s = result.value.summary
  if (!confirm(`ยืนยันนำเข้า${IMPORT_SPEC[type.value].title} ${s.new + s.update} รายการ${s.error ? ` (ข้าม ${s.error} รายการที่ผิดพลาด)` : ''}?`)) return
  busy.value = true
  err.value = ''
  try {
    applied.value = (await api<any>('/admin/import/commit', { method: 'POST', body: { [type.value]: parsed.value.payload[type.value] } })).applied[type.value]
    preview.value = null
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

function reset() {
  parsed.value = null
  preview.value = null
  applied.value = null
  fileName.value = ''
  err.value = ''
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div>
      <h1 class="title-glow text-2xl sm:text-3xl">นำเข้าข้อมูล</h1>
      <p class="mt-1 text-sm text-slate-400">นำเข้าทีละประเภท ไฟล์ละหนึ่งประเภท — ตรวจสอบก่อนบันทึกทุกครั้ง · นำเข้าไฟล์เดิมซ้ำได้โดยไม่เกิดข้อมูลซ้ำ</p>
    </div>

    <p class="flex gap-2 rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
      <AppIcon name="bulb" :size="18" class="mt-0.5 shrink-0" />
      <span><b>รายวิชาและรายชื่อผู้เรียนในวิชา ครูจัดการเอง</b> — ครูสร้างรายวิชา แล้วเพิ่มผู้เรียนทั้งกลุ่มเรียน หรือนำเข้ารายชื่อจากไฟล์ได้ที่หน้า “รายชื่อ / แก้ไขวิชา” ของรายวิชานั้น</span>
    </p>

    <!-- step 1: type -->
    <section class="space-y-3">
      <h2 class="staff-section"><span class="text-slate-500">1.</span> เลือกประเภทข้อมูล</h2>
      <div class="grid gap-3 md:grid-cols-3">
        <button
          v-for="t in ADMIN_TYPES"
          :key="t"
          type="button"
          class="card flex items-start gap-4 !p-4 text-left transition"
          :class="type === t ? '!border-rune-400 ring-2 ring-rune-400/30' : 'card-hover'"
          :data-testid="`type-${t}`"
          @click="choose(t)"
        >
          <StaffIcon :name="CARDS[t].icon" :tone="CARDS[t].tone" />
          <span class="min-w-0">
            <span class="block font-medium text-slate-50">{{ IMPORT_SPEC[t].title }}</span>
            <span class="mt-0.5 block text-sm text-slate-400">{{ CARDS[t].desc }}</span>
          </span>
        </button>
      </div>
    </section>

    <!-- step 2: template + upload -->
    <section class="card space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="staff-section flex-1"><span class="text-slate-500">2.</span> อัปโหลดไฟล์{{ IMPORT_SPEC[type].title }} (.xlsx หรือ .csv)</h2>
        <button class="btn-ghost !py-2 text-sm" :disabled="busy" data-testid="template" @click="template">
          <AppIcon name="download" :size="16" /> แม่แบบ{{ IMPORT_SPEC[type].title }}.xlsx
        </button>
      </div>
      <p class="text-sm text-slate-400">
        คอลัมน์: <span v-for="(c, i) in IMPORT_SPEC[type].cols" :key="c.key">{{ i ? ' · ' : '' }}{{ c.label }}{{ c.required ? '*' : '' }}</span>
        <template v-if="type !== 'departments'"> — เว้นรหัสผ่านว่าง = ใช้{{ type === 'students' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้' }} (ระบบบังคับตั้งใหม่ตอนเข้าครั้งแรก)</template>
      </p>
      <label
        class="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition"
        :class="dragging ? 'border-rune-400 bg-rune-400/10' : 'border-white/15 hover:border-rune-400/60'"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="dragging = false; pick($event.dataTransfer?.files?.[0])"
      >
        <AppIcon name="upload" :size="28" class="text-rune-300" />
        <span class="text-slate-200">{{ busy ? 'กำลังอ่านและตรวจสอบ...' : fileName || 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์' }}</span>
        <input ref="input" type="file" accept=".xlsx,.csv" class="hidden" data-testid="import-file" @change="pick(($event.target as HTMLInputElement).files?.[0])">
      </label>
      <p v-if="parsed" class="text-xs text-slate-500">
        อ่านได้:
        <span v-for="s in parsed.sheets" :key="s.name" class="mr-3">{{ s.name }} → {{ s.type ? `${s.rows} แถว` : 'ข้าม (ไม่ใช่ข้อมูลประเภทนี้)' }}</span>
      </p>
    </section>

    <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>

    <!-- step 3: preview -->
    <section v-if="result" class="card space-y-4" data-testid="preview">
      <div class="flex flex-wrap items-center gap-4">
        <div class="min-w-0 flex-1">
          <h2 class="staff-section"><span class="text-slate-500">3.</span> ตรวจสอบก่อนบันทึก</h2>
          <p class="mt-1 text-sm text-slate-400">
            ทั้งหมด {{ result.summary.total }} แถว ·
            <span class="text-emerald-300">เพิ่มใหม่ {{ result.summary.new }}</span> ·
            <span class="text-sky-300">อัปเดต {{ result.summary.update }}</span> ·
            <span :class="result.summary.error ? 'text-red-300' : 'text-slate-400'">ผิดพลาด {{ result.summary.error }}</span>
            <template v-if="result.summary.error"> — แถวที่ผิดพลาดจะถูกข้าม แก้ไฟล์แล้วอัปโหลดใหม่ได้</template>
          </p>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-300"><input v-model="onlyErrors" type="checkbox"> เฉพาะที่ผิดพลาด</label>
        <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="reset">ยกเลิก</button>
        <button class="btn-primary !py-2 text-sm" :disabled="busy || !(result.summary.new + result.summary.update)" data-testid="commit" @click="commit">
          <AppIcon name="check" :size="16" /> บันทึก {{ result.summary.new + result.summary.update }} รายการ
        </button>
      </div>

      <div class="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-white/10">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
            <tr>
              <th class="px-3 py-2">แถว</th>
              <th class="px-3 py-2">สถานะ</th>
              <th v-for="c in cols" :key="c.key" class="whitespace-nowrap px-3 py-2">{{ c.label }}</th>
              <th class="px-3 py-2">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shownRows" :key="r.row" class="border-t border-white/5 align-top" :class="r.status === 'error' && 'bg-red-500/5'">
              <td class="px-3 py-2 text-slate-500">{{ r.row }}</td>
              <td class="px-3 py-2"><span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs" :class="STATUS[r.status as keyof typeof STATUS].cls">{{ STATUS[r.status as keyof typeof STATUS].th }}</span></td>
              <td v-for="c in cols" :key="c.key" class="px-3 py-2 text-slate-200">{{ r.data[c.key] ?? '' }}</td>
              <td class="px-3 py-2 text-xs" :class="r.status === 'error' ? 'text-red-300' : 'text-slate-400'">{{ r.messages.join(' · ') }}</td>
            </tr>
            <tr v-if="!shownRows.length"><td :colspan="cols.length + 3" class="px-3 py-6 text-center text-slate-500">ไม่มีแถวที่ผิดพลาด</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- result -->
    <section v-if="applied" class="card space-y-3" data-testid="applied">
      <p class="text-lg font-medium text-emerald-300"><AppIcon name="check" :size="18" /> นำเข้า{{ IMPORT_SPEC[type].title }}เรียบร้อย</p>
      <p class="text-sm text-slate-300">บันทึก {{ applied.applied }} รายการ (ใหม่ {{ applied.new }} · อัปเดต {{ applied.update }}<template v-if="applied.error"> · ข้าม {{ applied.error }}</template>)</p>
      <p v-if="type !== 'departments'" class="text-sm text-slate-400">ผู้ใช้ใหม่ที่ไม่ได้กำหนดรหัสผ่าน ใช้{{ type === 'students' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้' }}เป็นรหัสผ่านเริ่มต้น</p>
      <div class="flex gap-3">
        <NuxtLink to="/admin/data" class="btn-primary !py-2 text-sm">ดูข้อมูลในระบบ</NuxtLink>
        <button class="btn-ghost !py-2 text-sm" @click="reset">นำเข้าไฟล์อื่น</button>
      </div>
    </section>
  </div>
</template>
