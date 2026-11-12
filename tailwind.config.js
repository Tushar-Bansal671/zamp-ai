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
        "accent-2": "var(--accent-2)",
        "accent-soft": "var(--accent-soft)",
        verdict: {
          approve: "var(--v-approve)",
          pending: "var(--v-pending)",
          reject: "var(--v-reject)",
          manual: "var(--v-manual)",
        },
        approve: "var(--v-approve)",
        pending: "var(--v-pending)",
        reject: "var(--v-reject)",
        manual: "var(--v-manual)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      borderRadius: {
        xl2: "22px",
      },
      boxShadow: {
        card: "inset 0 1px 0 0 rgba(255,255,255,0.06), 0 24px 48px -24px rgba(0,0,0,0.6)",
        glow: "0 0 40px -12px rgba(77,141,255,0.5)",
      },
    },
  },
  plugins: [],
};
