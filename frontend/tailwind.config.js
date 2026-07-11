/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark-themed FinOps palette.
        ink: {
          900: "#0b0f17",
          800: "#0f1623",
          700: "#161f30",
          600: "#1e293b",
          500: "#27354b",
        },
        brand: {
          DEFAULT: "#38bdf8",
          soft: "#0ea5e9",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
