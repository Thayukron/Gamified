<script setup lang="ts">
import { emptyCourseForm, formToBody, type CourseFormValue } from '~/utils/courseForm'

const api = useApi()
const meta = ref<any>(null)
const form = ref<CourseFormValue>(emptyCourseForm())
const groups = ref<string[]>([])
const busy = ref(false)
const err = ref('')

onMounted(async () => {
  meta.value = await api('/teacher/meta')
  form.value.department_id = meta.value.my_department_id
})

function toggle(g: string) {
  groups.value = groups.value.includes(g) ? groups.value.filter((x) => x !== g) : [...groups.value, g]
  // suggest the section name from the first chosen group
  if (!form.value.section && groups.value.length) form.value.section = groups.value[0]
  if (!form.value.level && groups.value.length) form.value.level = groups.value[0].split('/')[0]
}
const picked = computed(() => (meta.value?.class_groups ?? []).filter((g: any) => groups.value.includes(g.name)).reduce((n: number, g: any) => n + g.students, 0))

async function save() {
  err.value = ''
  busy.value = true
  try {
    const res = await api<any>('/teacher/courses', { method: 'POST', body: { ...formToBody(form.value), class_groups: groups.value } })
    await navigateTo(`/teacher/course/${res.id}/students?created=${res.added}`)
  } catch (e) {
    err.value = apiErrorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <NuxtLink to="/teacher" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> รายวิชาทั้งหมด</NuxtLink>
    <div>
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">NEW COURSE</p>
      <h1 class="title-glow mt-1 text-2xl sm:text-3xl">สร้างรายวิชาของฉัน</h1>
      <p class="mt-1 text-sm text-slate-400">
        ผู้เรียนเล่นเกมครั้งเดียวต่อภาคเรียน — ทุกวิชาใช้ผลเดียวกัน ครูเพียงสร้างวิชาแล้วเลือกกลุ่มที่เรียนกับตน
        <template v-if="meta"> · ภาคเรียน {{ meta.term.semester }}/{{ meta.term.academic_year }}</template>
      </p>
    </div>

    <p v-if="!meta" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <section class="card space-y-4">
        <h2 class="flex items-center gap-2 text-lg font-medium text-slate-50"><span class="step">1</span> ข้อมูลรายวิชา</h2>
        <TeacherCourseForm v-model="form" :departments="meta.departments" />
      </section>

      <section class="card space-y-3">
        <h2 class="flex items-center gap-2 text-lg font-medium text-slate-50"><span class="step">2</span> เลือกกลุ่มเรียนที่เรียนกับฉัน</h2>
        <p class="text-sm text-slate-400">แตะเลือกได้หลายกลุ่ม ระบบจะเพิ่มผู้เรียนทั้งกลุ่มให้ทันที · เพิ่ม/ลบรายคนได้ภายหลัง</p>
        <p v-if="!meta.class_groups.length" class="text-sm text-slate-500">ยังไม่มีข้อมูลกลุ่มเรียนในระบบ — เพิ่มผู้เรียนรายคนได้ในขั้นถัดไป</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="g in meta.class_groups"
            :key="g.name"
            type="button"
            class="rounded-xl px-3 py-2 text-left ring-1 transition"
            :class="groups.includes(g.name) ? 'bg-rune-400/15 text-rune-200 ring-rune-400/60' : 'text-slate-300 ring-white/15 hover:ring-white/30'"
            :data-testid="`group-${g.name}`"
            @click="toggle(g.name)"
          >
            <p class="font-medium"><AppIcon v-if="groups.includes(g.name)" name="check" :size="14" /> {{ g.name }}</p>
            <p class="text-xs text-slate-400">{{ g.students }} คน · {{ g.department_name ?? '-' }}</p>
          </button>
        </div>
      </section>

      <p v-if="err" class="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ err }}</p>
      <div class="flex items-center justify-end gap-3">
        <span v-if="groups.length" class="text-sm text-slate-400">จะเพิ่มผู้เรียน {{ picked }} คน</span>
        <button class="btn-primary" :disabled="busy || !form.code || !form.name" data-testid="create" @click="save">
          <AppIcon name="check" :size="18" /> สร้างรายวิชา
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.step {
  @apply flex h-7 w-7 items-center justify-center rounded-full border border-rune-400/50 font-display text-sm text-rune-300;
}
</style>
