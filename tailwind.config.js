/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B132B',
        surface: '#1C2541',
        accent: '#38BDF8',
        success: '#22C55E',
        danger: '#EF4444',
      },
    },
  },
  plugins: [],
};
