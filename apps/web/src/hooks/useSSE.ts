/**
 * useSSE — mount ONCE (via <SSEProvider/> in App.tsx).
 *  1. connects/disconnects the shared EventSource in store/sse.ts according to the login state;
 *  2. subscribes to its events: toast + react-query invalidation.
 * The admin bell reads `unreadCount` from the same store, so bell and toast always move together.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { money } from "../lib/format";
import { useAuth } from "../store/auth";
import { useSSEStore } from "../store/sse";
import { useUI } from "../store/ui";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  confirmed: "مؤكد",
  in_production: "قيد الإنتاج",
  ready: "جاهز للاستلام",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

export function useSSE() {
  const userId = useAuth((s) => s.user?.id);
  const role = useAuth((s) => s.user?.role);
  const qc = useQueryClient();
  const push = useUI((s) => s.push);
  const connect = useSSEStore((s) => s.connect);
  const disconnect = useSSEStore((s) => s.disconnect);
  const subscribe = useSSEStore((s) => s.subscribe);

  // Connection lifecycle: one connection per logged-in user (token refreshes do NOT reconnect).
  useEffect(() => {
    if (!userId || !role) { disconnect(); return; }
    connect(userId, role);
  }, [userId, role, connect, disconnect]);

  // Reactions: toast + cache invalidation.
  useEffect(() => {
    const isAdmin = role !== undefined && role !== "distributor";

    const refreshOrders = (orderId?: string) => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order", ...(orderId ? [String(orderId)] : [])] });
      if (isAdmin) {
        qc.invalidateQueries({ queryKey: ["admin", "orders"] });
        qc.invalidateQueries({ queryKey: ["admin", "order"] });
        qc.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      }
    };

    return subscribe((e) => {
      if (e.type === "resync") { refreshOrders(); return; }

      if (e.type === "order_created") {
        if (!isAdmin) return;
        const { orderNo, distributor, total, orderId } = e.data;
        push(`طلب جديد ${orderNo}${distributor ? ` من ${distributor}` : ""}${total ? ` — ${money(total)}` : ""}`, "info");
        refreshOrders(orderId);
        return;
      }

      const { orderNo, to, orderId, distributor } = e.data;
      const label = STATUS_LABELS[to] ?? to;
      push(
        isAdmin && distributor
          ? `طلب ${orderNo} (${distributor}) — الحالة: ${label}`
          : `طلب ${orderNo} — تم تغيير الحالة إلى: ${label}`,
        to === "cancelled" ? "danger" : "info",
      );
      refreshOrders(orderId);
    });
  }, [role, qc, push, subscribe]);
}
