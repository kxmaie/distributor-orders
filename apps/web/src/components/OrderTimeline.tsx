import { motion } from "framer-motion";
import { Ban, Check } from "lucide-react";
import type { OrderStatus } from "@do/shared";
import { dateTime } from "../lib/format";
import { FLOW, STATUS_LABEL } from "../lib/status";
import type { OrderDetail } from "../lib/types";

export default function OrderTimeline({ order }: { order: OrderDetail }) {
  const at = new Map<OrderStatus, string>();
  for (const h of order.history) at.set(h.toStatus, h.createdAt);
  const cancelled = order.status === "cancelled";
  const steps: OrderStatus[] = cancelled ? [...FLOW.filter((s) => at.has(s)), "cancelled"] : FLOW;
  const current = steps.indexOf(order.status);

  return (
    <ol className="relative space-y-6">
      {steps.map((s, i) => {
        const reached = i <= current;
        const isCurrent = i === current;
        const bad = s === "cancelled";
        return (
          <li key={s} className="relative flex gap-4">
            {i < steps.length - 1 && (
              <span className="absolute start-[15px] top-8 h-[calc(100%-0.5rem)] w-0.5 bg-line/10">
                <motion.span
                  className="block h-full w-full origin-top bg-primary"
                  initial={{ scaleY: 0 }} animate={{ scaleY: i < current ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: i * 0.12 }}
                />
              </span>
            )}
            <motion.span
              className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                bad ? "border-danger bg-danger text-white" : reached ? "border-primary bg-primary text-primary-fg" : "border-line/20 bg-surface text-muted"
              }`}
              animate={isCurrent && !bad ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={isCurrent ? { repeat: Infinity, duration: 2 } : undefined}
            >
              {bad ? <Ban className="h-4 w-4" /> : reached ? <Check className="h-4 w-4" /> : <span className="text-xs">{i + 1}</span>}
            </motion.span>
            <div className="pt-0.5">
              <p className={`font-semibold ${reached ? "" : "text-muted"}`}>{STATUS_LABEL[s]}</p>
              {at.get(s) && <p className="text-xs text-muted">{dateTime(at.get(s)!)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
