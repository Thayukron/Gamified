<script setup lang="ts">
// Course form shared by "create course" and "edit course": basic info + units + curriculum content.
import type { CourseFormValue } from '~/utils/courseForm'

const props = defineProps<{ departments: { id: number; code: string; name: string }[]; initialStep?: 'basic' | 'content' }>()
const form = defineModel<CourseFormValue>({ required: true })
const step = ref<'basic' | 'content'>(props.initialStep ?? 'basic')

const TYPES = [
  { v: 'theory', th: 'ทฤษฎี', desc: 'บรรยาย อ่าน วิเคราะห์' },
  { v: 'practice', th: 'ปฏิบัติ', desc: 'ลงมือทำ งานชิ้นจริง' },
  { v: 'mixed', th: 'ผสม', desc: 'ทฤษฎี + ปฏิบัติ' },
] as const
const filled = computed(() => ['objectives', 'competencies', 'description'].filter((k) => (form.value as any)[k]?.trim()).length)
</script>

<template>
  <div class="space-y-4">
    <!-- two small tabs instead of one long form -->
    <div class="flex gap-2">
      <button type="button" class="rounded-full px-4 py-1.5 text-sm ring-1 transition" :class="step === 'basic' ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15'" data-testid="cf-tab-basic" @click="step = 'basic'">ข้อมูลวิชา · หน่วยการเรียน</button>
      <button type="button" class="rounded-full px-4 py-1.5 text-sm ring-1 transition" :class="step === 'content' ? 'bg-rune-400/20 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15'" data-testid="cf-tab-content" @click="step = 'content'">
        เนื้อหารายวิชา (จากหลักสูตร) <span class="ml-1 text-xs" :class="filled === 3 ? 'text-emerald-300' : 'text-slate-400'">{{ filled }}/3</span>
      </button>
    </div>

    <div v-show="step === 'basic'" class="grid gap-4 sm:grid-cols-2">
      <div><p class="label">รหัสวิชา *</p><input v-model="form.code" class="input" placeholder="เช่น 30204-2003" data-testid="f-code"></div>
      <div><p class="label">ชื่อวิชา *</p><input v-model="form.name" class="input" placeholder="เช่น โครงสร้างข้อมูลและอัลกอริทึม" data-testid="f-name"></div>
      <div><p class="label">กลุ่มเรียน</p><input v-model="form.section" class="input" placeholder="เช่น ปวส.1/1" data-testid="f-section"></div>
      <div>
        <p class="label">แผนกวิชา</p>
        <select v-model="form.department_id" class="input">
          <option :value="null">— ไม่ระบุ —</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.code }} · {{ d.name }}</option>
        </select>
      </div>
      <div class="sm:col-span-2">
        <p class="label">ประเภทวิชา</p>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in TYPES"
            :key="t.v"
            type="button"
            class="rounded-xl px-3 py-2 text-left ring-1 transition"
            :class="form.course_type === t.v ? 'bg-rune-400/15 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
            @click="form.course_type = t.v"
          >
            <p class="font-medium">{{ t.th }}</p>
            <p class="text-xs text-slate-400">{{ t.desc }}</p>
          </button>
        </div>
      </div>
      <div><p class="label">ระดับชั้น</p><input v-model="form.level" class="input" placeholder="เช่น ปวช.1, ปวส.1"></div>
      <div>
        <p class="label">ชั่วโมงต่อสัปดาห์ · หน่วยกิต</p>
        <!-- one-line label; the unit sits inside each box so all inputs line up with "ระดับชั้น" -->
        <div class="grid grid-cols-3 gap-2">
          <label v-for="f in [{ k: 'theory_hours', unit: 'ทฤษฎี', id: 'f-th' }, { k: 'practice_hours', unit: 'ปฏิบัติ', id: 'f-ph' }, { k: 'credits', unit: 'หน่วยกิต', id: 'f-cr' }]" :key="f.k" class="relative block">
            <input v-model="(form as any)[f.k]" inputmode="decimal" class="input !pr-16 text-center" placeholder="0" :data-testid="f.id">
            <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{{ f.unit }}</span>
          </label>
        </div>
      </div>
      <div class="sm:col-span-2">
        <p class="label">หน่วยการเรียนรู้ (1 บรรทัด = 1 หน่วย)</p>
        <textarea v-model="form.topicsText" rows="4" class="input" placeholder="อาร์เรย์&#10;สแตก&#10;คิว" data-testid="f-topics" />
      </div>
    </div>

    <div v-show="step === 'content'" class="space-y-4">
      <p class="rounded-xl bg-white/5 px-3 py-2 text-xs text-slate-400">คัดลอกจากหลักสูตร ปวช./ปวส. 2567 ของ สอศ. · ใช้พิมพ์ในหน้า “หลักสูตรรายวิชา” ของเล่มแผน และ AI ใช้เป็นขอบเขตเนื้อหาเมื่อร่างแผนการสอน ใบความรู้ ใบงาน (ไม่บังคับ แต่ควรกรอก)</p>
      <div><p class="label">จุดประสงค์รายวิชา (1 บรรทัด = 1 ข้อ)</p><textarea v-model="form.objectives" rows="4" class="input" data-testid="f-objectives" /></div>
      <div><p class="label">สมรรถนะรายวิชา (1 บรรทัด = 1 ข้อ)</p><textarea v-model="form.competencies" rows="4" class="input" data-testid="f-competencies" /></div>
      <div><p class="label">คำอธิบายรายวิชา</p><textarea v-model="form.description" rows="5" class="input" data-testid="f-description" /></div>
      <details class="rounded-xl ring-1 ring-white/10">
        <summary class="cursor-pointer px-3 py-2 text-sm text-slate-300">เพิ่มเติม: ผลลัพธ์การเรียนรู้ระดับรายวิชา · อ้างอิงมาตรฐาน</summary>
        <div class="space-y-3 px-3 pb-3">
          <div><p class="label">ผลลัพธ์การเรียนรู้ระดับรายวิชา</p><textarea v-model="form.outcome" rows="2" class="input" /></div>
          <div><p class="label">อ้างอิงมาตรฐาน</p><textarea v-model="form.standards_ref" rows="2" class="input" /></div>
        </div>
      </details>
    </div>
  </div>
</template>
