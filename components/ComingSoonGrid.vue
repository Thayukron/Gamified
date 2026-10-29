<script setup lang="ts">
// Features not built yet, shown as "sealed" quest cards awaiting their phase.
defineProps<{ items: { icon: string; title: string; desc: string; phase: number }[] }>()
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div
      v-for="(it, i) in items"
      :key="it.title"
      class="card card-hover group animate-fade-up overflow-hidden"
      :style="{ animationDelay: `${150 + i * 90}ms` }"
    >
      <!-- corner filigree -->
      <span class="absolute left-2 top-2 h-4 w-4 border-l border-t border-rune-400/40" />
      <span class="absolute bottom-2 right-2 h-4 w-4 border-b border-r border-rune-400/40" />
      <!-- hover aura -->
      <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-arcane-500/0 blur-2xl transition duration-700 group-hover:bg-arcane-500/30" />

      <div class="relative flex gap-4">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rune-400/30 bg-abyss-900/80 text-rune-300 shadow-glow transition duration-500 group-hover:rotate-6 group-hover:scale-110">
          <AppIcon :name="it.icon" />
        </div>
        <div class="min-w-0">
          <div class="font-medium text-slate-100">{{ it.title }}</div>
          <p class="mt-1 text-sm leading-relaxed text-slate-400">{{ it.desc }}</p>
          <span class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-arcane-400/30 bg-arcane-500/10 px-2.5 py-0.5 text-xs text-arcane-300">
            <AppIcon name="lock" :size="12" />
            ผนึกไว้ · ปลดผนึกในเฟส {{ it.phase }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
