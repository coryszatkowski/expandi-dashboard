/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#227bcb',
          50: '#e8f3fc',
          100: '#d1e7f9',
          200: '#a3cff3',
          300: '#75b7ed',
          400: '#479fe7',
          500: '#227bcb',
          600: '#1b62a3',
          700: '#14497a',
          800: '#0d3152',
          900: '#061829',
        }
      }
    },
  },
  plugins: [],
}
