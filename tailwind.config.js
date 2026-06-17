/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        paper: "var(--paper)",
        card: "var(--card)",
        line: "var(--line)",
        muted: "var(--muted)",
        saffron: "var(--saffron)",
        "saffron-ink": "var(--saffron-ink)",
        ok: "var(--ok)",
        "ok-bg": "var(--ok-bg)",
        progress: "var(--progress)",
        "progress-bg": "var(--progress-bg)",
        wait: "var(--wait)",
        "wait-bg": "var(--wait-bg)",
        recover: "var(--recover)",
        "recover-bg": "var(--recover-bg)",
        urgent: "var(--urgent)",
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "Georgia", "serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,58,60,0.04), 0 8px 24px -12px rgba(16,58,60,0.18)",
        lift: "0 2px 6px rgba(16,58,60,0.06), 0 18px 40px -16px rgba(16,58,60,0.28)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
};
