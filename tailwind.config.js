/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          900: '#052e16',
          800: '#14532d',
          700: '#166534',
        },
      },
    },
  },
  plugins: [],
};
