<script setup lang="ts">
import { RIASEC, VARK } from '~/utils/profile'
import { exportReportXlsx } from '~/utils/reportExcel'

const route = useRoute()
const api = useApi()
const r = ref<any>(null)
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  try {
    r.value = await api(`/teacher/courses/${route.params.id}/report`)
  } catch (e) {
    error.value = apiErrorMessage(e)
  }
})

const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : '0.0')
const thDate = (d: string | Date) => new Date(typeof d === 'string' ? d.replace(' ', 'T') : d).toLocaleDateString('th-TH', { dateStyle: 'long' })
const TYPE_TH: Record<string, string> = { theory: 'ทฤษฎี', practice: 'ปฏิบัติ', mixed: 'ทฤษฎีและปฏิบัติ' }
const STATUS_TH: Record<string, string> = { complete: 'ครบทุกเควสต์', partial: 'เล่นบางส่วน', playing: 'กำลังเล่น', not_started: 'ยังไม่เริ่ม' }
const riasecKeys = ['R', 'I', 'A', 'S', 'E', 'C'] as const

const s = computed(() => r.value?.summary)
const n = computed(() => s.value?.profiled ?? 0)
const varkRows = computed(() => {
  const v = r.value.distribution.vark
  return [
    ...(['V', 'A', 'R', 'K'] as const).map((k) => ({ label: `${VARK[k].name} (${k}) — ${VARK[k].th}`, n: v[k] })),
    { label: 'Multimodal — เรียนรู้หลายช่องทาง', n: v.multi },
  ]
})
const riasecRows = computed(() => riasecKeys.map((k) => ({ label: `${RIASEC[k].name} (${k}) — ${RIASEC[k].th}`, n: r.value.distribution.riasec[k], avg: r.value.average.riasec[k] })))
const MINDSET_REPORT = { growth: 'Growth Mindset — กรอบความคิดแบบเติบโต', mixed: 'Mixed — ผสมผสาน', fixed: 'Fixed Mindset — กรอบความคิดแบบยึดติด' }
const mindsetRows = computed(() =>
  (['growth', 'mixed', 'fixed'] as const).map((k) => ({ label: MINDSET_REPORT[k], n: r.value.distribution.mindset[k] })),
)
const profiledStudents = computed(() => (r.value?.students ?? []) as any[])

async function downloadExcel() {
  busy.value = true
  try {
    await exportReportXlsx(r.value)
  } finally {
    busy.value = false
  }
}
const printReport = () => window.print()
</script>

<template>
  <div>
    <div class="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
      <NuxtLink :to="`/teacher/course/${route.params.id}`" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> กลับแดชบอร์ด</NuxtLink>
      <div v-if="r" class="flex gap-2">
        <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="downloadExcel"><AppIcon name="chart" :size="16" /> ดาวน์โหลด Excel</button>
        <button class="btn-primary !py-2 text-sm" @click="printReport"><AppIcon name="download" :size="16" /> พิมพ์ / บันทึก PDF</button>
      </div>
    </div>
    <p v-if="error" class="card text-red-300">{{ error }}</p>
    <p v-else-if="!r" class="text-slate-500">กำลังรวบรวมข้อมูลรายงาน...</p>

    <!-- ═══════════════ document ═══════════════ -->
    <article v-else class="paper print-doc">
      <!-- cover -->
      <div class="cover">
        <p class="cover-inst">{{ r.institution.name }}</p>
        <p>{{ r.institution.affiliation }}</p>
        <div class="cover-title">
          <h1>รายงานผลการวิเคราะห์ผู้เรียนรายบุคคล<br>และแนวทางการจัดการเรียนรู้ที่สอดคล้องกับความแตกต่างของผู้เรียน</h1>
        </div>
        <p><b>รายวิชา</b> {{ r.course.code }} {{ r.course.name }}</p>
        <p>กลุ่มเรียน {{ r.course.section }}<template v-if="r.course.level"> · ระดับ {{ r.course.level }}</template></p>
        <p>แผนกวิชา{{ r.course.department_name }}</p>
        <p>ภาคเรียนที่ {{ r.term.semester }} ปีการศึกษา {{ r.term.academic_year }}</p>
        <div class="cover-by">
          <p>จัดทำโดย</p>
          <p><b>{{ r.course.teacher_name }}</b></p>
          <p>ครูผู้สอน</p>
        </div>
        <p class="cover-foot">ข้อมูลจากระบบ ARCANA PROFILE · จัดทำเมื่อ {{ thDate(r.generated_at) }}</p>
      </div>

      <!-- 1 -->
      <h2>1. ข้อมูลทั่วไป</h2>
      <div class="body">
        <table class="kv">
          <tbody>
            <tr><th>รายวิชา</th><td>{{ r.course.code }} {{ r.course.name }}</td></tr>
            <tr><th>ลักษณะรายวิชา</th><td>{{ TYPE_TH[r.course.course_type] }}</td></tr>
            <tr><th>กลุ่มเรียน / ระดับชั้น</th><td>{{ r.course.section }}<template v-if="r.course.level"> / {{ r.course.level }}</template></td></tr>
            <tr><th>แผนกวิชา</th><td>{{ r.course.department_name }}</td></tr>
            <tr><th>ครูผู้สอน</th><td>{{ r.course.teacher_name }}</td></tr>
            <tr><th>จำนวนผู้เรียน</th><td>{{ s.enrolled }} คน (มีข้อมูลโปรไฟล์ {{ s.profiled }} คน คิดเป็นร้อยละ {{ pct(s.profiled, s.enrolled) }})</td></tr>
            <tr v-if="r.guide.meta.topics.length"><th>หน่วยการเรียน</th><td>{{ r.guide.meta.topics.join(', ') }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 2 -->
      <h2>2. หลักการและเหตุผล</h2>
      <div class="body">
        <p class="para">ผู้เรียนแต่ละคนมีรูปแบบการเรียนรู้ ความสนใจ และกรอบความคิดที่แตกต่างกัน การจัดการเรียนการสอนแบบเดียวกันสำหรับผู้เรียนทุกคนอาจไม่สามารถตอบสนองความต้องการของผู้เรียนได้อย่างทั่วถึง ครูผู้สอนจึงได้ใช้ระบบประเมินโปรไฟล์ผู้เรียนผ่านเกมจำลองสถานการณ์ (Gamified Student Profiling) เพื่อคัดกรองคุณลักษณะของผู้เรียนก่อนการจัดการเรียนรู้ และนำผลการวิเคราะห์มาใช้ออกแบบสื่อ วิธีการสอน การจัดกลุ่ม และการซ่อมเสริมให้เหมาะสมกับผู้เรียนในรายวิชานี้</p>
        <p class="sub">วัตถุประสงค์</p>
        <ol class="num-list">
          <li>เพื่อวิเคราะห์รูปแบบการเรียนรู้ ความสนใจด้านอาชีพ และกรอบความคิดของผู้เรียนรายบุคคลและรายกลุ่ม</li>
          <li>เพื่อกำหนดแนวทางการจัดการเรียนรู้ สื่อ และวิธีการสอนที่สอดคล้องกับความแตกต่างของผู้เรียน</li>
          <li>เพื่อจัดกลุ่มผู้เรียนและวางแผนการซ่อมเสริมให้เหมาะสมกับผู้เรียนแต่ละกลุ่ม</li>
        </ol>
      </div>

      <!-- 3 -->
      <h2>3. เครื่องมือและวิธีการเก็บข้อมูล</h2>
      <div class="body">
        <p class="para">ผู้เรียนเล่นเกมจำลองสถานการณ์ (Visual Novel) จำนวน {{ s.quests_total }} เควสต์ ซึ่งฝังการวัดคุณลักษณะไว้ในการตัดสินใจของผู้เรียน (Stealth Assessment) และคำนวณผลด้วยเกณฑ์ที่กำหนดไว้ล่วงหน้า (Rule-based) ครอบคลุม 3 ด้าน ดังนี้</p>
        <ol class="num-list">
          <li><b>รูปแบบการเรียนรู้ (VARK)</b> ได้แก่ การเห็นภาพ (V) การฟัง (A) การอ่าน-เขียน (R) และการลงมือทำ (K)</li>
          <li><b>ความสนใจด้านอาชีพ (Holland Code / RIASEC)</b> ได้แก่ R I A S E C</li>
          <li><b>กรอบความคิด (Mindset)</b> วัดจากการตอบสนองต่อความผิดพลาดและความท้าทาย รวมถึงพฤติกรรมหลังเล่นมินิเกมไม่สำเร็จ</li>
        </ol>
      </div>

      <!-- 4 -->
      <h2>4. ผลการวิเคราะห์ข้อมูลผู้เรียน</h2>
      <div class="body">
        <p class="sub">4.1 การเข้าร่วมประเมิน</p>
        <table class="data">
          <thead><tr><th>สถานะ</th><th class="c">จำนวน (คน)</th><th class="c">ร้อยละ</th></tr></thead>
          <tbody>
            <tr><td>เล่นครบทุกเควสต์</td><td class="c">{{ s.complete }}</td><td class="c">{{ pct(s.complete, s.enrolled) }}</td></tr>
            <tr><td>เล่นบางส่วน</td><td class="c">{{ s.partial }}</td><td class="c">{{ pct(s.partial, s.enrolled) }}</td></tr>
            <tr><td>ยังไม่ได้เล่น</td><td class="c">{{ s.not_started + s.playing }}</td><td class="c">{{ pct(s.not_started + s.playing, s.enrolled) }}</td></tr>
            <tr class="total"><td>รวม</td><td class="c">{{ s.enrolled }}</td><td class="c">100.0</td></tr>
          </tbody>
        </table>

        <template v-for="block in [
          { title: '4.2 รูปแบบการเรียนรู้ (VARK) — จำแนกตามช่องทางที่ถนัดที่สุด', rows: varkRows },
          { title: '4.3 ความสนใจด้านอาชีพ (RIASEC) — จำแนกตามความสนใจหลัก', rows: riasecRows },
          { title: '4.4 กรอบความคิด (Mindset)', rows: mindsetRows },
        ]" :key="block.title">
          <p class="sub">{{ block.title }}</p>
          <table class="data">
            <thead><tr><th>ด้าน</th><th class="c">จำนวน (คน)</th><th class="c">ร้อยละ</th><th class="bar-col">แผนภูมิ</th></tr></thead>
            <tbody>
              <tr v-for="row in block.rows" :key="row.label">
                <td>{{ row.label }}</td><td class="c">{{ row.n }}</td><td class="c">{{ pct(row.n, n) }}</td>
                <td class="bar-col"><span class="bar keep-bg" :style="{ width: `${pct(row.n, n)}%` }" /></td>
              </tr>
              <tr class="total"><td>รวม</td><td class="c">{{ n }}</td><td class="c">100.0</td><td /></tr>
            </tbody>
          </table>
        </template>

        <p class="sub">4.5 การ์ดตัวละคร (Archetype) ที่ผู้เรียนได้รับ</p>
        <table class="data">
          <thead><tr><th>Archetype</th><th>ความหมาย</th><th class="c">จำนวน (คน)</th><th class="c">ร้อยละ</th></tr></thead>
          <tbody>
            <tr v-for="a in r.distribution.archetype" :key="a.code"><td>{{ a.name }}</td><td>{{ a.title }}</td><td class="c">{{ a.count }}</td><td class="c">{{ pct(a.count, n) }}</td></tr>
          </tbody>
        </table>

        <p class="sub">4.6 สรุปผลการวิเคราะห์</p>
        <ul class="bullets"><li v-for="x in r.guide.summary" :key="x">{{ x }}</li></ul>
      </div>

      <!-- 5 -->
      <h2>5. แนวทางการจัดการเรียนการสอน</h2>
      <div class="body">
        <template v-if="r.ai_course">
          <p class="sub">5.1 ภาพรวมจากการวิเคราะห์ด้วย AI</p>
          <p class="para">{{ r.ai_course.data.overview }}</p>
        </template>
        <p class="sub">{{ r.ai_course ? '5.2' : '5.1' }} สื่อ เครื่องมือ และกิจกรรม (เรียงตามความถนัดของผู้เรียน)</p>
        <table class="data">
          <thead><tr><th>รูปแบบ</th><th class="c">สัดส่วน</th><th>สื่อ/เครื่องมือ</th><th>กิจกรรม</th></tr></thead>
          <tbody>
            <tr v-for="m in r.guide.modalities" :key="m.key">
              <td>{{ m.label }}<br>({{ m.priority }})</td><td class="c">{{ Math.round(m.share) }}%</td>
              <td><div v-for="x in m.media" :key="x">- {{ x }}</div></td>
              <td><div v-for="x in m.activities" :key="x">- {{ x }}</div></td>
            </tr>
          </tbody>
        </table>
        <p class="sub">{{ r.ai_course ? '5.3' : '5.2' }} วิธีสอนที่เหมาะสม</p>
        <ul class="bullets">
          <li v-for="m in r.guide.methods" :key="m.key"><b>{{ m.method }}</b> — {{ m.how }} (ผู้เรียนสาย{{ m.label }} ร้อยละ {{ Math.round(m.share) }})</li>
          <template v-if="r.ai_course">
            <li v-for="st in r.ai_course.data.strategies" :key="st.title"><b>{{ st.title }}</b> — {{ st.detail }}</li>
          </template>
        </ul>
        <template v-if="r.ai_course?.data.misconceptions.length">
          <p class="sub">5.4 ความเข้าใจผิดที่พบบ่อยและแนวทางแก้ไข</p>
          <table class="data">
            <thead><tr><th>หัวข้อ</th><th>ความเข้าใจผิด</th><th>แนวทางแก้ไข</th></tr></thead>
            <tbody><tr v-for="m in r.ai_course.data.misconceptions" :key="m.issue"><td>{{ m.topic }}</td><td>{{ m.issue }}</td><td>{{ m.fix }}</td></tr></tbody>
          </table>
        </template>
        <p class="sub">การส่งเสริมกรอบความคิดแบบเติบโต (Growth Mindset)</p>
        <ul class="bullets">
          <li v-for="x in r.guide.mindset.class" :key="x">{{ x }}</li>
          <li v-for="x in r.guide.mindset.fixed" :key="x">{{ x }} (สำหรับผู้เรียน Fixed Mindset)</li>
          <li v-if="r.ai_course?.data.fixed_mindset">{{ r.ai_course.data.fixed_mindset }}</li>
        </ul>
      </div>

      <!-- 6 -->
      <template v-if="r.guide.units.length">
        <h2>6. แผนกิจกรรมรายหน่วยการเรียน</h2>
        <div class="body">
          <table class="data">
            <thead><tr><th class="c">หน่วย</th><th>หัวข้อ</th><th v-for="a in r.guide.units[0].activities" :key="a.key">{{ a.label }}</th></tr></thead>
            <tbody>
              <tr v-for="u in r.guide.units" :key="u.no"><td class="c">{{ u.no }}</td><td>{{ u.topic }}</td><td v-for="a in u.activities" :key="a.key">{{ a.text }}</td></tr>
            </tbody>
          </table>
          <p v-if="Object.keys(r.ai_units).length" class="para">
            นอกจากนี้ ครูผู้สอนได้ออกแบบแผนการสอนรายหน่วยแบบละเอียดด้วย AI แล้ว {{ Object.keys(r.ai_units).length }} หน่วย ได้แก่ {{ Object.keys(r.ai_units).join(', ') }} (ดูรายละเอียดในไกด์การจัดการเรียนการสอน)
          </p>
        </div>
      </template>

      <!-- 7 -->
      <h2>{{ r.guide.units.length ? 7 : 6 }}. การจัดกลุ่มผู้เรียนและการซ่อมเสริม</h2>
      <div class="body">
        <template v-if="r.grouping">
          <p class="para">
            ครูผู้สอนจัดกลุ่มผู้เรียนแบบ{{ r.grouping.mode === 'mixed' ? 'คละจุดแข็ง สำหรับการทำงานกลุ่ม โดยให้แต่ละกลุ่มมีความสนใจและรูปแบบการเรียนรู้หลากหลาย และกระจายผู้เรียนที่มีกรอบความคิดแบบยึดติดไปอยู่กับเพื่อนที่พร้อมช่วยเหลือ' : 'รวมผู้เรียนที่มีรูปแบบการเรียนรู้เดียวกัน เพื่อการซ่อมเสริมด้วยวิธีที่เหมาะสมกับแต่ละกลุ่ม' }}
            จำนวน {{ r.grouping.groups.length }} กลุ่ม (บันทึกเมื่อ {{ thDate(r.grouping.saved_at) }})
          </p>
          <table class="data">
            <thead><tr><th class="c">กลุ่ม</th><th>สมาชิก (บทบาทที่แนะนำ)</th><th>ความสนใจ</th></tr></thead>
            <tbody>
              <tr v-for="(g, i) in r.grouping.groups" :key="i">
                <td class="c">{{ i + 1 }}</td>
                <td><div v-for="m in g.members" :key="m.id">{{ m.name }} ({{ m.role }})</div></td>
                <td>{{ g.interests.join(' ') || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </template>
        <p v-else class="para">ยังไม่ได้บันทึกการจัดกลุ่มในระบบ</p>
        <p class="sub">แนวทางซ่อมเสริมรายกลุ่ม</p>
        <table class="data">
          <thead><tr><th>กลุ่มผู้เรียน</th><th class="c">จำนวน</th><th>แนวทาง</th></tr></thead>
          <tbody>
            <tr v-for="g in r.guide.groups" :key="g.key"><td>{{ g.title }}</td><td class="c">{{ g.students.length }}</td><td><div v-for="a in g.advice" :key="a">{{ a }}</div></td></tr>
          </tbody>
        </table>
      </div>

      <!-- 8 -->
      <h2>{{ r.guide.units.length ? 8 : 7 }}. การติดตามและประเมินผล</h2>
      <div class="body">
        <ul class="bullets">
          <li v-for="x in r.guide.evaluation" :key="x">{{ x }}</li>
          <template v-if="r.ai_course"><li v-for="x in r.ai_course.data.assessment" :key="x">{{ x }}</li></template>
        </ul>
        <p class="para note">หมายเหตุ: {{ r.guide.caveat }}</p>
      </div>

      <!-- signature -->
      <div class="sign">
        <p>ลงชื่อ ...............................................................</p>
        <p>( {{ r.course.teacher_name }} )</p>
        <p>ครูผู้สอน</p>
        <p>วันที่ ........ เดือน ............................ พ.ศ. ...........</p>
      </div>

      <!-- appendix -->
      <h2 class="appendix-title">ภาคผนวก: ข้อมูลโปรไฟล์ผู้เรียนรายบุคคล</h2>
      <table class="data appendix">
        <thead>
          <tr><th class="c">ที่</th><th>รหัส</th><th>ชื่อ-สกุล</th><th>สถานะ</th><th>Archetype</th><th>Holland</th><th>VARK</th><th>Mindset</th></tr>
        </thead>
        <tbody>
          <tr v-for="(st, i) in profiledStudents" :key="st.id">
            <td class="c">{{ i + 1 }}</td><td>{{ st.student_code }}</td><td>{{ st.full_name }}</td><td>{{ STATUS_TH[st.status] }}</td>
            <template v-if="st.profile">
              <td>{{ st.profile.archetype_name }}</td><td>{{ st.profile.dominant_riasec }}</td><td>{{ st.profile.dominant_vark ?? '-' }}</td><td>{{ ({ growth: 'Growth', mixed: 'Mixed', fixed: 'Fixed' } as Record<string, string>)[st.profile.mindset_type] }}</td>
            </template>
            <td v-else colspan="4">-</td>
          </tr>
        </tbody>
      </table>
    </article>
  </div>
</template>

<style scoped>
/* On screen: a sheet of paper that previews the printed document */
.paper {
  max-width: 210mm;
  margin: 0 auto;
  padding: 18mm 16mm;
  background: #fff;
  color: #1a1a1a;
  font-family: 'THSarabunPSK', 'TH SarabunPSK', sans-serif;
  font-size: 16pt;
  line-height: 1.32;
  border-radius: 6px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.paper :deep(*) {
  font-family: inherit;
}
.paper h1 { font-size: 18pt; font-weight: 700; line-height: 1.3; }
.paper h2 { font-size: 18pt; font-weight: 700; margin: 8mm 0 2mm; padding-bottom: 1mm; border-bottom: 1.5pt solid #333; break-after: avoid; }
.body { margin-left: 10mm; }
.sub { font-weight: 700; margin: 3mm 0 1mm; break-after: avoid; }
.para { text-indent: 12mm; text-align: justify; margin: 1mm 0; }
.note { color: #555; }
.bullets { margin: 1mm 0 1mm 6mm; }
.bullets li { padding-left: 5mm; text-indent: -5mm; }
.bullets li::before { content: '• '; }
.num-list { list-style: decimal; margin: 1mm 0 1mm 12mm; }
table { width: 100%; border-collapse: collapse; margin: 1.5mm 0 3mm; }
th, td { border: 0.75pt solid #999; padding: 1mm 2mm; vertical-align: top; text-align: left; }
th { font-weight: 700; background: #f2f2f2; }
td.c, th.c { text-align: center; white-space: nowrap; }
tr.total td { font-weight: 700; }
.kv th { width: 45mm; }
.bar-col { width: 32%; }
.bar { display: inline-block; height: 3.5mm; background: #555; vertical-align: middle; min-width: 0.5mm; }
.appendix th, .appendix td { padding: 0.6mm 1.5mm; }
.cover { min-height: 245mm; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 1.5mm; }
.cover-inst { font-size: 18pt; font-weight: 700; margin-top: 10mm; }
.cover-title { margin: 45mm 0 20mm; }
.cover-by { margin-top: auto; margin-bottom: 20mm; }
.cover-foot { color: #666; }
.sign { margin: 14mm 0 0 auto; width: 90mm; text-align: center; break-inside: avoid; }
.sign p { margin: 1.5mm 0; }
.appendix-title { break-before: page; }
.cover { break-after: page; }

@media print {
  .paper { max-width: none; padding: 0; box-shadow: none; border-radius: 0; }
  .paper .cover-inst { font-size: 18pt !important; font-weight: 700 !important; }
  .paper .sub, .paper .sub * { font-weight: 700 !important; }
  .paper th.c, .paper td.c { text-align: center !important; }
  .paper th { background: #f2f2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paper .keep-bg { background: #555 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paper .body { margin-left: 10mm !important; width: auto !important; }
}
</style>
