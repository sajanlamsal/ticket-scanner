/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        green: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        yellow: {
          50: '#fefce8',
          100: '#fef3c7',
          800: '#92400e',
        },
        red: {
          50: '#fef2f2',
          200: '#fecaca',
          600: '#dc2626',
          800: '#991b1b',
        },
      },
    },
  },
  plugins: [],
}