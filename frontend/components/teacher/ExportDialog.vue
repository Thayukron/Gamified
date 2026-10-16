<script setup lang="ts">
// Pick what goes into the Word file before exporting. Groups of checkboxes; all ticked by default.
import type { ExportGroup } from '~/utils/lessonPlan'

const props = defineProps<{ title: string; groups: ExportGroup[]; busy?: boolean }>()
const emit = defineEmits<{ close: []; export: [keys: string[]] }>()
const groups = ref<ExportGroup[]>(JSON.parse(JSON.stringify(props.groups)))

const selected = computed(() => groups.value.flatMap((g) => g.items.filter((i) => i.checked && !i.disabled).map((i) => i.key)))
function setGroup(g: ExportGroup, v: boolean) {
  g.items.forEach((i) => !i.disabled && (i.checked = v))
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="emit('close')">
    <div class="card flex max-h-[85vh] w-full max-w-lg flex-col !p-0" data-testid="export-dialog">
      <div class="border-b border-white/10 px-5 py-4">
        <h2 class="text-lg font-medium text-slate-50">{{ title }}</h2>
        <p class="text-sm text-slate-400">เลือกสิ่งที่ต้องการให้อยู่ในไฟล์ Word (รวมเป็นไฟล์เดียว เรียงตามแบบฟอร์ม)</p>
      </div>
      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div v-for="g in groups" :key="g.title">
          <div class="mb-1 flex items-center justify-between">
            <p class="text-sm font-medium text-rune-200">{{ g.title }}</p>
            <span class="space-x-2 text-xs">
              <button class="text-slate-400 hover:text-slate-200" @click="setGroup(g, true)">เลือกทั้งหมด</button>
              <button class="text-slate-400 hover:text-slate-200" @click="setGroup(g, false)">ไม่เลือก</button>
            </span>
          </div>
          <label
            v-for="i in g.items"
            :key="i.key"
            class="flex items-start gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
            :class="i.disabled ? 'opacity-40' : 'cursor-pointer'"
          >
            <input v-model="i.checked" type="checkbox" class="mt-1" :disabled="i.disabled" :data-testid="`ex-${i.key}`">
            <span>
              <span class="text-slate-100">{{ i.label }}</span>
              <span v-if="i.hint" class="block text-xs text-slate-500">{{ i.hint }}</span>
            </span>
          </label>
        </div>
      </div>
      <div class="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3">
        <span class="text-xs text-slate-400">เลือก {{ selected.length }} รายการ</span>
        <div class="flex gap-2">
          <button class="btn-ghost !py-2 text-sm" @click="emit('close')">ยกเลิก</button>
          <button class="btn-primary !py-2 text-sm" :disabled="busy || !selected.length" data-testid="ex-go" @click="emit('export', selected)">
            <AppIcon name="download" :size="16" /> {{ busy ? 'กำลังสร้างไฟล์…' : 'ดาวน์โหลด Word' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
