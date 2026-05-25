export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Outfit", "sans-serif"],
        mono: ["Space Grotesk", "monospace"],
      },
      colors: {
        ink: "#0b0f19",
        mint: "#00f0ff",
        coral: "#ff007b",
        vynora: {
          50: "#ecfaff",
          100: "#d5f3ff",
          200: "#b3e9ff",
          300: "#80dbff",
          400: "#42c3ff",
          500: "#13a2fe",
          600: "#0080ed",
          700: "#0066cd",
          800: "#0552a4",
          900: "#0a4585",
          950: "#072b56",
        },
        cyber: {
          900: "#060913",
          950: "#03050a",
        }
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 240, 255, 0.2)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 240, 255, 0.8), 0 0 40px rgba(0, 240, 255, 0.4)" },
        }
      }
    }
  },
  plugins: []
};

