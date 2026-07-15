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
          dark: "#0ea5e9",
          light: "#7dd3fc",
          glow: "#0c4a6e",
        },
        // Cost/savings semantics for severity + savings figures.
        ok: "#34d399",
        warn: "#fbbf24",
        danger: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(56,189,248,0.25), 0 8px 30px -8px rgba(56,189,248,0.45)",
        "glow-soft": "0 0 40px -12px rgba(56,189,248,0.5)",
        card: "0 10px 30px -12px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        aurora:
          "radial-gradient(60% 60% at 15% 10%, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 60%), radial-gradient(50% 50% at 90% 20%, rgba(14,165,233,0.14) 0%, rgba(14,165,233,0) 55%), radial-gradient(60% 60% at 75% 90%, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0) 60%)",
        "brand-gradient": "linear-gradient(135deg, #7dd3fc 0%, #38bdf8 45%, #0ea5e9 100%)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "pulse-slow": "pulse-slow 1.6s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};
