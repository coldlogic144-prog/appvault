import type { Config } from 'tailwindcss';

export default {
  content: [
    './renderer/index.html',
    './renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: 'var(--color-navy)',
        ink: 'var(--color-ink)',
        panel: 'var(--color-panel)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'accent-red': 'var(--color-accent-red)',
        'accent-blue': 'var(--color-accent-blue)',
        'accent-yellow': 'var(--color-accent-yellow)',
        border: 'var(--color-border)',
      },
    },
  },
  plugins: [],
} satisfies Config;
