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
        'page-bg': 'var(--page-bg)',
        'board-case': 'var(--board-case)',
        'cell-bg': 'var(--cell-bg)',
        'cell-ink': 'var(--cell-ink)',
        muted: 'var(--muted)',
        hairline: 'var(--hairline)',
        signal: 'var(--signal)',
        unlit: 'var(--unlit)',
        brand: 'var(--brand)',
        // Compatibility aliases
        ink: 'var(--page-bg)',
        surface: 'var(--cell-bg)',
        'surface-2': 'var(--board-case)',
        border: 'var(--hairline)',
        text: 'var(--cell-ink)',
        free: 'var(--signal)',
        soon: 'var(--signal)',
        busy: 'var(--unlit)',
      },
      fontFamily: {
        mono: ['var(--font-departure-mono)', 'Departure Mono', 'monospace'],
        sans: ['var(--font-plex-sans)', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '480px',
        desktop: '1440px',
      },
      transitionDuration: {
        150: '150ms',
        200: '200ms',
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
      },
    },
  },
  plugins: [],
};

export default config;

