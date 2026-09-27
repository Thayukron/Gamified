<script setup lang="ts">
const route = useRoute()
const api = useApi()
const data = ref<any>(null)
const error = ref('')
const editing = ref(false)
const saving = ref(false)
const ctx = reactive({ course_type: 'mixed', level: '', topicsText: '', context_note: '' })

// ---- AI (Gemini, teacher's own key) — reads cache only; calls AI only on button press ----
const ai = ref<any>(null)
const aiCourse = ref<any>(null)
const aiUnits = ref<Record<string, any>>({})
const aiBusy = ref<string | null>(null) // 'course' or a topic name
const aiError = ref<{ where: string; text: string } | null>(null)
const openUnit = ref<string | null>(null)
const aiReady = computed(() => ai.value?.enabled && ai.value?.active_source)

async function loadAi() {
  const res = await api(`/teacher/courses/${route.params.id}/ai/all`)
  ai.value = res.ai
  aiCourse.value = res.course
  aiUnits.value = res.units ?? {}
}

async function generate(type: 'course' | 'unit', topic?: string) {
  aiBusy.value = type === 'course' ? 'course' : topic!
  aiError.value = null
  try {
    const res = await api(`/teacher/courses/${route.params.id}/ai`, { method: 'POST', body: { type, topic } })
    if (type === 'course') aiCourse.value = res.result
    else {
      aiUnits.value = { ...aiUnits.value, [topic!]: res.result }
      openUnit.value = topic!
    }
  } catch (e) {
    aiError.value = { where: type === 'course' ? 'course' : topic!, text: apiErrorMessage(e) }
  } finally {
    aiBusy.value = null
  }
}
const fmtTime = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const STYLE_TH: Record<string, string> = { V: 'ภาพ', A: 'ฟัง', R: 'อ่านเขียน', K: 'ลงมือทำ' }

async function load() {
  try {
    loadAi().catch(() => {})
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
  <div class="guide print-doc">
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
      <p class="print-only text-xs">ARCANA PROFILE · ระบบประเมินโปรไฟล์ผู้เรียน · พิมพ์เมื่อ {{ new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' }) }}</p>
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

        <!-- AI: course-level guide -->
        <section class="card ai-card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="sec"><span class="num !bg-sky-400">AI</span> ไกด์เชิงลึกเฉพาะรายวิชา (Gemini)</h2>
              <p class="hint">AI วิเคราะห์จากสถิติรวมของห้องและเนื้อหาวิชา (ไม่ส่งชื่อนักเรียน) · เรียก AI เฉพาะเมื่อกดปุ่ม และจำผลไว้ใช้ซ้ำ</p>
            </div>
            <template v-if="aiReady">
              <button class="no-print btn-primary !py-2 text-sm" :disabled="!!aiBusy" @click="generate('course')">
                <AppIcon name="sparkle" :size="16" />
                {{ aiBusy === 'course' ? 'AI กำลังวิเคราะห์... (10–30 วินาที)' : aiCourse ? 'วิเคราะห์ใหม่' : 'วิเคราะห์ด้วย AI' }}
              </button>
            </template>
          </div>

          <p v-if="ai && !ai.enabled" class="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">ผู้ดูแลระบบปิดการใช้งาน AI อยู่ — ใช้ไกด์แบบกฎด้านล่างได้ตามปกติ</p>
          <div v-else-if="ai && !ai.active_source" class="no-print mt-3 rounded-xl border border-sky-400/40 bg-sky-500/10 p-4 text-sm text-sky-100">
            ต้องกรอก <b>API Key ของ Gemini</b> ของคุณเองก่อนใช้ฟังก์ชันนี้ (ขอได้ฟรี ใช้เวลา 1 นาที)
            <NuxtLink to="/teacher/settings" class="btn-ghost mt-3 !border-sky-400/60 !py-1.5 text-sm !text-sky-200">ไปตั้งค่า AI ของฉัน →</NuxtLink>
          </div>
          <p v-if="aiError?.where === 'course'" class="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{{ aiError.text }}</p>

          <div v-if="aiCourse" class="mt-4 space-y-4">
            <p v-if="aiCourse.stale" class="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-200">⚠ ข้อมูลผู้เรียนหรือบริบทวิชาเปลี่ยนไปหลังการวิเคราะห์ครั้งนี้ — กด “วิเคราะห์ใหม่” เพื่ออัปเดต</p>
            <p class="text-slate-100">{{ aiCourse.data.overview }}</p>
            <div>
              <p class="sub-h">กลยุทธ์การสอน</p>
              <div class="mt-2 grid gap-3 md:grid-cols-2">
                <div v-for="s in aiCourse.data.strategies" :key="s.title" class="rounded-xl border border-white/10 p-3">
                  <p class="font-medium text-sky-200">{{ s.title }}</p>
                  <p class="mt-1 text-sm text-slate-300">{{ s.detail }}</p>
                  <p v-if="s.for" class="mt-1 text-xs text-slate-500">เหมาะกับ: {{ s.for }}</p>
                </div>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <p class="sub-h">สื่อ/เครื่องมือที่แนะนำ</p>
                <ul class="mt-2 space-y-1 text-sm text-slate-300"><li v-for="t in aiCourse.data.tools" :key="t.name">• <b class="text-slate-100">{{ t.name }}</b> — {{ t.use }}</li></ul>
              </div>
              <div>
                <p class="sub-h">การวัดผลที่เหมาะสม</p>
                <ul class="mt-2 space-y-1 text-sm text-slate-300"><li v-for="t in aiCourse.data.assessment" :key="t">• {{ t }}</li></ul>
              </div>
            </div>
            <div v-if="aiCourse.data.misconceptions.length">
              <p class="sub-h">ความเข้าใจผิดที่พบบ่อยและวิธีแก้</p>
              <ul class="mt-2 space-y-2 text-sm">
                <li v-for="m in aiCourse.data.misconceptions" :key="m.issue" class="rounded-xl border border-white/10 p-3">
                  <span class="text-rune-300">{{ m.topic }}</span> · <span class="text-slate-200">{{ m.issue }}</span>
                  <p class="mt-1 text-slate-400">แก้โดย: {{ m.fix }}</p>
                </li>
              </ul>
            </div>
            <p v-if="aiCourse.data.fixed_mindset" class="rounded-xl border border-[#d95926]/40 p-3 text-sm text-slate-200"><b>ผู้เรียน Fixed Mindset:</b> {{ aiCourse.data.fixed_mindset }}</p>
            <p class="text-xs text-slate-500">
              สร้างโดย {{ aiCourse.model }} · {{ fmtTime(aiCourse.created_at) }} · ใช้ Key {{ aiCourse.key_source === 'central' ? 'กลางของวิทยาลัย' : 'ของคุณ' }}
              <template v-if="aiCourse.tokens.prompt"> · {{ aiCourse.tokens.prompt + aiCourse.tokens.output }} tokens</template>
              · เนื้อหาจาก AI ควรตรวจทานก่อนนำไปใช้
            </p>
          </div>
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
                  <th class="no-print w-40 py-2">แผนละเอียด (AI)</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="u in g.units" :key="u.no">
                  <tr class="border-b border-white/5 align-top">
                    <td class="py-3 pr-2 font-display text-rune-300">{{ u.no }}</td>
                    <td class="py-3 pr-3 font-medium text-slate-100">{{ u.topic }}</td>
                    <td v-for="a in u.activities" :key="a.key" class="py-3 pr-3 text-slate-300">{{ a.text }}</td>
                    <td class="no-print py-3">
                      <button
                        v-if="aiUnits[u.topic]"
                        class="btn-ghost !border-sky-400/50 !px-3 !py-1.5 text-xs !text-sky-200"
                        @click="openUnit = openUnit === u.topic ? null : u.topic"
                      >
                        {{ openUnit === u.topic ? 'ซ่อนแผน' : 'ดูแผน' }}<span v-if="aiUnits[u.topic].stale" title="ข้อมูลเปลี่ยนแล้ว"> ⚠</span>
                      </button>
                      <button
                        v-else-if="aiReady"
                        class="btn-ghost !px-3 !py-1.5 text-xs"
                        :disabled="!!aiBusy"
                        @click="generate('unit', u.topic)"
                      >
                        <AppIcon name="sparkle" :size="13" /> {{ aiBusy === u.topic ? 'กำลังออกแบบ...' : 'ออกแบบด้วย AI' }}
                      </button>
                      <span v-else class="text-xs text-slate-500">ต้องมี API Key</span>
                      <p v-if="aiError?.where === u.topic" class="mt-1 text-xs text-red-300">{{ aiError.text }}</p>
                    </td>
                  </tr>
                  <tr v-if="aiUnits[u.topic]" v-show="openUnit === u.topic" class="print-show-row border-b border-white/5">
                    <td :colspan="3 + u.activities.length" class="pb-5">
                      <div class="rounded-xl border border-sky-400/40 bg-sky-500/5 p-4">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <p class="font-medium text-sky-200">แผนการสอนหน่วย “{{ u.topic }}” · {{ aiUnits[u.topic].data.duration_minutes }} นาที</p>
                          <button class="no-print btn-ghost !px-3 !py-1 text-xs" :disabled="!!aiBusy" @click="generate('unit', u.topic)">{{ aiBusy === u.topic ? 'กำลังออกแบบ...' : 'ออกแบบใหม่' }}</button>
                        </div>
                        <p v-if="aiUnits[u.topic].stale" class="mt-2 text-xs text-amber-200">⚠ ข้อมูลผู้เรียนเปลี่ยนไปหลังออกแบบแผนนี้</p>
                        <p class="mt-2 text-sm text-slate-200"><b>จุดประสงค์:</b> {{ aiUnits[u.topic].data.objective }}</p>
                        <ol class="mt-3 space-y-2">
                          <li v-for="(s, i) in aiUnits[u.topic].data.steps" :key="i" class="flex gap-3 text-sm">
                            <span class="w-16 shrink-0 text-right tabular-nums text-slate-400">{{ s.minutes }} นาที</span>
                            <div>
                              <span class="font-medium text-slate-100">{{ s.phase }}</span>
                              <span v-for="st in s.styles" :key="st" class="ml-1 rounded bg-white/10 px-1.5 text-[10px] text-slate-300">{{ STYLE_TH[st] }}</span>
                              <p class="text-slate-300">{{ s.activity }}</p>
                            </div>
                          </li>
                        </ol>
                        <div class="mt-3 grid gap-3 md:grid-cols-2">
                          <div>
                            <p class="sub-h">ปรับตามสไตล์ผู้เรียน</p>
                            <ul class="mt-1 space-y-1 text-sm text-slate-300">
                              <li v-for="(v, k) in aiUnits[u.topic].data.differentiation" v-show="v" :key="k"><b class="text-slate-100">{{ STYLE_TH[k] }}:</b> {{ v }}</li>
                            </ul>
                          </div>
                          <div>
                            <p class="sub-h">สื่อ/อุปกรณ์</p>
                            <ul class="mt-1 space-y-1 text-sm text-slate-300"><li v-for="m in aiUnits[u.topic].data.materials" :key="m">• {{ m }}</li></ul>
                            <p class="sub-h mt-3">คำถามทบทวนท้ายคาบ</p>
                            <ol class="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-300"><li v-for="q in aiUnits[u.topic].data.check_questions" :key="q">{{ q }}</li></ol>
                          </div>
                        </div>
                        <p v-if="aiUnits[u.topic].data.fixed_mindset_support" class="mt-3 text-sm text-slate-300"><b>ผู้เรียน Fixed Mindset:</b> {{ aiUnits[u.topic].data.fixed_mindset_support }}</p>
                        <p class="mt-3 text-xs text-slate-500">สร้างโดย {{ aiUnits[u.topic].model }} · {{ fmtTime(aiUnits[u.topic].created_at) }} · ควรตรวจทานก่อนนำไปใช้</p>
                      </div>
                    </td>
                  </tr>
                </template>
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
              <div v-show="openGroups[gr.key]" class="print-show-flex flex flex-wrap gap-1.5 border-t border-white/10 p-4">
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
.sub-h { @apply text-xs font-medium uppercase tracking-wider text-slate-400; }
.ai-card { @apply border-sky-400/40; background-image: radial-gradient(ellipse at top right, rgba(56,189,248,0.10), transparent 60%); }
</style>
