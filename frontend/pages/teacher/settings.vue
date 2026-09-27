<script setup lang="ts">
const api = useApi()
const ai = ref<any>(null)
const models = ref<string[]>([])
const keyInput = ref('')
const busy = ref(false)
const msg = ref<{ ok: boolean; text: string } | null>(null)

async function load() {
  ai.value = (await api('/me/ai')).ai
}
onMounted(load)

async function run(fn: () => Promise<void>) {
  busy.value = true
  msg.value = null
  try {
    await fn()
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}

const saveKey = () =>
  run(async () => {
    const res = await api('/me/ai', { method: 'PUT', body: { api_key: keyInput.value } })
    ai.value = res.ai
    models.value = res.models
    keyInput.value = ''
    msg.value = { ok: true, text: `เชื่อมต่อสำเร็จ · ใช้รุ่น ${res.ai.model}` }
  })

const testKey = () =>
  run(async () => {
    const res = await api('/me/ai/test', { method: 'POST' })
    models.value = res.models
    msg.value = { ok: true, text: `เชื่อมต่อได้ปกติ · มีรุ่นที่ใช้ได้ ${res.models.length} รุ่น` }
  })

const setModel = (m: string) =>
  run(async () => {
    ai.value = (await api('/me/ai/model', { method: 'PUT', body: { model: m } })).ai
    msg.value = { ok: true, text: `เปลี่ยนเป็นรุ่น ${m} แล้ว` }
  })

const removeKey = () =>
  run(async () => {
    if (!confirm('ลบ API Key ออกจากระบบ? (ไกด์แบบกฎยังใช้ได้ตามปกติ)')) return
    ai.value = (await api('/me/ai', { method: 'DELETE' })).ai
    models.value = []
    msg.value = { ok: true, text: 'ลบ API Key แล้ว' }
  })

const fmt = (s?: string) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-')
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <NuxtLink to="/teacher" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> หน้าหลักครู</NuxtLink>
    <div>
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">AI SETTINGS</p>
      <h1 class="title-glow mt-1 text-2xl sm:text-3xl">ตั้งค่า AI ของฉัน</h1>
      <p class="mt-1 text-sm text-slate-400">ใช้ API Key ของ Gemini ของคุณเอง เพื่อให้ AI ช่วยขยายไกด์การสอนและออกแบบแผนรายหน่วย</p>
    </div>

    <p v-if="!ai" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <p v-if="!ai.enabled" class="card border-amber-400/40 text-amber-200">ผู้ดูแลระบบปิดการใช้งานฟังก์ชัน AI อยู่ในขณะนี้ — ไกด์แบบกฎยังใช้ได้ตามปกติ</p>

      <!-- status -->
      <section class="card">
        <h2 class="text-lg font-medium text-slate-50">สถานะ</h2>
        <div class="mt-3 grid gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-white/10 p-3">
            <p class="text-xs text-slate-400">API Key ของฉัน</p>
            <p class="mt-1 font-mono text-slate-100">{{ ai.has_own_key ? ai.key_hint : 'ยังไม่ได้กรอก' }}</p>
          </div>
          <div class="rounded-xl border border-white/10 p-3">
            <p class="text-xs text-slate-400">รุ่นที่ใช้</p>
            <p class="mt-1 text-slate-100">{{ ai.model ?? '-' }}</p>
          </div>
          <div class="rounded-xl border border-white/10 p-3">
            <p class="text-xs text-slate-400">ตรวจสอบล่าสุด</p>
            <p class="mt-1 text-slate-100">{{ fmt(ai.verified_at) }}</p>
          </div>
        </div>
        <p v-if="!ai.has_own_key && ai.central_allowed" class="mt-3 text-sm text-sky-300">ผู้ดูแลระบบอนุญาตให้คุณใช้ Key กลางของวิทยาลัยได้ (หากกรอก Key ของตนเอง ระบบจะใช้ของคุณก่อน)</p>

        <div v-if="ai.has_own_key" class="mt-4 flex flex-wrap items-center gap-2">
          <button class="btn-ghost !py-2 text-sm" :disabled="busy" @click="testKey">ทดสอบการเชื่อมต่อ</button>
          <select v-if="models.length" class="input !w-auto !py-2 text-sm" :value="ai.model" :disabled="busy" @change="setModel(($event.target as HTMLSelectElement).value)">
            <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
          </select>
          <button class="btn-ghost !border-red-400/40 !py-2 text-sm !text-red-300" :disabled="busy" @click="removeKey">ลบ API Key</button>
        </div>
      </section>

      <!-- enter key -->
      <section class="card">
        <h2 class="text-lg font-medium text-slate-50">{{ ai.has_own_key ? 'เปลี่ยน API Key' : 'กรอก API Key' }}</h2>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <input v-model="keyInput" type="password" class="input font-mono" placeholder="AIza..." autocomplete="off">
          <button class="btn-primary shrink-0" :disabled="busy || keyInput.length < 20" @click="saveKey">
            {{ busy ? 'กำลังตรวจสอบ...' : 'ตรวจสอบและบันทึก' }}
          </button>
        </div>
        <p v-if="msg" class="mt-3 rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'">{{ msg.text }}</p>
        <p class="mt-3 text-xs text-slate-500">🔒 Key ถูกเข้ารหัสก่อนเก็บ และจะไม่แสดงกลับมาในหน้าเว็บ · ระบบส่งให้ AI เฉพาะสถิติรวมของห้องและข้อมูลรายวิชา ไม่มีชื่อหรือรหัสนักเรียน</p>
      </section>

      <!-- how to -->
      <section class="card">
        <h2 class="text-lg font-medium text-slate-50">วิธีขอ API Key ของ Gemini (ฟรี)</h2>
        <ol class="mt-3 space-y-2 text-sm text-slate-200">
          <li><b class="text-rune-300">1.</b> เข้า <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-sky-300 underline">aistudio.google.com/apikey</a> แล้วล็อกอินด้วยบัญชี Google</li>
          <li><b class="text-rune-300">2.</b> กด <b>Create API key</b> แล้วคัดลอก Key ที่ขึ้นต้นด้วย <code class="rounded bg-white/10 px-1">AIza</code></li>
          <li><b class="text-rune-300">3.</b> นำมาวางในช่องด้านบน แล้วกด “ตรวจสอบและบันทึก”</li>
        </ol>
        <ul class="mt-4 space-y-1 text-xs text-slate-400">
          <li>• Key แบบฟรีมีโควตาจำกัดต่อนาที/ต่อวัน — ระบบเรียก AI เฉพาะตอนคุณกดปุ่ม และจำผลไว้ใช้ซ้ำ จึงใช้โควตาน้อยมาก</li>
          <li>• ถ้าโควตาหมดหรือ AI ใช้ไม่ได้ ไกด์แบบกฎยังทำงานตามปกติ</li>
          <li>• ห้ามแชร์ Key ให้ผู้อื่น หากสงสัยว่ารั่วไหล ให้ลบ Key ใน AI Studio แล้วสร้างใหม่</li>
        </ul>
      </section>
    </template>
  </div>
</template>
