import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        border: 'var(--border)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        free: 'var(--free)',
        soon: 'var(--soon)',
        busy: 'var(--busy)',
        brand: 'var(--brand)',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        sans: ['var(--font-sans)', 'Inter', 'Geist', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '440px',
      },
      transitionDuration: {
        150: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
