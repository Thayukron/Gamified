<script setup lang="ts">
const api = useApi()
const data = ref<any>(null)
const centralKey = ref('')
const busy = ref(false)
const msg = ref<{ ok: boolean; text: string } | null>(null)

onMounted(async () => {
  data.value = await api('/admin/ai')
})

async function save(body: Record<string, unknown>, okText: string) {
  busy.value = true
  msg.value = null
  try {
    data.value = await api('/admin/ai', { method: 'PUT', body })
    msg.value = { ok: true, text: okText }
    centralKey.value = ''
  } catch (e) {
    msg.value = { ok: false, text: apiErrorMessage(e) }
  } finally {
    busy.value = false
  }
}

async function allow(t: any, value: boolean) {
  data.value = await api(`/admin/ai/teachers/${t.id}`, { method: 'PUT', body: { central_allowed: value } })
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <NuxtLink to="/admin" class="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-rune-300"><AppIcon name="back" :size="16" /> หอคอยผู้คุมระบบ</NuxtLink>
    <div>
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300/80">AI CONTROL</p>
      <h1 class="title-glow mt-1 text-2xl sm:text-3xl">ตั้งค่า AI ของระบบ</h1>
      <p class="mt-1 text-sm text-slate-400">ครูแต่ละคนใช้ API Key ของตนเอง (BYOK) — ระบบกลางไม่เสียโทเคน เว้นแต่คุณอนุญาตให้ครูบางคนใช้ Key กลาง</p>
    </div>

    <p v-if="!data" class="text-slate-500">กำลังโหลด...</p>
    <template v-else>
      <p v-if="msg" class="rounded-xl px-3 py-2 text-sm" :class="msg.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'">{{ msg.text }}</p>

      <section class="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-medium text-slate-50">ฟังก์ชัน AI ทั้งระบบ</h2>
          <p class="text-sm text-slate-400">ปิดแล้วครูทุกคนจะใช้ได้เฉพาะไกด์แบบกฎ (ระบบยังทำงานปกติ)</p>
        </div>
        <button
          class="btn !px-6"
          :class="data.enabled ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/50' : 'bg-white/5 text-slate-300 ring-1 ring-white/20'"
          :disabled="busy"
          @click="save({ enabled: !data.enabled }, data.enabled ? 'ปิดการใช้งาน AI แล้ว' : 'เปิดการใช้งาน AI แล้ว')"
        >
          {{ data.enabled ? '● เปิดอยู่' : '○ ปิดอยู่' }}
        </button>
      </section>

      <section class="card">
        <h2 class="text-lg font-medium text-slate-50">Key กลางของวิทยาลัย (ไม่บังคับ)</h2>
        <p class="text-sm text-slate-400">ใช้เฉพาะครูที่คุณอนุญาตด้านล่าง และเฉพาะเมื่อครูคนนั้นไม่มี Key ของตนเอง</p>
        <p class="mt-3 text-sm text-slate-200">
          สถานะ: <span class="font-mono">{{ data.central.has_key ? `${data.central.key_hint} · ${data.central.model}` : 'ยังไม่ได้ตั้ง' }}</span>
        </p>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <input v-model="centralKey" type="password" class="input font-mono" placeholder="วาง API Key ที่นี่ (ขึ้นต้นด้วย AQ. หรือ AIza)" autocomplete="off">
          <button class="btn-primary shrink-0" :disabled="busy || centralKey.length < 20" @click="save({ central_key: centralKey }, 'ตรวจสอบและบันทึก Key กลางแล้ว')">ตรวจสอบและบันทึก</button>
          <button v-if="data.central.has_key" class="btn-ghost shrink-0 !text-red-300" :disabled="busy" @click="save({ central_key: '' }, 'ลบ Key กลางแล้ว')">ลบ</button>
        </div>
      </section>

      <section class="card !p-0">
        <div class="p-5">
          <h2 class="text-lg font-medium text-slate-50">ครูผู้สอนและการใช้งาน AI</h2>
          <p class="text-sm text-slate-400">“โทเคนจาก Key กลาง” = ปริมาณที่ระบบกลางจ่ายแทนครูคนนั้น</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[640px] text-sm">
            <thead class="text-left text-xs text-slate-400">
              <tr class="border-y border-white/10">
                <th class="px-5 py-3">ครู</th><th class="px-3 py-3">แผนก</th><th class="px-3 py-3">Key ของตนเอง</th>
                <th class="px-3 py-3">จำนวนคำขอ AI</th><th class="px-3 py-3">โทเคนจาก Key กลาง</th><th class="px-3 py-3">อนุญาตใช้ Key กลาง</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in data.teachers" :key="t.id" class="border-b border-white/5">
                <td class="px-5 py-3 text-slate-100">{{ t.full_name }}<br><span class="text-xs text-slate-500">{{ t.username }}</span></td>
                <td class="px-3 py-3 text-slate-300">{{ t.department_name }}</td>
                <td class="px-3 py-3 font-mono text-slate-300">{{ t.has_own_key ? t.key_hint : '-' }}</td>
                <td class="px-3 py-3 tabular-nums text-slate-300">{{ t.ai_requests }}</td>
                <td class="px-3 py-3 tabular-nums text-slate-300">{{ Number(t.central_tokens).toLocaleString() }}</td>
                <td class="px-3 py-3">
                  <label class="inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" class="h-4 w-4 accent-amber-400" :checked="!!Number(t.central_allowed)" @change="allow(t, ($event.target as HTMLInputElement).checked)">
                    <span class="text-xs text-slate-400">{{ Number(t.central_allowed) ? 'อนุญาต' : 'ไม่อนุญาต' }}</span>
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
