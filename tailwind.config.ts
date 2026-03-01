import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Ink & Gold Palette - Eastern Minimalist Mysticism
        ink: 'var(--ink)',
        'bg-ink': 'var(--ink)',
        silk: 'var(--silk)',
        'text-silk': 'var(--silk)',
        gold: 'var(--gold)',
        'border-gold': 'var(--gold)',
        cinnabar: 'var(--cinnabar)',
        'accent-cinnabar': 'var(--cinnabar)',
        panel: 'var(--panel)',
        'bg-panel': 'var(--panel)',
      },
      borderRadius: {
        // Extended border radius for circular elements
        'pill': '9999px',
      },
      fontFamily: {
        // Majestic Serif for headings
        serif: ['Cinzel', 'Noto Serif Display', 'serif'],
        // Clean geometric Sans for body
        sans: ['Inter', 'Geist', 'sans-serif'],
      },
      animation: {
        'spin-fast': 'spin 15s linear infinite',
        'spin-medium': 'spin 10s linear infinite',
        'spin-slow': 'spin 30s linear infinite',
        'spin-slower': 'spin 60s linear infinite',
        'heartbeat': 'heartbeat 1.5s ease-in-out infinite',
        'seal-break': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) 3',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': {
            opacity: '0.4',
            transform: 'scale(1)',
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.05)',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
