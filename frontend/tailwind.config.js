/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
        },
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.12)",
        soft: "0 4px 24px rgba(0,0,0,0.08)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
