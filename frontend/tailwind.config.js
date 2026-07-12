/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          bg: '#0f1419',
          panel: '#1a2332',
          border: '#2a3a4d',
          muted: '#8b9cb3',
          healthy: '#22c55e',
          warning: '#eab308',
          critical: '#ef4444',
          offline: '#6b7280',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 3px rgba(0,0,0,0.35)',
      },
    },
  },
  plugins: [],
};
