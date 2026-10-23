import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import type { AccountStatement } from "../lib/types";
import { dateTime, money } from "../lib/format";

export default function AccountStatementPanel({ statement }: { statement: AccountStatement }) {
  return (
    <div className="space-y-4">
      <motion.section layout className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-surface to-surface p-5 md:p-7">
        <div className="pointer-events-none absolute -end-10 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-sm text-muted"><Wallet className="h-4 w-4 text-primary" /> الرصيد المستحق</p>
            <motion.p key={statement.balance} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 font-display text-3xl font-extrabold text-primary md:text-4xl">{money(statement.balance)}</motion.p>
            <p className="mt-2 text-xs text-muted">الرصيد يُحسب من البضائع المسلّمة مطروحًا منها المدفوعات المسجلة.</p>
          </div>
          <div className="rounded-xl border border-line/10 bg-bg/40 px-4 py-3 text-sm">
            <span className="text-muted">رصيد أول المدة</span>
            <p className="mt-1 font-display font-bold">{money(statement.openingBalance)}</p>
          </div>
        </div>
      </motion.section>

      <div className="table-wrap">
        <table className="data min-w-[52rem]">
          <thead><tr><th>التاريخ</th><th>البيان</th><th>المرجع</th><th>عليه</th><th>له</th><th>الرصيد</th></tr></thead>
          <tbody>
            {statement.rows.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-muted">لا توجد حركات في الفترة المحددة</td></tr> : statement.rows.map((row) => (
              <tr key={row.id}>
                <td dir="ltr" className="whitespace-nowrap">{dateTime(row.date)}</td>
                <td><span className="inline-flex items-center gap-2">{row.type === "delivery" ? <ArrowUpRight className="h-4 w-4 text-danger" /> : <ArrowDownLeft className="h-4 w-4 text-success" />}{row.description}</span></td>
                <td dir="ltr">{row.reference || "—"}</td>
                <td className="font-semibold">{Number(row.debit) > 0 ? money(row.debit) : "—"}</td>
                <td className="font-semibold text-success">{Number(row.credit) > 0 ? money(row.credit) : "—"}</td>
                <td className="font-display font-bold text-primary">{money(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
