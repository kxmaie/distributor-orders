import { create } from "zustand";

type Toast = { id: number; msg: string; kind: "ok" | "err" | "info" | "success" | "danger" };
type S = {
  toasts: Toast[];
  push: (msg: string, kind?: Toast["kind"]) => void;
  dismiss: (id: number) => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
};
let n = 0;
const initial = (): "dark" | "light" => {
  try { return localStorage.getItem("theme") === "light" ? "light" : "dark"; } catch { return "dark"; }
};
export const useUI = create<S>((set, get) => ({
  toasts: [],
  push: (msg, kind = "info") => {
    const id = ++n;
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  theme: initial(),
  toggleTheme: () =>
    set((s) => {
      const theme = s.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", theme);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F4F7F9" : "#0B1220");
      try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
      return { theme };
    }),
}));
