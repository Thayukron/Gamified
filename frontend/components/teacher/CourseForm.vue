<script setup lang="ts">
// Course info form shared by "create course" and "edit course".
import type { CourseFormValue } from '~/utils/courseForm'

defineProps<{ departments: { id: number; code: string; name: string }[] }>()
const form = defineModel<CourseFormValue>({ required: true })

const TYPES = [
  { v: 'theory', th: 'ทฤษฎี', desc: 'บรรยาย อ่าน วิเคราะห์' },
  { v: 'practice', th: 'ปฏิบัติ', desc: 'ลงมือทำ งานชิ้นจริง' },
  { v: 'mixed', th: 'ผสม', desc: 'ทฤษฎี + ปฏิบัติ' },
] as const
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <div><p class="label">รหัสวิชา *</p><input v-model="form.code" class="input" placeholder="เช่น 30204-2003" data-testid="f-code"></div>
    <div><p class="label">ชื่อวิชา *</p><input v-model="form.name" class="input" placeholder="เช่น โครงสร้างข้อมูลและอัลกอริทึม" data-testid="f-name"></div>
    <div>
      <p class="label">กลุ่มเรียน (ชื่อที่แสดงในรายงาน)</p>
      <input v-model="form.section" class="input" placeholder="เช่น ปวส.1/1" data-testid="f-section">
    </div>
    <div>
      <p class="label">แผนกวิชา</p>
      <select v-model="form.department_id" class="input">
        <option :value="null">— ไม่ระบุ —</option>
        <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.code }} · {{ d.name }}</option>
      </select>
    </div>
    <div class="sm:col-span-2">
      <p class="label">ประเภทวิชา (ใช้ปรับไกด์การสอน)</p>
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
      <p class="label">หน่วยการเรียน / หัวข้อ (คั่นด้วยจุลภาค)</p>
      <input v-model="form.topicsText" class="input" placeholder="เช่น อาร์เรย์, สแตก, คิว">
    </div>
  </div>
</template>
