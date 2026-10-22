import { create } from "zustand";
import type { User } from "../lib/types";

type S = {
  token: string | null;
  user: User | null;
  status: "loading" | "authed" | "anon";
  setSession: (token: string, user: User) => void;
  clear: () => void;
};
// The access token lives in memory only (never localStorage); the refresh cookie is httpOnly.
export const useAuth = create<S>((set) => ({
  token: null, user: null, status: "loading",
  setSession: (token, user) => set({ token, user, status: "authed" }),
  clear: () => set({ token: null, user: null, status: "anon" }),
}));
