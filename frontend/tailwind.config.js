/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Kanit', 'system-ui', 'sans-serif'],
        // Cinzel renders Latin glyphs, Chonburi picks up Thai
        display: ['Cinzel', 'Chonburi', 'serif'],
      },
      colors: {
        abyss: {
          950: '#05030d',
          900: '#0b0718',
          800: '#140d2b',
          700: '#1f1542',
          600: '#2d1f5e',
        },
        arcane: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        rune: {
          200: '#fde68a',
          300: '#fcd34d',
          400: '#f5c451',
          500: '#e0a82e',
          600: '#b7791f',
        },
        ember: '#ff7a45',
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
