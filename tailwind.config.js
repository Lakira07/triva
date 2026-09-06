/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        'tightest': '-0.04em',
        'tighter': '-0.03em',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0,0,0,0.08), 0 1px 3px -1px rgba(0,0,0,0.06)',
        'card': '0 4px 24px -8px rgba(0,0,0,0.12), 0 1px 4px -2px rgba(0,0,0,0.08)',
        'elevated': '0 12px 40px -12px rgba(0,0,0,0.18), 0 4px 12px -4px rgba(0,0,0,0.10)',
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        slideUp: 'slideUp 0.3s ease-out',
        fadeIn: 'fadeIn 0.2s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
