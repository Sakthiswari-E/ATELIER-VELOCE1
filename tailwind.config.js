/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./js/**/*.js",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // Primary brand color: Deep Obsidian Espresso
          primary: '#191716',
          'primary-light': '#2D2825',
          'primary-dark': '#0E0D0C',
          // Secondary brand color: Warm Antique Brass
          secondary: '#C5A880',
          'secondary-hover': '#B89566',
          'secondary-light': '#E9DCBC',
          'secondary-dark': '#A37E4C',
          // Neutral background and surface tones
          surface: '#FAF8F5',
          'surface-dark': '#0D0C0B',
          'card-dark': '#151413',
          'surface-card': '#1E1D1B',
          muted: '#8C827A',
          border: '#E7E2DA',
          'border-dark': '#262422',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.22em',
        ultra: '0.3em',
      }
    },
  },
  plugins: [],
}

