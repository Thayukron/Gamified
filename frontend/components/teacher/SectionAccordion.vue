<script setup lang="ts">
// Collapsible list of form sections: one line per section (number, title, filled ✓ / empty ○, preview);
// click to open and edit. Keeps long forms readable.
interface AccField { path: string[]; label?: string; hint?: string; rows?: number }
interface AccSection { id: string; title: string; hint?: string; badge?: string; fields: AccField[]; summary?: string }

const props = defineProps<{ sections: AccSection[] }>()
const content = defineModel<Record<string, any>>({ required: true })
const open = ref<Set<string>>(new Set())

const get = (path: string[]) => path.reduce((o: any, k) => o?.[k], content.value) ?? ''
const set = (path: string[], v: string) => {
  const last = path[path.length - 1]
  const parent = path.slice(0, -1).reduce((o: any, k) => o[k], content.value)
  parent[last] = v
}
const filledCount = (s: AccSection) => s.fields.filter((f) => String(get(f.path)).trim()).length
const preview = (s: AccSection) => {
  if (s.summary !== undefined) return s.summary
  for (const f of s.fields) {
    const line = String(get(f.path)).split('\n').find((l) => l.trim())
    if (line) return (f.label && s.fields.length > 1 ? `${f.label}: ` : '') + line
  }
  return 'ยังไม่ได้กรอก'
}
function toggle(id: string) {
  const n = new Set(open.value)
  n.has(id) ? n.delete(id) : n.add(id)
  open.value = n
}
const allOpen = computed(() => open.value.size === props.sections.length)
function toggleAll() {
  open.value = allOpen.value ? new Set() : new Set(props.sections.map((s) => s.id))
}
defineExpose({ openAll: () => (open.value = new Set(props.sections.map((s) => s.id))) })
</script>

<template>
  <div class="space-y-2">
    <div class="flex justify-end">
      <button type="button" class="text-xs text-slate-400 hover:text-slate-200" data-testid="acc-toggle-all" @click="toggleAll">{{ allOpen ? 'พับทั้งหมด' : 'เปิดทั้งหมด' }}</button>
    </div>
    <div v-for="s in sections" :key="s.id" class="overflow-hidden rounded-xl ring-1 transition" :class="open.has(s.id) ? 'bg-white/[0.04] ring-rune-400/40' : 'ring-white/10 hover:ring-white/25'" :data-testid="`acc-${s.id}`">
      <button type="button" class="flex w-full items-center gap-3 px-4 py-3 text-left" @click="toggle(s.id)">
        <span
          class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs"
          :class="!s.fields.length ? 'bg-white/10 text-slate-400' : filledCount(s) === s.fields.length ? 'bg-emerald-500/20 text-emerald-300' : filledCount(s) ? 'bg-rune-400/20 text-rune-200' : 'bg-white/10 text-slate-500'"
        >{{ !s.fields.length ? '•' : filledCount(s) === s.fields.length ? '✓' : filledCount(s) ? '…' : '○' }}</span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="font-medium text-slate-100">{{ s.title }}</span>
            <span v-if="s.badge" class="rounded-full bg-sky-500/15 px-2 text-[11px] text-sky-300">{{ s.badge }}</span>
          </span>
          <span v-if="!open.has(s.id)" class="block truncate text-xs" :class="filledCount(s) ? 'text-slate-400' : 'text-slate-600'">{{ preview(s) }}</span>
        </span>
        <AppIcon name="back" :size="14" class="shrink-0 text-slate-500 transition" :class="open.has(s.id) ? 'rotate-90' : '-rotate-90'" />
      </button>
      <div v-if="open.has(s.id)" class="space-y-3 px-4 pb-4">
        <p v-if="s.hint" class="text-xs text-slate-500">{{ s.hint }}</p>
        <div v-for="f in s.fields" :key="f.path.join('.')">
          <p v-if="f.label" class="label">{{ f.label }}<span v-if="f.hint" class="ml-2 normal-case tracking-normal text-slate-500">— {{ f.hint }}</span></p>
          <textarea :value="get(f.path)" :rows="f.rows ?? 3" class="input leading-relaxed" @input="set(f.path, ($event.target as HTMLTextAreaElement).value)" />
        </div>
        <slot :name="s.id" />
      </div>
    </div>
  </div>
</template>
