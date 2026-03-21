/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: '#0F1923',
        slate: '#1A2737',
        steel: '#2A3A4D',
        graphite: '#3D4F63',
        copper: '#D4845A',
        'copper-light': '#E8A87C',
        'copper-dark': '#B86E48',
        teal: '#3ABFAD',
        gold: '#E5B84C',
        success: '#3DD68C',
        danger: '#E85D5D',
        info: '#5B9BD5',
      },
      fontFamily: {
        display: ['DM Sans', 'Segoe UI', 'sans-serif'],
        body: ['IBM Plex Sans', 'Segoe UI', 'sans-serif'],
        mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
