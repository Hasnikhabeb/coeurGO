/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ormuz: {
          night: "#07111f",
          deep: "#0b1e31",
          gulf: "#0d3a4d",
          sand: "#d8b56d",
          radar: "#ff3b4f",
          tactical: "#37f28a",
          ink: "#dbeafe"
        }
      },
      boxShadow: {
        radar: "0 0 28px rgba(55, 242, 138, 0.22)"
      },
      animation: {
        sonar: "sonar 2.8s ease-out infinite",
        scan: "scan 2.6s linear infinite",
        impact: "impact 500ms ease-out"
      },
      keyframes: {
        sonar: {
          "0%": { transform: "scale(0.65)", opacity: "0.7" },
          "100%": { transform: "scale(1.55)", opacity: "0" }
        },
        scan: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" }
        },
        impact: {
          "0%": { transform: "scale(0.72)", opacity: "0.3" },
          "70%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" }
        }
      }
    }
  },
  plugins: []
};
