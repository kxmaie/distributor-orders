const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), surface: c("surface"), surface2: c("surface-2"), line: c("line"),
        primary: c("primary"), "primary-fg": c("primary-fg"), accent: c("accent"),
        ink: c("ink"), muted: c("muted"), danger: c("danger"), success: c("success"),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
        display: ["Montserrat", "Cairo", '"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: { soft: "0 10px 30px -12px rgb(0 0 0 / .45)", glow: "0 0 0 1px rgb(var(--primary) / .5), 0 8px 30px -8px rgb(var(--primary) / .45)" },
    },
  },
  plugins: [],
};
