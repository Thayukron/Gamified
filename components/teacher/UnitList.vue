<script setup lang="ts">
// Learning units of a course: an editable list (rename / reorder / remove / add) + an AI (or rule-based)
// suggestion from the course description that the teacher reviews and picks from before applying.
import type { CourseFormValue } from '~/utils/courseForm'

const props = defineProps<{ course: CourseFormValue }>()
const emit = defineEmits<{ needContent: [] }>()
const text = defineModel<string>({ required: true }) // one unit per line (CourseFormValue.topicsText)
const api = useApi()
const aiApi = useAiApi() // long AI calls run as background jobs (no Cloudflare 524)

const units = computed<string[]>({
  get: () => text.value.split('\n').map((s) => s.trim()).filter(Boolean),
  set: (list) => (text.value = list.join('\n')),
})
const draftName = ref('')
function add() {
  if (!draftName.value.trim()) return
  units.value = [...units.value, draftName.value.trim()]
  draftName.value = ''
}
function rename(i: number, v: string) {
  const l = [...units.value]
  l[i] = v
  text.value = l.join('\n') // keep empty while typing; filtered on save
}
function remove(i: number) {
  units.value = units.value.filter((_, j) => j !== i)
}
function move(i: number, d: number) {
  const l = [...units.value]
  const j = i + d
  if (j < 0 || j >= l.length) return
  ;[l[i], l[j]] = [l[j], l[i]]
  units.value = l
}

// ---- suggestions
interface Suggestion { name: string; covers?: string; hours_theory?: number; hours_practice?: number; pick: boolean }
const suggestions = ref<Suggestion[] | null>(null)
const source = ref('')
const busy = ref(false)
const err = ref('')
const hasContent = computed(() => !!(props.course.description.trim() || props.course.objectives.trim()))

async function suggestAI() {
  if (!hasContent.value) return emit('needContent')
  busy.value = true
  err.value = ''
  try {
    const c = props.course
    const r = await aiApi<any>('/teacher/units/suggest', {
      method: 'POST',
      body: { code: c.code, name: c.name, level: c.level, course_type: c.course_type, theory_hours: c.theory_hours, practice_hours: c.practice_hours, description: c.description, objectives: c.objectives, competencies: c.competencies },
    })
    suggestions.value = r.units.map((u: any) => ({ ...u, pick: true }))
    source.value = `AI (${r.model})`
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}

/** without AI: split the description into topics (Thai course descriptions list topics separated by spaces/commas) */
function suggestSplit() {
  if (!props.course.description.trim()) return emit('needContent')
  const body = props.course.description
    .replace(/^\s*(ศึกษา|ปฏิบัติ)(และ(ศึกษา|ปฏิบัติ))?(เกี่ยวกับ|การ)?\s*/u, '')
    .replace(/\s+(และ|รวมทั้ง|ตลอดจน)\s*/gu, ' ')
  const parts = body.split(/[\s,，、]+/u).map((s) => s.trim()).filter((s) => s.length >= 3)
  suggestions.value = [...new Set(parts)].slice(0, 15).map((name) => ({ name, pick: true }))
  source.value = 'แยกจากคำอธิบายรายวิชา'
}

const pickedCount = computed(() => suggestions.value?.filter((s) => s.pick && s.name.trim()).length ?? 0)
function apply(mode: 'replace' | 'append') {
  const picked = suggestions.value!.filter((s) => s.pick && s.name.trim()).map((s) => s.name.trim())
  if (mode === 'replace' && units.value.length && !confirm(`แทนที่หน่วยเดิม ${units.value.length} หน่วยด้วยหน่วยที่เลือก ${picked.length} หน่วย?`)) return
  units.value = mode === 'replace' ? picked : [...units.value, ...picked.filter((p) => !units.value.includes(p))]
  suggestions.value = null
}
const totalHours = computed(() => (suggestions.value ?? []).filter((s) => s.pick).reduce((a, s) => a + (s.hours_theory ?? 0) + (s.hours_practice ?? 0), 0))
</script>

<template>
  <div class="space-y-4">
    <!-- suggest -->
    <div class="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <div class="min-w-0 flex-1 text-sm">
        <p class="text-slate-100">ให้ระบบช่วยแบ่งหน่วยการเรียนจากคำอธิบายรายวิชา</p>
        <p class="text-xs" :class="hasContent ? 'text-slate-400' : 'text-rune-300'">{{ hasContent ? 'ตรวจ เลือก แก้ชื่อ ก่อนนำไปใช้' : 'กรอกคำอธิบายรายวิชาที่แท็บ “2 เนื้อหารายวิชา” ก่อน' }}</p>
      </div>
      <button type="button" class="btn-primary !py-2 text-sm" :disabled="busy" data-testid="units-ai" @click="suggestAI">
        <AppIcon name="orb" :size="16" /> {{ busy ? 'AI กำลังวิเคราะห์…' : 'AI วิเคราะห์หน่วย' }}
      </button>
      <button type="button" class="btn-ghost !py-2 text-sm" :disabled="busy" data-testid="units-split" @click="suggestSplit">แยกจากคำอธิบาย (ไม่ใช้ AI)</button>
    </div>
    <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>

    <!-- review suggestions before applying -->
    <div v-if="suggestions" class="space-y-2 rounded-xl border border-sky-400/30 bg-sky-500/5 p-4" data-testid="unit-suggestions">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-medium text-sky-200">หน่วยที่แนะนำ · {{ source }}</p>
        <span v-if="totalHours" class="text-xs text-slate-400">รวมประมาณ {{ totalHours }} ชม.</span>
      </div>
      <label v-for="(s, i) in suggestions" :key="i" class="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
        <input v-model="s.pick" type="checkbox" class="mt-2.5">
        <span class="w-6 pt-2 text-right text-xs text-slate-500">{{ i + 1 }}.</span>
        <span class="min-w-0 flex-1">
          <input v-model="s.name" class="input !py-1.5 text-sm" :class="!s.pick && 'opacity-50'">
          <span v-if="s.covers || s.hours_theory || s.hours_practice" class="mt-0.5 block text-xs text-slate-500">
            {{ s.covers }}<template v-if="s.hours_theory || s.hours_practice"> · ท {{ s.hours_theory }} / ป {{ s.hours_practice }} ชม.</template>
          </span>
        </span>
      </label>
      <div class="flex flex-wrap justify-end gap-2 pt-1">
        <button type="button" class="btn-ghost !py-1.5 text-sm" @click="suggestions = null">ยกเลิก</button>
        <button v-if="units.length" type="button" class="btn-ghost !py-1.5 text-sm" :disabled="!pickedCount" @click="apply('append')">เพิ่มต่อท้าย ({{ pickedCount }})</button>
        <button type="button" class="btn-primary !py-1.5 text-sm" :disabled="!pickedCount" data-testid="units-apply" @click="apply('replace')">ใช้หน่วยที่เลือก ({{ pickedCount }})</button>
      </div>
    </div>

    <!-- current units -->
    <div>
      <p class="label">หน่วยการเรียนรู้ของรายวิชา ({{ units.length }} หน่วย)</p>
      <div class="space-y-1.5" data-testid="unit-list">
        <div v-for="(u, i) in units" :key="i" class="flex items-center gap-2">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rune-400/40 text-sm text-rune-300">{{ i + 1 }}</span>
          <input :value="u" class="input !py-1.5" @input="rename(i, ($event.target as HTMLInputElement).value)">
          <button type="button" class="px-1 text-slate-500 hover:text-slate-200" title="เลื่อนขึ้น" @click="move(i, -1)">▲</button>
          <button type="button" class="px-1 text-slate-500 hover:text-slate-200" title="เลื่อนลง" @click="move(i, 1)">▼</button>
          <button type="button" class="px-1 text-red-300/70 hover:text-red-300" title="ลบ" @click="remove(i)">✕</button>
        </div>
        <p v-if="!units.length" class="text-sm text-slate-500">ยังไม่มีหน่วย — ให้ระบบช่วยแบ่งจากด้านบน หรือพิมพ์เพิ่มเอง</p>
      </div>
      <div class="mt-2 flex gap-2">
        <input v-model="draftName" class="input !py-1.5" placeholder="พิมพ์ชื่อหน่วยแล้วกด Enter" data-testid="unit-new" @keydown.enter.prevent="add">
        <button type="button" class="btn-ghost shrink-0 whitespace-nowrap !py-1.5 text-sm" @click="add">+ เพิ่ม</button>
      </div>
    </div>
  </div>
</template>
