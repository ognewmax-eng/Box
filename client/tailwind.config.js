/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          dark: '#0a0a0f',
          'dark-lighter': '#1a1a2e',
          purple: '#a855f7',
          'purple-deep': '#7c3aed',
          cyan: '#22d3ee',
          yellow: '#fbbf24',
        },
        party: {
          dark: '#0a0a0f',
          purple: '#a855f7',
          neon: '#a855f7',
          pink: '#a855f7',
          cyan: '#22d3ee',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      boxShadow: {
        'nexus-purple': '0 0 40px rgba(168, 85, 247, 0.4)',
        'nexus-cyan': '0 0 40px rgba(34, 211, 238, 0.4)',
        'nexus-yellow': '0 0 40px rgba(251, 191, 36, 0.4)',
      },
    },
  },
  plugins: [],
};
