/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "#1C1C2E",
        teal: "#00B4A6",
        soft: "#E8E8EF",
      },
      fontFamily: {
        head: ['"Bebas Neue"', "sans-serif"],
        body: ['"Montserrat"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
