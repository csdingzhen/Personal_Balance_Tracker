/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      colors: {
        bg:           'oklch(0.155 0.006 60)',
        'bg-deep':    'oklch(0.125 0.005 60)',
        surface:      'oklch(0.195 0.005 60)',
        'surface-2':  'oklch(0.225 0.005 60)',
        'surface-hi': 'oklch(0.26 0.006 60)',
        border: {
          DEFAULT: 'oklch(0.27 0.006 60)',
          soft:    'oklch(0.235 0.006 60)',
          hi:      'oklch(0.36 0.008 60)',
        },
        text: {
          DEFAULT: 'oklch(0.965 0.004 80)',
          2:       'oklch(0.82 0.005 70)',
          muted:   'oklch(0.62 0.006 60)',
          dim:     'oklch(0.46 0.007 60)',
        },
        accent: {
          DEFAULT: 'oklch(0.86 0.13 200)',
          2:       'oklch(0.72 0.12 200)',
          soft:    'oklch(0.35 0.06 200)',
        },
        positive:        'oklch(0.80 0.15 155)',
        'positive-soft': 'oklch(0.32 0.07 155)',
        negative:        'oklch(0.72 0.16 28)',
        'negative-soft': 'oklch(0.32 0.08 28)',
        warn:            'oklch(0.83 0.13 80)',
        'warn-soft':     'oklch(0.33 0.08 80)',
      },
      borderRadius: {
        sm:  '6px',
        DEFAULT: '10px',
        lg:  '14px',
        xl:  '20px',
      },
    },
  },
  plugins: [],
};
