/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0F1115',
          surface: '#171A21',
          elevated: '#1F2430',
        },
        brand: {
          DEFAULT: '#7C5CFF',
          soft: '#A88BFF',
          ink: '#0B0820',
        },
        accent: '#22D3EE',
        ink: {
          DEFAULT: '#E8ECF4',
          mute: '#A6AEC0',
          dim: '#6B7385',
        },
        danger: '#F87171',
        success: '#34D399',
        warn: '#FBBF24',
      },
      fontFamily: {
        sans: [
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 6px 20px rgba(0,0,0,0.25)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
