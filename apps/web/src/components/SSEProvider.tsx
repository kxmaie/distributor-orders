/**
 * SSEProvider — mounts useSSE (the single shared SSE connection) for authed users.
 * Also exports <NotificationBell>, which reads unreadCount from the same store
 * (no extra EventSource) and takes the admin to the orders board when clicked.
 */
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSSE } from "../hooks/useSSE";
import { useAuth } from "../store/auth";
import { useSSEStore } from "../store/sse";

function SSEMount() {
  useSSE();
  return null;
}

export default function SSEProvider() {
  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);
  if (status !== "authed" || !user || user.role === "supplier") return null;
  return <SSEMount />;
}

// ─── Notification Bell ────────────────────────────────────────────────────────
// Reads directly from the shared store — no extra EventSource.

export function NotificationBell() {
  const unread = useSSEStore((s) => s.unreadCount);
  const clear = useSSEStore((s) => s.clearUnread);
  const nav = useNavigate();

  return (
    <button
      type="button"
      aria-label={`إشعارات (${unread} غير مقروء)`}
      onClick={() => { clear(); nav("/admin/orders"); }}
      className="relative grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-line/5"
    >
      <Bell className="h-5 w-5" />
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="absolute -top-0.5 -end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white"
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
