/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`

export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Kanit', 'system-ui', 'sans-serif'],
        // Cinzel renders Latin glyphs, Chonburi picks up Thai
        display: ['Cinzel', 'Chonburi', 'serif'],
      },
      // Every colour is a CSS variable (assets/css/main.css): :root = ARCANA fantasy for learners,
      // html.theme-staff = the formal light theme for teachers/admins. Same class names, two looks.
      colors: {
        abyss: { 950: v("abyss-950"), 900: v("abyss-900"), 800: v("abyss-800"), 700: v("abyss-700"), 600: v("abyss-600") },
        arcane: { 300: v("arcane-300"), 400: v("arcane-400"), 500: v("arcane-500"), 600: v("arcane-600") },
        rune: { 100: v("rune-100"), 200: v("rune-200"), 300: v("rune-300"), 400: v("rune-400"), 500: v("rune-500"), 600: v("rune-600") },
        slate: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((k) => [k, v(`slate-${k}`)])),
        white: v("white"),
        // always-real white (in the staff theme "white" is a faint-overlay tint, not #fff)
        snow: "#ffffff",
        red: { 100: v("red-100"), 200: v("red-200"), 300: v("red-300") },
        emerald: { 100: v("emerald-100"), 200: v("emerald-200"), 300: v("emerald-300") },
        sky: { 100: v("sky-100"), 200: v("sky-200"), 300: v("sky-300") },
        amber: { 100: v("amber-100"), 200: v("amber-200"), 300: v("amber-300") },
        ember: "#ff7a45",
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(167, 139, 250, 0.55)',
        'glow-gold': '0 0 28px -6px rgba(245, 196, 81, 0.7)',
      },
      keyframes: {
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'spin-rev': { to: { transform: 'rotate(-360deg)' } },
        twinkle: { '0%,100%': { opacity: '0.15' }, '50%': { opacity: '1' } },
        rise: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0' },
          '10%': { opacity: '0.9' },
          '100%': { transform: 'translateY(-110vh) scale(0.4)', opacity: '0' },
        },
        drift: {
          '0%': { transform: 'translateX(-10%)' },
          '100%': { transform: 'translateX(10%)' },
        },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-8px)' },
          '40%,80%': { transform: 'translateX(8px)' },
        },
        pulseglow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(245,196,81,0.0)' },
          '50%': { boxShadow: '0 0 32px 2px rgba(245,196,81,0.35)' },
        },
      },
      animation: {
        'spin-slow': 'spin-slow 60s linear infinite',
        'spin-rev': 'spin-rev 90s linear infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        rise: 'rise 12s linear infinite',
        drift: 'drift 30s ease-in-out infinite alternate',
        float: 'float 5s ease-in-out infinite',
        shimmer: 'shimmer 3s linear infinite',
        'fade-up': 'fade-up 0.8s cubic-bezier(.2,.7,.2,1) both',
        shake: 'shake 0.4s ease-in-out',
        pulseglow: 'pulseglow 3s ease-in-out infinite',
      },
    },
  },
}
