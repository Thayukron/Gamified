<script setup lang="ts">
import type { AssessmentResult } from '~/utils/profile'

const api = useApi()
const data = ref<{ profile: AssessmentResult | null; completed: number; total: number; semester: number; academic_year: number } | null>(null)

onMounted(async () => {
  data.value = await api('/student/profile')
})
</script>

<template>
  <div>
    <p v-if="!data" class="text-slate-500">กำลังรวบรวมพลังจากทุกเควสต์...</p>
    <div v-else-if="!data.profile" class="card text-center text-slate-400">
      ยังไม่มีข้อมูล — เล่นเควสต์แรกเพื่อค้นพบตัวตนของคุณ
      <div class="mt-4"><NuxtLink to="/student" class="btn-primary">ไปที่แผนที่เควสต์</NuxtLink></div>
    </div>
    <ProfileReport
      v-else
      :result="data.profile"
      heading="Core Profile · ตัวตนที่แท้จริงของคุณ"
      :subheading="`รวมผลจาก ${data.completed}/${data.total} เควสต์ · ภาคเรียน ${data.semester}/${data.academic_year}`"
    >
      <div class="card animate-fade-up !p-4" style="animation-delay: 1.1s">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-300">ความแม่นยำของโปรไฟล์</span>
          <span class="font-display text-rune-300">{{ data.completed }}/{{ data.total }}</span>
        </div>
        <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div class="h-full rounded-full bg-gradient-to-r from-arcane-500 to-rune-400" :style="{ width: `${(data.completed / Math.max(data.total, 1)) * 100}%` }" />
        </div>
        <p v-if="data.completed < data.total" class="mt-2 text-xs text-slate-400">เล่นเควสต์ที่เหลือเพื่อให้ผลแม่นยำยิ่งขึ้น</p>
      </div>
    </ProfileReport>
  </div>
</template>
