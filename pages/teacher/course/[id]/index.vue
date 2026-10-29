<script setup lang="ts">
import { RIASEC, VARK, varkLabel } from '~/utils/profile'
import { pct, VIZ } from '~/utils/viz'

type Status = 'complete' | 'partial' | 'playing' | 'not_started'
interface Student {
  id: number
  student_code: string
  full_name: string
  status: Status
  profile: null | Record<string, any>
}

const route = useRoute()
const api = useApi()
const data = ref<any>(null)
const error = ref('')

onMounted(async () => {
  try {
    data.value = await api(`/teacher/courses/${route.params.id}/dashboard`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
})

const s = computed(() => data.value?.summary)
const dist = computed(() => data.value?.distribution)
const profiled = computed(() => s.value?.profiled ?? 0)

// ---- labels -----------------------------------------------------------------
const STATUS: Record<Status, { th: string; cls: string }> = {
  complete: { th: 'ครบทุกเควสต์', cls: 'border-emerald-400/40 text-emerald-300' },
  partial: { th: 'เล่นบางส่วน', cls: 'border-sky-400/40 text-sky-300' },
  playing: { th: 'กำลังเล่น', cls: 'border-amber-400/40 text-amber-300' },
  not_started: { th: 'ยังไม่เริ่ม', cls: 'border-slate-500/40 text-slate-400' },
}
const MINDSET_T = {
  growth: { th: 'Growth Mindset', sub: 'มองความผิดพลาดเป็นบทเรียน' },
  mixed: { th: 'Mixed', sub: 'อยู่ระหว่างกลาง' },
  fixed: { th: 'Fixed Mindset', sub: 'ควรเสริมแรงเชิงบวก' },
}
const riasecKeys = ['R', 'I', 'A', 'S', 'E', 'C'] as const

const varkRows = computed(() =>
  (['V', 'A', 'R', 'K'] as const)
    .map((k) => ({ key: k, label: `${k} · ${VARK[k].th}`, value: dist.value?.vark[k] ?? 0 }))
    .concat([{ key: 'multi', label: 'หลายช่องทาง (Multimodal)', value: dist.value?.vark.multi ?? 0 }]),
)
const riasecRows = computed(() =>
  riasecKeys.map((k) => ({ key: k, label: `${k} · ${RIASEC[k].th}`, sub: RIASEC[k].name, value: dist.value?.riasec[k] ?? 0 })),
)

// ---- key findings (rule-based, one line each) -----------------------------------
const findings = computed(() => {
  if (!profiled.value) return []
  const out: string[] = []
  const topVark = varkRows.value.slice().sort((a, b) => b.value - a.value)[0]
  out.push(`ผู้เรียนส่วนใหญ่ถนัดเรียนรู้แบบ “${topVark.label.split(' · ').pop()}” ${pct(topVark.value, profiled.value)}% ของผู้ที่มีโปรไฟล์`)
  const topR = riasecRows.value.slice().sort((a, b) => b.value - a.value)[0]
  out.push(`ความสนใจหลักของห้องคือ ${topR.sub} (${topR.label.split(' · ').pop()}) ${pct(topR.value, profiled.value)}%`)
  const fixed = dist.value.mindset.fixed
  if (fixed) out.push(`มีผู้เรียน Fixed Mindset ${fixed} คน (${pct(fixed, profiled.value)}%) — ควรได้รับงานที่สำเร็จได้เร็วและคำชมที่ความพยายาม`)
  if (s.value.not_started) out.push(`ยังมีผู้เรียน ${s.value.not_started} คนที่ยังไม่ได้เล่นเกม — ข้อมูลห้องจะแม่นขึ้นเมื่อเล่นครบ`)
  return out
})

// ---- roster filters -------------------------------------------------------------
const q = ref('')
const fStatus = ref<'' | Status>('')
const fVark = ref('')
const fRiasec = ref('')
const fMindset = ref('')
const students = computed<Student[]>(() => data.value?.students ?? [])
const filtered = computed(() =>
  students.value.filter((st) => {
    const p = st.profile
    if (q.value && !`${st.student_code} ${st.full_name}`.toLowerCase().includes(q.value.toLowerCase())) return false
    if (fStatus.value && st.status !== fStatus.value) return false
    if (fVark.value) {
      if (!p) return false
      const v = p.dominant_vark ?? ''
      if (fVark.value === 'multi' ? v.length < 2 : v !== fVark.value) return false
    }
    if (fRiasec.value && p?.dominant_riasec?.[0] !== fRiasec.value) return false
    if (fMindset.value && p?.mindset_type !== fMindset.value) return false
    return true
  }),
)
const hasFilter = computed(() => !!(q.value || fStatus.value || fVark.value || fRiasec.value || fMindset.value))
function clearFilters() {
  q.value = fStatus.value = fVark.value = fRiasec.value = fMindset.value = ''
}
function filterBy(kind: 'vark' | 'riasec' | 'mindset', key: string) {
  clearFilters()
  if (kind === 'vark') fVark.value = key
  if (kind === 'riasec') fRiasec.value = key
  if (kind === 'mindset') fMindset.value = key
  document.getElementById('roster')?.scrollIntoView({ behavior: 'smooth' })
}

// ---- individual drawer --------------------------------------------------------------
const selected = ref<Student | null>(null)
const share = (p: Record<string, any>, prefix: string, keys: readonly string[]) => {
  const vals = keys.map((k) => p[`${prefix}_${k.toLowerCase()}`] ?? 0)
  const total = vals.reduce((a, b) => a + b, 0) || 1
  return vals.map((v) => Math.round((v / total) * 1000) / 10)
}
const radarSeries = computed(() => {
  const p = selected.value?.profile
  if (!p) return []
  return [
    { label: selected.value!.full_name, values: share(p, 'riasec', riasecKeys) },
    { label: 'ค่าเฉลี่ยห้อง', values: riasecKeys.map((k) => data.value.average.riasec[k]) },
  ]
})
</script>

<template>
  <div>
    <NuxtLink to="/teacher" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300">
      <AppIcon name="back" :size="16" /> รายวิชาทั้งหมด
    </NuxtLink>

    <p v-if="error" class="card mt-4 text-red-300">{{ error }}</p>
    <p v-else-if="!data" class="mt-6 text-slate-500">กำลังวิเคราะห์ข้อมูลผู้เรียน...</p>

    <div v-else class="mt-3 space-y-6">
      <!-- header -->
      <header class="flex animate-fade-up flex-wrap items-end justify-between gap-3">
        <div>
          <p class="font-mono text-xs text-rune-300/80">{{ data.course.code }} · {{ data.course.section }} · แผนก{{ data.course.department_name }}</p>
          <h1 class="title-glow mt-1 text-2xl sm:text-3xl">{{ data.course.name }}</h1>
          <p class="text-sm text-slate-400">แดชบอร์ดโปรไฟล์ผู้เรียน · ภาคเรียน {{ data.term.semester }}/{{ data.term.academic_year }} · ครูผู้สอน {{ data.course.teacher_name }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <NuxtLink :to="`/teacher/course/${route.params.id}/plans`" class="btn-primary !py-2 text-sm" data-testid="lesson-plans">
            <AppIcon name="scroll" :size="16" /> แผนการจัดการเรียนรู้
          </NuxtLink>
          <NuxtLink :to="`/teacher/course/${route.params.id}/students`" class="btn-ghost !py-2 text-sm" data-testid="manage-students">
            <AppIcon name="quill" :size="16" /> จัดการรายชื่อ / แก้ไขวิชา
          </NuxtLink>
        </div>
      </header>

      <!-- stat tiles -->
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="tile"><p class="tile-label">ผู้เรียนในรายวิชา</p><p class="tile-num">{{ s.enrolled }}</p><p class="tile-sub">คน</p></div>
        <div class="tile"><p class="tile-label">มีโปรไฟล์แล้ว</p><p class="tile-num">{{ pct(s.profiled, s.enrolled) }}%</p><p class="tile-sub">{{ s.profiled }} จาก {{ s.enrolled }} คน</p></div>
        <div class="tile"><p class="tile-label">เล่นครบทุกเควสต์</p><p class="tile-num">{{ s.complete }}</p><p class="tile-sub">คน · ผลแม่นยำที่สุด</p></div>
        <button class="tile text-left transition hover:border-rune-400/50" @click="clearFilters(); fStatus = 'not_started'">
          <p class="tile-label">ยังไม่เริ่มเล่น</p><p class="tile-num">{{ s.not_started }}</p><p class="tile-sub">คน · คลิกดูรายชื่อ</p>
        </button>
      </section>

      <!-- key findings -->
      <section v-if="findings.length" class="card border-rune-400/30 !p-5">
        <h2 class="flex items-center gap-2 font-medium text-rune-200"><AppIcon name="eye" :size="18" /> ข้อสังเกตสำคัญของห้องนี้</h2>
        <ul class="mt-2 space-y-1.5 text-sm text-slate-200">
          <li v-for="f in findings" :key="f" class="flex gap-2"><span class="text-rune-400">✦</span>{{ f }}</li>
        </ul>
        <div class="mt-4 flex flex-wrap gap-2">
          <NuxtLink :to="`/teacher/course/${route.params.id}/guide`" class="btn-primary">
            <AppIcon name="orb" :size="18" /> ดูไกด์การจัดการเรียนการสอนของห้องนี้
          </NuxtLink>
          <NuxtLink :to="`/teacher/course/${route.params.id}/groups`" class="btn-ghost">
            <AppIcon name="castle" :size="18" /> จัดกลุ่มผู้เรียน
          </NuxtLink>
          <NuxtLink :to="`/teacher/course/${route.params.id}/report`" class="btn-ghost">
            <AppIcon name="scroll" :size="18" /> รายงาน ว.PA (PDF/Excel)
          </NuxtLink>
        </div>
      </section>

      <p v-if="!profiled" class="card text-slate-400">ยังไม่มีผู้เรียนเล่นเกม — ส่งลิงก์ให้ผู้เรียนเข้าเล่นเควสต์ แล้วข้อมูลจะแสดงที่นี่</p>

      <!-- charts -->
      <div v-else class="grid gap-5 lg:grid-cols-2">
        <section class="card">
          <h2 class="chart-title">สไตล์การเรียนรู้ (VARK)</h2>
          <p class="chart-sub">จำนวนผู้เรียนตามช่องทางที่ถนัดที่สุด · คลิกแท่งเพื่อดูรายชื่อ</p>
          <VizDistBars class="mt-4" :rows="varkRows" :total="profiled" :highlight="fVark" @pick="filterBy('vark', $event)" />
        </section>

        <section class="card">
          <h2 class="chart-title">กรอบความคิด (Mindset)</h2>
          <p class="chart-sub">สัดส่วนผู้เรียนทั้งห้อง</p>
          <div class="mt-5 flex h-10 overflow-hidden rounded-lg">
            <button
              v-for="k in (['growth', 'mixed', 'fixed'] as const)"
              v-show="dist.mindset[k]"
              :key="k"
              class="h-full border-r-2 border-abyss-800 transition last:border-r-0 hover:brightness-125"
              :style="{ width: `${pct(dist.mindset[k], profiled)}%`, background: k === 'growth' ? VIZ.series1 : k === 'fixed' ? VIZ.series2 : VIZ.neutral }"
              :title="`${MINDSET_T[k].th}: ${dist.mindset[k]} คน`"
              @click="filterBy('mindset', k)"
            />
          </div>
          <ul class="mt-4 space-y-2 text-sm">
            <li v-for="k in (['growth', 'mixed', 'fixed'] as const)" :key="k" class="flex items-center gap-2">
              <span class="h-3 w-3 shrink-0 rounded-sm" :style="{ background: k === 'growth' ? VIZ.series1 : k === 'fixed' ? VIZ.series2 : VIZ.neutral }" />
              <span class="text-slate-200">{{ MINDSET_T[k].th }}</span>
              <span class="text-xs text-slate-500">{{ MINDSET_T[k].sub }}</span>
              <span class="ml-auto tabular-nums text-slate-300">{{ dist.mindset[k] }} <span class="text-xs text-slate-500">({{ pct(dist.mindset[k], profiled) }}%)</span></span>
            </li>
          </ul>
        </section>

        <section class="card">
          <h2 class="chart-title">ความสนใจอาชีพหลัก (RIASEC)</h2>
          <p class="chart-sub">จำนวนผู้เรียนตามตัวอักษรแรกของ Holland Code · คลิกแท่งเพื่อดูรายชื่อ</p>
          <VizDistBars class="mt-4" :rows="riasecRows" :total="profiled" :highlight="fRiasec" @pick="filterBy('riasec', $event)" />
        </section>

        <section class="card">
          <h2 class="chart-title">โปรไฟล์ RIASEC เฉลี่ยของห้อง</h2>
          <p class="chart-sub">สัดส่วนคะแนนเฉลี่ย (%) · ชี้จุดเพื่อดูค่า</p>
          <div class="mt-2 h-72">
            <VizRadarCompare :labels="riasecKeys.map((k) => `${k} ${RIASEC[k].th}`)" :series="[{ label: 'ค่าเฉลี่ยห้อง', values: riasecKeys.map((k) => data.average.riasec[k]) }]" />
          </div>
        </section>

        <section class="card lg:col-span-2">
          <h2 class="chart-title">การ์ดตัวละคร (Archetype) ในห้อง</h2>
          <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div v-for="a in dist.archetype" :key="a.code" class="rounded-xl border border-white/10 bg-abyss-950/50 p-3 text-center">
              <span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2" :style="{ borderColor: a.color, color: a.color }"><AppIcon :name="a.icon" :size="20" /></span>
              <p class="mt-2 text-sm font-medium text-slate-100">{{ a.name }}</p>
              <p class="truncate text-xs text-slate-400">{{ a.title }}</p>
              <p class="mt-1 font-display text-lg text-slate-100">{{ a.count }} <span class="text-xs text-slate-500">คน</span></p>
            </div>
          </div>
        </section>
      </div>

      <!-- roster -->
      <section id="roster" class="card !p-0">
        <div class="border-b border-white/10 p-4 sm:p-5">
          <h2 class="chart-title">รายชื่อผู้เรียน <span class="text-sm font-normal text-slate-400">({{ filtered.length }}/{{ students.length }} คน)</span></h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <input v-model="q" class="input !w-56 !py-2 text-sm" placeholder="ค้นหาชื่อ / รหัส">
            <select v-model="fStatus" class="input !w-auto !py-2 text-sm">
              <option value="">ทุกสถานะ</option>
              <option v-for="(v, k) in STATUS" :key="k" :value="k">{{ v.th }}</option>
            </select>
            <select v-model="fVark" class="input !w-auto !py-2 text-sm">
              <option value="">ทุก VARK</option>
              <option v-for="r in varkRows" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
            <select v-model="fRiasec" class="input !w-auto !py-2 text-sm">
              <option value="">ทุก RIASEC</option>
              <option v-for="r in riasecRows" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
            <select v-model="fMindset" class="input !w-auto !py-2 text-sm">
              <option value="">ทุก Mindset</option>
              <option v-for="(v, k) in MINDSET_T" :key="k" :value="k">{{ v.th }}</option>
            </select>
            <button v-if="hasFilter" class="btn-ghost !py-2 text-sm" @click="clearFilters">ล้างตัวกรอง</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead class="text-left text-xs uppercase tracking-wider text-slate-400">
              <tr class="border-b border-white/10">
                <th class="px-4 py-3">รหัส</th><th class="px-4 py-3">ชื่อ-สกุล</th><th class="px-4 py-3">สถานะ</th>
                <th class="px-4 py-3">Archetype</th><th class="px-4 py-3">Holland</th><th class="px-4 py-3">VARK</th><th class="px-4 py-3">Mindset</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="st in filtered"
                :key="st.id"
                class="cursor-pointer border-b border-white/5 transition hover:bg-white/5"
                @click="selected = st"
              >
                <td class="px-4 py-2.5 font-mono text-slate-400">{{ st.student_code }}</td>
                <td class="px-4 py-2.5 text-slate-100">{{ st.full_name }}</td>
                <td class="px-4 py-2.5"><span class="rounded-full border px-2 py-0.5 text-xs" :class="STATUS[st.status].cls">{{ STATUS[st.status].th }}</span></td>
                <template v-if="st.profile">
                  <td class="px-4 py-2.5"><span class="inline-flex items-center gap-1.5"><AppIcon :name="st.profile.icon" :size="14" :style="{ color: st.profile.color }" /><span class="text-slate-200">{{ st.profile.archetype_name }}</span></span></td>
                  <td class="px-4 py-2.5 font-display text-slate-100">{{ st.profile.dominant_riasec }}</td>
                  <td class="px-4 py-2.5 text-slate-200">{{ st.profile.dominant_vark ?? '-' }}</td>
                  <td class="px-4 py-2.5 text-slate-300">{{ MINDSET_T[st.profile.mindset_type as 'growth'].th }}</td>
                </template>
                <td v-else colspan="4" class="px-4 py-2.5 text-xs text-slate-500">ยังไม่มีข้อมูล</td>
              </tr>
            </tbody>
          </table>
          <p v-if="!filtered.length" class="p-6 text-center text-slate-500">ไม่พบผู้เรียนตามเงื่อนไข</p>
        </div>
      </section>
    </div>

    <!-- individual profile drawer -->
    <Transition enter-from-class="translate-x-full" leave-to-class="translate-x-full" enter-active-class="transition duration-300" leave-active-class="transition duration-200">
      <aside v-if="selected" class="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-rune-400/30 bg-abyss-900/95 p-5 shadow-2xl backdrop-blur-xl">
        <button class="btn-ghost !absolute right-4 top-4 !px-3 !py-1.5 text-sm" @click="selected = null">ปิด ✕</button>
        <p class="font-mono text-xs text-slate-400">{{ selected.student_code }}</p>
        <h2 class="title-glow text-xl">{{ selected.full_name }}</h2>
        <span class="mt-1 inline-block rounded-full border px-2 py-0.5 text-xs" :class="STATUS[selected.status].cls">{{ STATUS[selected.status].th }}</span>

        <p v-if="!selected.profile" class="card mt-5 text-sm text-slate-400">ผู้เรียนยังไม่ได้เล่นเควสต์ จึงยังไม่มีโปรไฟล์</p>
        <template v-else>
          <div class="mt-4 flex items-center gap-3 rounded-xl border bg-abyss-950/60 p-3" :style="{ borderColor: `${selected.profile.color}88` }">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2" :style="{ borderColor: selected.profile.color, color: selected.profile.color }"><AppIcon :name="selected.profile.icon" :size="24" /></span>
            <div>
              <p class="font-display font-bold text-rune-200">{{ selected.profile.archetype_name }}</p>
              <p class="text-sm" :style="{ color: selected.profile.color }">{{ selected.profile.archetype_title }}</p>
              <p class="text-xs text-slate-500">จาก {{ selected.profile.quests_completed }}/{{ selected.profile.quests_total }} เควสต์</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-2 text-center">
            <div class="mini"><p class="mini-l">Holland</p><p class="mini-v">{{ selected.profile.dominant_riasec }}</p></div>
            <div class="mini"><p class="mini-l">VARK</p><p class="mini-v">{{ selected.profile.dominant_vark ?? '-' }}</p><p class="text-[10px] text-slate-400">{{ varkLabel(selected.profile.dominant_vark).th }}</p></div>
            <div class="mini"><p class="mini-l">Mindset</p><p class="mini-v !text-sm">{{ MINDSET_T[selected.profile.mindset_type as 'growth'].th }}</p></div>
          </div>

          <h3 class="chart-title mt-5 !text-base">RIASEC เทียบค่าเฉลี่ยห้อง</h3>
          <div class="h-64"><VizRadarCompare :labels="riasecKeys.map((k) => `${k} ${RIASEC[k].th}`)" :series="radarSeries" /></div>

          <h3 class="chart-title mt-4 !text-base">สัดส่วน VARK</h3>
          <VizDistBars
            class="mt-2"
            :rows="(['V', 'A', 'R', 'K'] as const).map((k, i) => ({ key: k, label: `${k} · ${VARK[k].th}`, value: share(selected!.profile!, 'vark', ['V', 'A', 'R', 'K'])[i] }))"
            :total="100"
            percent
          />

          <h3 class="chart-title mt-5 !text-base">จุดแข็งและข้อแนะนำเบื้องต้น</h3>
          <ul class="mt-2 space-y-1 text-sm text-slate-300">
            <li v-for="x in selected.profile.strengths" :key="x" class="flex gap-2"><span class="text-emerald-400">✓</span>{{ x }}</li>
            <li v-for="x in selected.profile.tips" :key="x" class="flex gap-2"><span class="text-rune-400">✦</span>{{ x }}</li>
            <li v-if="selected.profile.mindset_type === 'fixed'" class="flex gap-2"><span class="text-rune-400">✦</span>ให้งานที่สำเร็จได้เร็วเพื่อสร้างความมั่นใจ และชมที่ความพยายามมากกว่าความเก่ง</li>
          </ul>
        </template>
      </aside>
    </Transition>
    <div v-if="selected" class="fixed inset-0 z-30 bg-black/40" @click="selected = null" />
  </div>
</template>

<style scoped>
.tile { @apply rounded-2xl border border-arcane-400/20 bg-abyss-800/60 p-4 backdrop-blur-md; }
.tile-label { @apply text-xs text-slate-400; }
.tile-num { @apply mt-1 font-display text-3xl font-bold tabular-nums text-slate-50; }
.tile-sub { @apply text-xs text-slate-500; }
.chart-title { @apply text-lg font-medium text-slate-100; }
.chart-sub { @apply text-xs text-slate-400; }
.mini { @apply rounded-xl border border-white/10 bg-abyss-950/50 p-2; }
.mini-l { @apply text-[10px] uppercase tracking-widest text-slate-400; }
.mini-v { @apply font-display text-lg font-bold text-slate-100; }
select.input option { background: rgb(var(--c-abyss-800)); }
</style>
