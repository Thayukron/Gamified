<script setup lang="ts">
// Editable table of fixed-shape rows (analysis tables of the lesson-plan book).
export interface RowColumn { key: string; label: string; width?: string; multiline?: boolean; placeholder?: string }

const props = defineProps<{ columns: RowColumn[]; addLabel?: string; testid?: string }>()
const rows = defineModel<Record<string, string>[]>({ required: true })

function add() {
  const last = rows.value[rows.value.length - 1]
  // a new row continues the same duty / group so merged cells stay together
  rows.value.push(Object.fromEntries(props.columns.map((c) => [c.key, c.key === 'duty' && last ? last.duty : ''])))
}
function remove(i: number) {
  rows.value.splice(i, 1)
}
function move(i: number, d: number) {
  const j = i + d
  if (j < 0 || j >= rows.value.length) return
  const [r] = rows.value.splice(i, 1)
  rows.value.splice(j, 0, r)
}
</script>

<template>
  <div class="space-y-2">
    <div class="overflow-x-auto rounded-xl ring-1 ring-white/10">
      <table class="w-full min-w-[640px] text-sm" :data-testid="testid">
        <thead class="bg-white/5 text-left text-xs text-slate-400">
          <tr>
            <th v-for="c in columns" :key="c.key" class="px-2 py-2 font-medium" :style="{ width: c.width }">{{ c.label }}</th>
            <th class="w-20" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="i" class="border-t border-white/5 align-top">
            <td v-for="c in columns" :key="c.key" class="p-1">
              <textarea v-if="c.multiline" v-model="r[c.key]" rows="2" class="input !px-2 !py-1 text-sm leading-snug" :placeholder="c.placeholder" />
              <input v-else v-model="r[c.key]" class="input !px-2 !py-1 text-sm" :placeholder="c.placeholder">
            </td>
            <td class="whitespace-nowrap p-1 text-right text-xs">
              <button class="px-1 text-slate-500 hover:text-slate-200" title="เลื่อนขึ้น" @click="move(i, -1)">▲</button>
              <button class="px-1 text-slate-500 hover:text-slate-200" title="เลื่อนลง" @click="move(i, 1)">▼</button>
              <button class="px-1 text-red-300/70 hover:text-red-300" title="ลบแถว" @click="remove(i)">✕</button>
            </td>
          </tr>
          <tr v-if="!rows.length"><td :colspan="columns.length + 1" class="px-3 py-4 text-center text-xs text-slate-500">ยังไม่มีข้อมูล</td></tr>
        </tbody>
      </table>
    </div>
    <button type="button" class="text-sm text-rune-300 hover:text-rune-200" @click="add">+ {{ addLabel ?? 'เพิ่มแถว' }}</button>
  </div>
</template>
