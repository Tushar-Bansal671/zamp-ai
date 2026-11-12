/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}", "./lib/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel-2)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        "line-soft": "var(--line-soft)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
        verdict: {
          approve: "var(--v-approve)",
          pending: "var(--v-pending)",
          reject: "var(--v-reject)",
          manual: "var(--v-manual)",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.05), 0 4px 14px rgba(16,24,40,0.05)",
        cardHover: "0 1px 2px rgba(16,24,40,0.06), 0 8px 24px rgba(16,24,40,0.09)",
      },
    },
  },
  plugins: [],
};
