<script setup lang="ts">
// "How to play" guide shown before a player's first quest and from the ? button in the HUD.
const emit = defineEmits<{ close: [] }>()

const steps = [
  { icon: 'hand', title: 'แตะเพื่ออ่านต่อ', desc: 'แตะที่ไหนก็ได้บนจอ (หรือกด Space) เพื่อไปบรรทัดถัดไป · ปุ่ม ⏩ เล่นอัตโนมัติ' },
  { icon: 'card', title: 'เลือกเส้นทางของคุณ', desc: 'แตะการ์ดหรือปุ่มที่ตรงกับตัวคุณที่สุด — ไม่มีคำตอบถูกหรือผิด ตอบตามใจได้เลย' },
  { icon: 'eye', title: 'แตะสิ่งของในฉาก', desc: 'เมื่อมีวงแหวนเรืองแสงกะพริบ ให้แตะสิ่งที่คุณสนใจที่สุดในฉาก' },
  { icon: 'clock', title: 'เหตุด่วน! จับเวลา', desc: 'ขอบจอกะพริบแดง = ต้องรีบเลือกก่อนเวลาหมด ถ้าหมดเวลาระบบจะเลือกให้' },
  { icon: 'bolt', title: 'มินิเกม', desc: 'จะมีกติกาบอกก่อนทุกครั้ง แล้วกด “เริ่มเลย” เมื่อพร้อม · พลาดก็เล่นต่อได้ไม่มีตกรอบ' },
  { icon: 'star', title: 'สะสมรางวัล', desc: 'ทุกการตัดสินใจได้ XP · ได้ไอเทมเก็บในกระเป๋า 🎒 · จบเควสต์รับการ์ดตัวละครของคุณ' },
]
</script>

<template>
  <div class="absolute inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-abyss-950/90 p-4 backdrop-blur-sm" @click.self="emit('close')">
    <div class="card my-auto w-full max-w-lg animate-fade-up border-rune-400/40">
      <p class="font-display text-xs tracking-[0.4em] text-arcane-300">HOW TO PLAY</p>
      <h2 class="title-glow mt-1 text-2xl">วิธีเล่น</h2>
      <ol class="mt-4 space-y-3">
        <li v-for="(s, i) in steps" :key="s.title" class="flex animate-fade-up gap-3" :style="{ animationDelay: `${i * 70}ms` }">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rune-400/50 bg-abyss-950 text-rune-300">
            <AppIcon :name="s.icon" :size="20" />
          </span>
          <div>
            <p class="font-medium text-slate-100">{{ i + 1 }}. {{ s.title }}</p>
            <p class="text-sm leading-snug text-slate-400">{{ s.desc }}</p>
          </div>
        </li>
      </ol>
      <button class="btn-primary mt-5 w-full !py-3 text-base" @click="emit('close')">
        <AppIcon name="play" :size="18" /> เข้าใจแล้ว ไปกันเลย!
      </button>
    </div>
  </div>
</template>
