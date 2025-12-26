/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'float': 'float 20s infinite ease-in-out',
        'slideUp': 'slideUp 0.6s ease-out',
        'fadeIn': 'fadeIn 0.8s ease-out',
        'bounce': 'bounce 2s infinite',
        'pulse': 'pulse 1.5s infinite',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-30px) rotate(5deg)' },
        },
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(30px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-15px)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          'to': { transform: 'rotate(360deg)' },
        },
      },
      animationDelay: {
        '200': '0.2s',
        '400': '0.4s',
        '600': '0.6s',
        '5000': '5s',
      },
    },
  },
  plugins: [],
}