<script setup lang="ts">
const route = useRoute()
const api = useApi()
const data = ref<any>(null)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const ctx = reactive({ course_type: 'mixed', level: '', topicsText: '', context_note: '' })

async function load() {
  try {
    data.value = await api(`/teacher/courses/${route.params.id}/guide`)
    const c = data.value.course
    ctx.course_type = c.course_type
    ctx.level = c.level ?? ''
    ctx.topicsText = (JSON.parse(c.topics || '[]') as string[]).join('\n')
    ctx.context_note = c.context_note ?? ''
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
}
onMounted(load)

async function saveContext() {
  saving.value = true
  try {
    await api(`/teacher/courses/${route.params.id}/context`, {
      method: 'PUT',
      body: { course_type: ctx.course_type, level: ctx.level, context_note: ctx.context_note, topics: ctx.topicsText.split('\n').map((t) => t.trim()).filter(Boolean) },
    })
    editing.value = false
    await load()
  } finally {
    saving.value = false
  }
}

const printGuide = () => window.print()
const g = computed(() => data.value?.guide)
const openGroups = ref<Record<string, boolean>>({})
const TYPES = [
  { v: 'theory', th: 'ทฤษฎี' },
  { v: 'practice', th: 'ปฏิบัติ' },
  { v: 'mixed', th: 'ทฤษฎี+ปฏิบัติ' },
]
const DOMAIN_TH: Record<string, string> = { it: 'เทคโนโลยี/คอมพิวเตอร์', business: 'บริหารธุรกิจ/บัญชี', general: 'ทั่วไป' }
</script>

<template>
  <div class="guide">
    <div class="no-print flex flex-wrap items-center justify-between gap-2">
      <NuxtLink :to="`/teacher/course/${route.params.id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300">
        <AppIcon name="back" :size="16" /> กลับแดชบอร์ด
      </NuxtLink>
      <div class="flex gap-2">
        <button class="btn-ghost !py-2 text-sm" @click="editing = true"><AppIcon name="quill" :size="16" /> แก้ไขบริบทรายวิชา</button>
        <button class="btn-ghost !py-2 text-sm" @click="printGuide"><AppIcon name="download" :size="16" /> พิมพ์ / บันทึก PDF</button>
      </div>
    </div>

    <p v-if="error" class="card mt-4 text-red-300">{{ error }}</p>
    <p v-else-if="!data" class="mt-6 text-slate-500">กำลังจัดทำไกด์การสอน...</p>

    <div v-else class="mt-3 space-y-6">
      <!-- header -->
      <header class="animate-fade-up">
        <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">TEACHING GUIDE</p>
        <h1 class="title-glow mt-1 text-2xl sm:text-3xl">ไกด์การจัดการเรียนการสอน</h1>
        <p class="mt-1 text-slate-200">{{ data.course.code }} {{ data.course.name }} · {{ data.course.section }}</p>
        <div class="mt-2 flex flex-wrap gap-2 text-xs">
          <span class="pill">แผนก{{ data.course.department_name }}</span>
          <span class="pill">วิชา{{ g.meta.course_type_th }}</span>
          <span v-if="data.course.level" class="pill">{{ data.course.level }}</span>
          <span class="pill">ภาคเรียน {{ data.term.semester }}/{{ data.term.academic_year }}</span>
          <span class="pill">อ้างอิงผู้เรียน {{ g.meta.profiled }}/{{ g.meta.enrolled }} คน</span>
        </div>
      </header>

      <p v-if="!g.ready" class="card text-slate-400">ยังไม่มีผู้เรียนเล่นเกม จึงยังจัดทำไกด์ไม่ได้ — ให้ผู้เรียนเล่นเควสต์ก่อน</p>

      <template v-else>
        <!-- 1. summary -->
        <section class="card border-rune-400/40">
          <h2 class="sec"><span class="num">1</span> ภาพรวมผู้เรียนและทิศทางการสอน</h2>
          <ul class="mt-3 space-y-2">
            <li v-for="s in g.summary" :key="s" class="flex gap-2 text-slate-100"><span class="text-rune-400">✦</span>{{ s }}</li>
          </ul>
        </section>

        <!-- 2. media -->
        <section class="card">
          <h2 class="sec"><span class="num">2</span> สื่อ เครื่องมือ และกิจกรรมที่แนะนำ</h2>
          <p class="hint">เรียงตามสัดส่วนความถนัดของห้อง · ใช้ทุกแบบในวิชา แต่ให้น้ำหนักกับแบบ “หลัก” และ “รอง” มากที่สุด</p>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div v-for="m in g.modalities" :key="m.key" class="rounded-xl border p-4" :class="m.priority === 'หลัก' ? 'border-rune-400/60 bg-rune-400/5' : m.priority === 'รอง' ? 'border-sky-400/40' : 'border-white/10'">
              <div class="flex items-center justify-between gap-2">
                <p class="font-medium text-slate-50">{{ m.label }}</p>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-xs" :class="m.priority === 'หลัก' ? 'bg-rune-400 text-abyss-950' : m.priority === 'รอง' ? 'bg-sky-500/80 text-white' : 'bg-white/10 text-slate-300'">
                  {{ m.priority }} · {{ Math.round(m.share) }}%
                </span>
              </div>
              <p class="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400">สื่อ/เครื่องมือ</p>
              <ul class="mt-1 space-y-1 text-sm text-slate-200"><li v-for="x in m.media" :key="x">• {{ x }}</li></ul>
              <p class="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400">กิจกรรม</p>
              <ul class="mt-1 space-y-1 text-sm text-slate-200"><li v-for="x in m.activities" :key="x">• {{ x }}</li></ul>
            </div>
          </div>
        </section>

        <!-- 3. methods -->
        <section class="card">
          <h2 class="sec"><span class="num">3</span> วิธีสอนที่เหมาะกับความสนใจของห้อง</h2>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div v-for="m in g.methods" :key="m.key" class="rounded-xl border border-white/10 p-4">
              <p class="text-xs text-slate-400">ผู้เรียนสาย{{ m.label }} · {{ Math.round(m.share) }}%</p>
              <p class="mt-1 font-medium text-rune-200">{{ m.method }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ m.how }}</p>
            </div>
          </div>
          <details class="mt-4 rounded-xl border border-white/10 p-4">
            <summary class="cursor-pointer text-sm font-medium text-slate-200">บทบาทในงานกลุ่มตามความสนใจ (ใช้ตอนแบ่งหน้าที่)</summary>
            <ul class="mt-3 grid gap-1.5 text-sm text-slate-300 sm:grid-cols-2">
              <li v-for="r in g.group_roles" :key="r.key"><b class="text-slate-100">{{ r.label }}</b> → {{ r.role }}</li>
            </ul>
          </details>
        </section>

        <!-- 4. units -->
        <section class="card">
          <h2 class="sec"><span class="num">4</span> แผนกิจกรรมรายหน่วยการเรียน</h2>
          <p class="hint">กิจกรรมสำหรับ 2 สไตล์หลักของห้อง ในแต่ละหัวข้อ · แก้ไขหัวข้อได้ที่ “แก้ไขบริบทรายวิชา”</p>
          <p v-if="!g.units.length" class="mt-3 text-sm text-slate-400">ยังไม่ได้ระบุหัวข้อ/หน่วยการเรียนของรายวิชา</p>
          <div class="mt-4 overflow-x-auto">
            <table v-if="g.units.length" class="w-full min-w-[640px] text-sm">
              <thead class="text-left text-xs text-slate-400">
                <tr class="border-b border-white/10">
                  <th class="w-10 py-2 pr-2">หน่วย</th><th class="w-32 py-2 pr-3">หัวข้อ</th>
                  <th v-for="a in g.units[0].activities" :key="a.key" class="py-2 pr-3">{{ a.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in g.units" :key="u.no" class="border-b border-white/5 align-top">
                  <td class="py-3 pr-2 font-display text-rune-300">{{ u.no }}</td>
                  <td class="py-3 pr-3 font-medium text-slate-100">{{ u.topic }}</td>
                  <td v-for="a in u.activities" :key="a.key" class="py-3 pr-3 text-slate-300">{{ a.text }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="g.units.length" class="mt-3 text-xs text-slate-400">✦ ทุกหน่วย: ควิซสั้นต้นคาบถัดไปเพื่อทบทวน (Retrieval Practice)</p>
        </section>

        <!-- 5. mindset -->
        <section class="card">
          <h2 class="sec"><span class="num">5</span> การสร้างบรรยากาศและกรอบความคิด (Mindset)</h2>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="rounded-xl border border-white/10 p-4">
              <p class="font-medium text-slate-100">สำหรับทั้งห้อง</p>
              <ul class="mt-2 space-y-1 text-sm text-slate-300"><li v-for="x in g.mindset.class" :key="x">• {{ x }}</li></ul>
            </div>
            <div class="rounded-xl border border-[#d95926]/50 p-4">
              <p class="font-medium text-slate-100">ผู้เรียน Fixed Mindset ({{ g.mindset.fixed_pct }}%)</p>
              <ul class="mt-2 space-y-1 text-sm text-slate-300"><li v-for="x in g.mindset.fixed" :key="x">• {{ x }}</li></ul>
            </div>
          </div>
        </section>

        <!-- 6. groups -->
        <section class="card">
          <h2 class="sec"><span class="num">6</span> กลุ่มผู้เรียนและแนวทางซ่อมเสริมรายกลุ่ม</h2>
          <p class="hint">คลิกกลุ่มเพื่อดูรายชื่อ · ใช้ประกอบการซ่อมเสริมและดูแลรายบุคคล</p>
          <div class="mt-4 space-y-2">
            <div v-for="gr in g.groups" :key="gr.key" class="rounded-xl border" :class="gr.tone === 'care' ? 'border-[#d95926]/50' : gr.tone === 'muted' ? 'border-white/10 opacity-80' : 'border-white/10'">
              <button class="flex w-full items-center justify-between gap-3 p-4 text-left" @click="openGroups[gr.key] = !openGroups[gr.key]">
                <div>
                  <p class="font-medium text-slate-100">{{ gr.title }} <span class="text-sm text-slate-400">· {{ gr.students.length }} คน</span></p>
                  <p v-for="a in gr.advice" :key="a" class="text-sm text-slate-300">{{ a }}</p>
                </div>
                <AppIcon name="back" :size="16" class="shrink-0 text-slate-400 transition" :class="openGroups[gr.key] ? 'rotate-90' : '-rotate-90'" />
              </button>
              <div v-if="openGroups[gr.key]" class="flex flex-wrap gap-1.5 border-t border-white/10 p-4">
                <span v-for="st in gr.students" :key="st.id" class="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-200">{{ st.code }} {{ st.name }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- 7. principles -->
        <section class="card">
          <h2 class="sec"><span class="num">7</span> หลักการสอนที่ใช้ได้กับผู้เรียนทุกคน</h2>
          <p class="hint">มีหลักฐานงานวิจัยรองรับ — ใช้เป็นฐานร่วมกับข้อ 2–4</p>
          <div class="mt-4 grid gap-3 md:grid-cols-2">
            <div v-for="p in g.principles" :key="p.title" class="rounded-xl border border-white/10 p-4">
              <p class="font-medium text-slate-100">{{ p.title }}</p>
              <p class="mt-1 text-sm text-slate-300">{{ p.how }}</p>
              <p class="mt-1 text-xs text-slate-500">เหตุผล: {{ p.why }}</p>
            </div>
          </div>
        </section>

        <!-- 8. evaluation -->
        <section class="card">
          <h2 class="sec"><span class="num">8</span> การติดตามผล (สำหรับ ว.PA / วิจัยชั้นเรียน)</h2>
          <ul class="mt-3 space-y-1.5 text-sm text-slate-200"><li v-for="x in g.evaluation" :key="x">• {{ x }}</li></ul>
          <p class="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-slate-400">หมายเหตุ: {{ g.caveat }}</p>
        </section>
      </template>
    </div>

    <!-- context editor -->
    <div v-if="editing" class="no-print fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-abyss-950/85 p-4 backdrop-blur-sm" @click.self="editing = false">
      <div class="card my-auto w-full max-w-lg animate-fade-up border-rune-400/40">
        <h2 class="title-glow text-xl">บริบทรายวิชา</h2>
        <p class="text-sm text-slate-400">ไกด์จะปรับตามข้อมูลนี้ · กลุ่มสาระ: {{ DOMAIN_TH[g?.meta.domain] }} (ตามแผนก)</p>
        <p class="label mt-4">ประเภทวิชา</p>
        <div class="flex gap-2">
          <button v-for="t in TYPES" :key="t.v" class="rounded-xl border px-4 py-2 text-sm transition" :class="ctx.course_type === t.v ? 'border-rune-400 bg-rune-400/15 text-rune-200' : 'border-white/15 text-slate-300'" @click="ctx.course_type = t.v">{{ t.th }}</button>
        </div>
        <p class="label mt-4">ระดับชั้น</p>
        <input v-model="ctx.level" class="input" placeholder="เช่น ปวส.1">
        <p class="label mt-4">หัวข้อ/หน่วยการเรียน (บรรทัดละ 1 หัวข้อ)</p>
        <textarea v-model="ctx.topicsText" rows="7" class="input" />
        <p class="label mt-4">หมายเหตุบริบทเพิ่มเติม</p>
        <textarea v-model="ctx.context_note" rows="2" class="input" placeholder="เช่น ใช้ภาษา Python, ห้องแล็บ 40 เครื่อง" />
        <div class="mt-5 flex gap-2">
          <button class="btn-primary flex-1" :disabled="saving" @click="saveContext">บันทึกและสร้างไกด์ใหม่</button>
          <button class="btn-ghost" @click="editing = false">ยกเลิก</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pill { @apply rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-slate-300; }
.sec { @apply flex items-center gap-2 text-lg font-medium text-slate-50; }
.num { @apply flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rune-400 font-display text-sm font-bold text-abyss-950; }
.hint { @apply mt-1 text-xs text-slate-400; }
@media print {
  .no-print { display: none !important; }
}
</style>
