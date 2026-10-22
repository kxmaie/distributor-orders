/**
 * useSSEStore — the ONE EventSource for the whole app, plus the bell's unread counter.
 *
 * Everything that reacts to server events (toasts, react-query invalidation, the admin bell)
 * hangs off this single connection:
 *   - the store itself updates `unreadCount` (bell) — synchronously, in the same tick as the event;
 *   - other consumers register with `subscribe(fn)` and receive every event.
 * No second EventSource, no window events, no timing gap between bell and toast.
 *
 * The token is read from the auth store on every (re)connect, so a reconnect after the 15-minute
 * access token expired uses the refreshed one instead of the stale one captured at first connect.
 */
import { create } from "zustand";
import { refreshSession } from "../lib/api";
import { useAuth } from "./auth";

export type SSEEvent =
  | { type: "order_created"; data: { orderId: string; orderNo: string; distributor?: string; total?: string } }
  | { type: "order_status"; data: { orderId: string; orderNo: string; from: string; to: string; distributor?: string; total?: string } }
  /** Fired after a RE-connect: events may have been missed while offline, so consumers should refetch. */
  | { type: "resync" };

type Listener = (e: SSEEvent) => void;

const URL_BASE = "/api/v1/events";
const MAX_BACKOFF = 30_000;

type SSEState = {
  unreadCount: number;
  connected: boolean;
  clearUnread: () => void;
  /** Idempotent per user id: StrictMode double-mounts / re-renders won't open a second connection. */
  connect: (userId: string, role: string) => void;
  disconnect: () => void;
  subscribe: (fn: Listener) => () => void;
};

const listeners = new Set<Listener>();
let es: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 1_000;
let failures = 0;
let everConnected = false;
let activeUser: string | null = null;
let activeRole = "distributor";

function emit(e: SSEEvent) {
  for (const fn of listeners) {
    try { fn(e); } catch (err) { console.error("[sse] listener error", err); }
  }
}

function parse(raw: string): Record<string, unknown> | null {
  try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
}

export const useSSEStore = create<SSEState>((set, get) => {
  function open() {
    if (!activeUser) return;
    const token = useAuth.getState().token;
    if (!token) return;

    const source = new EventSource(`${URL_BASE}?token=${encodeURIComponent(token)}`);
    es = source;

    source.addEventListener("connected", () => {
      backoff = 1_000;
      failures = 0;
      set({ connected: true });
      if (everConnected) emit({ type: "resync" });
      everConnected = true;
    });

    const onBusiness = (type: "order_created" | "order_status") => (ev: MessageEvent) => {
      const data = parse(ev.data);
      if (!data) return;
      // Admin bell: count every business event the server sends to an admin.
      if (activeRole !== "distributor") set((s) => ({ unreadCount: s.unreadCount + 1 }));
      emit({ type, data } as SSEEvent);
    };
    source.addEventListener("order_created", onBusiness("order_created"));
    source.addEventListener("order_status", onBusiness("order_status"));

    source.onerror = () => {
      source.close();
      if (es === source) es = null;
      set({ connected: false });
      if (!activeUser) return;
      failures += 1;
      const delay = backoff;
      backoff = Math.min(delay * 2, MAX_BACKOFF);
      retryTimer = setTimeout(async () => {
        // EventSource can't tell us "401": after a repeated failure, try to refresh the access token first.
        if (failures >= 2) await refreshSession();
        if (activeUser) open();
      }, delay);
    };
  }

  return {
    unreadCount: 0,
    connected: false,
    clearUnread: () => set({ unreadCount: 0 }),

    connect(userId, role) {
      activeRole = role;
      if (activeUser === userId && (es || retryTimer)) return;
      get().disconnect();
      activeUser = userId;
      activeRole = role;
      everConnected = false;
      open();
    },

    disconnect() {
      activeUser = null;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      es?.close();
      es = null;
      backoff = 1_000;
      failures = 0;
      set({ unreadCount: 0, connected: false });
    },

    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
});
