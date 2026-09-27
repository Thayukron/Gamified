<script setup lang="ts">
import { IMPORT_ORDER, IMPORT_SPEC, downloadImportTemplate, parseImportFile, type ImportType, type ParsedFile } from '~/utils/importData'

const api = useApi()
const csvType = ref<ImportType>('students')
const fileName = ref('')
const parsed = ref<ParsedFile | null>(null)
const preview = ref<Record<string, any> | null>(null)
const applied = ref<Record<string, any> | null>(null)
const busy = ref(false)
const err = ref('')
const tab = ref<ImportType>('students')
const onlyErrors = ref(false)
const dragging = ref(false)
const input = ref<HTMLInputElement>()

const STATUS = {
  new: { th: 'เพิ่มใหม่', cls: 'bg-emerald-500/15 text-emerald-300' },
  update: { th: 'อัปเดต', cls: 'bg-sky-500/15 text-sky-300' },
  error: { th: 'ผิดพลาด', cls: 'bg-red-500/15 text-red-300' },
} as const

const types = computed(() => IMPORT_ORDER.filter((t) => preview.value?.[t]))
const totals = computed(() => {
  const s = { total: 0, new: 0, update: 0, error: 0 }
  for (const t of types.value) for (const k of Object.keys(s) as (keyof typeof s)[]) s[k] += preview.value![t].summary[k]
  return s
})
const shownRows = computed(() => {
  const rows = preview.value?.[tab.value]?.rows ?? []
  return onlyErrors.value ? rows.filter((r: any) => r.status === 'error') : rows
})

async function template() {
  busy.value = true
  try { await downloadImportTemplate() } finally { busy.value = false }
}

async function pick(file?: File | null) {
  if (!file) return
  err.value = ''
  preview.value = null
  applied.value = null
  fileName.value = file.name
  busy.value = true
  try {
    parsed.value = await parseImportFile(file, csvType.value)
    if (!Object.keys(parsed.value.payload).length) {
      err.value = 'ไม่พบข้อมูลที่อ่านได้ — ตรวจชื่อชีต/หัวคอลัมน์ให้ตรงกับแม่แบบ'
      return
    }
    preview.value = (await api<any>('/admin/import/preview', { method: 'POST', body: parsed.value.payload })).result
    tab.value = types.value.find((t) => preview.value![t].summary.error) ?? types.value[0]
    onlyErrors.value = totals.value.error > 0
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
    if (input.value) input.value.value = ''
  }
}

async function commit() {
  if (!parsed.value) return
  const ok = totals.value.new + totals.value.update
  if (!confirm(`ยืนยันนำเข้า ${ok} รายการ${totals.value.error ? ` (ข้าม ${totals.value.error} รายการที่ผิดพลาด)` : ''}?`)) return
  busy.value = true
  err.value = ''
  try {
    applied.value = (await api<any>('/admin/import/commit', { method: 'POST', body: parsed.value.payload })).applied
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
}

const colsOf = (t: ImportType) => IMPORT_SPEC[t].cols.filter((c) => c.key !== 'password')
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> หอคอยผู้คุมระบบ</NuxtLink>
    <div>
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">SUMMONING RITE</p>
      <h1 class="title-glow mt-1 text-2xl sm:text-3xl">นำเข้าข้อมูล</h1>
      <p class="mt-1 text-sm text-slate-400">แผนกวิชา · ครู · นักศึกษา · รายวิชา/กลุ่มเรียน · การลงทะเบียน — จากไฟล์ Excel หรือ CSV ตรวจสอบก่อนบันทึกทุกครั้ง</p>
    </div>

    <!-- step 1 -->
    <section class="card flex flex-wrap items-center gap-4">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rune-400/50 font-display text-rune-300">1</span>
      <div class="min-w-0 flex-1">
        <p class="font-medium text-slate-100">ดาวน์โหลดแม่แบบ Excel</p>
        <p class="text-sm text-slate-400">มี 5 ชีต พร้อมคำอธิบายและแถวตัวอย่าง (แถวตัวอย่างสีเหลืองที่ไม่แก้ไขจะถูกข้ามอัตโนมัติ) · เว้นรหัสผ่านว่าง = ใช้ชื่อผู้ใช้/รหัสนักศึกษา</p>
      </div>
      <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="template"><AppIcon name="download" :size="16" /> แม่แบบนำเข้าข้อมูล.xlsx</button>
    </section>

    <!-- step 2 -->
    <section class="card space-y-3">
      <div class="flex flex-wrap items-center gap-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rune-400/50 font-display text-rune-300">2</span>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-slate-100">อัปโหลดไฟล์ (.xlsx หรือ .csv)</p>
          <p class="text-sm text-slate-400">Excel: ระบบอ่านทุกชีตตามชื่อชีต/หัวคอลัมน์ · CSV: เลือกชนิดข้อมูลของไฟล์ก่อน</p>
        </div>
        <label class="flex items-center gap-2 text-sm text-slate-300">CSV เป็นข้อมูล
          <select v-model="csvType" class="input !w-auto !py-1.5">
            <option v-for="t in IMPORT_ORDER" :key="t" :value="t">{{ IMPORT_SPEC[t].title }}</option>
          </select>
        </label>
      </div>
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
        <span v-for="s in parsed.sheets" :key="s.name" class="mr-3">{{ s.name }} → {{ s.type ? `${IMPORT_SPEC[s.type].title} ${s.rows} แถว` : 'ไม่รู้จักชีตนี้ (ข้าม)' }}</span>
      </p>
    </section>

    <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>

    <!-- step 3: preview -->
    <section v-if="preview" class="card space-y-4" data-testid="preview">
      <div class="flex flex-wrap items-center gap-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rune-400/50 font-display text-rune-300">3</span>
        <div class="min-w-0 flex-1">
          <p class="font-medium text-slate-100">ตรวจสอบก่อนบันทึก</p>
          <p class="text-sm text-slate-400">
            ทั้งหมด {{ totals.total }} แถว ·
            <span class="text-emerald-300">เพิ่มใหม่ {{ totals.new }}</span> ·
            <span class="text-sky-300">อัปเดต {{ totals.update }}</span> ·
            <span :class="totals.error ? 'text-red-300' : 'text-slate-400'">ผิดพลาด {{ totals.error }}</span>
            <template v-if="totals.error"> — แถวที่ผิดพลาดจะถูกข้าม แก้ไฟล์แล้วอัปโหลดใหม่ได้</template>
          </p>
        </div>
        <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="reset">ยกเลิก</button>
        <button class="btn-primary !py-2 text-sm" :disabled="busy || !(totals.new + totals.update)" data-testid="commit" @click="commit">
          <AppIcon name="check" :size="16" /> บันทึก {{ totals.new + totals.update }} รายการ
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="t in types"
          :key="t"
          class="rounded-full px-3 py-1.5 text-sm ring-1 transition"
          :class="tab === t ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
          @click="tab = t"
        >
          {{ IMPORT_SPEC[t].title }} {{ preview[t].summary.total }}
          <span v-if="preview[t].summary.error" class="ml-1 rounded-full bg-red-500/80 px-1.5 text-xs text-white">{{ preview[t].summary.error }}</span>
        </button>
        <label class="ml-auto flex items-center gap-2 text-sm text-slate-300"><input v-model="onlyErrors" type="checkbox"> แสดงเฉพาะที่ผิดพลาด</label>
      </div>

      <div class="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-white/10">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-abyss-900 text-left text-slate-400">
            <tr>
              <th class="px-3 py-2">แถว</th>
              <th class="px-3 py-2">สถานะ</th>
              <th v-for="c in colsOf(tab)" :key="c.key" class="whitespace-nowrap px-3 py-2">{{ c.label }}</th>
              <th class="px-3 py-2">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in shownRows" :key="r.row" class="border-t border-white/5 align-top" :class="r.status === 'error' && 'bg-red-500/5'">
              <td class="px-3 py-2 text-slate-500">{{ r.row }}</td>
              <td class="px-3 py-2"><span class="whitespace-nowrap rounded-full px-2 py-0.5 text-xs" :class="STATUS[r.status as keyof typeof STATUS].cls">{{ STATUS[r.status as keyof typeof STATUS].th }}</span></td>
              <td v-for="c in colsOf(tab)" :key="c.key" class="px-3 py-2 text-slate-200">{{ Array.isArray(r.data[c.key]) ? r.data[c.key].join(', ') : r.data[c.key] ?? '' }}</td>
              <td class="px-3 py-2 text-xs" :class="r.status === 'error' ? 'text-red-300' : 'text-slate-400'">{{ r.messages.join(' · ') }}</td>
            </tr>
            <tr v-if="!shownRows.length"><td :colspan="colsOf(tab).length + 3" class="px-3 py-6 text-center text-slate-500">ไม่มีแถวที่ผิดพลาดในชีตนี้</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- result -->
    <section v-if="applied" class="card space-y-3 border-emerald-400/40" data-testid="applied">
      <p class="text-lg font-medium text-emerald-300"><AppIcon name="check" :size="18" /> นำเข้าข้อมูลเรียบร้อย</p>
      <ul class="space-y-1 text-sm text-slate-300">
        <li v-for="t in IMPORT_ORDER.filter((x) => applied![x])" :key="t">
          {{ IMPORT_SPEC[t].title }}: บันทึก {{ applied[t].applied }} รายการ (ใหม่ {{ applied[t].new }} · อัปเดต {{ applied[t].update }}<template v-if="applied[t].error"> · ข้าม {{ applied[t].error }}</template>)
        </li>
      </ul>
      <p class="text-sm text-slate-400">ผู้ใช้ใหม่ที่ไม่ได้กำหนดรหัสผ่าน ใช้ชื่อผู้ใช้/รหัสนักศึกษาเป็นรหัสผ่านเริ่มต้น</p>
      <div class="flex gap-3">
        <NuxtLink to="/admin/data" class="btn-primary !py-2 text-sm">ดูข้อมูลในระบบ</NuxtLink>
        <button class="btn-ghost !py-2 text-sm" @click="reset">นำเข้าไฟล์อื่น</button>
      </div>
    </section>
  </div>
</template>
