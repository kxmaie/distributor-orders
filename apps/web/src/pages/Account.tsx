import { useQuery } from "@tanstack/react-query";
import { Download, Printer, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { downloadCsv } from "../lib/exportCsv";
import { dateTime } from "../lib/format";
import type { AccountStatement } from "../lib/types";
import AccountStatementPanel from "../components/AccountStatementPanel";
import PrintHeader from "../components/PrintHeader";
import { ErrorBox, Skeleton } from "../components/ui";

export default function Account() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useQuery({
    queryKey: ["account-statement", from, to],
    queryFn: () => api.get<AccountStatement>("/account/statement", { from: from || undefined, to: to || undefined }),
  });
  const csvRows = useMemo(() => query.data?.rows.map((row) => [
    dateTime(row.date), row.description, row.reference, row.debit, row.credit, row.balance,
  ]) ?? [], [query.data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><ReceiptText className="h-4 w-4" /> الحسابات</p>
          <h1 className="font-display text-2xl font-extrabold">كشف حسابي</h1>
          <p className="mt-1 text-sm text-muted">تسليماتك ومدفوعاتك في مكان واحد.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!query.data} onClick={() => downloadCsv("turk-pen-account.csv", ["التاريخ", "البيان", "المرجع", "عليه", "له", "الرصيد"], csvRows)}><Download className="h-4 w-4" /> CSV</button>
          <button className="btn-ghost" disabled={!query.data} onClick={() => window.print()}><Printer className="h-4 w-4" /> حفظ PDF</button>
        </div>
      </header>
      {query.data && <div className="hidden print:block"><PrintHeader title={"كشف حساب · " + query.data.user.fullName + " · " + new Date().toLocaleDateString("ar-EG")} /></div>}
      <section className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
        <label className="label">من<input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="label">إلى<input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        {(from || to) && <button className="btn-ghost" onClick={() => { setFrom(""); setTo(""); }}>كل الفترات</button>}
      </section>
      {query.isLoading && <><Skeleton className="h-36" /><Skeleton className="h-64" /></>}
      {query.isError && <ErrorBox text="تعذر تحميل كشف الحساب" onRetry={() => query.refetch()} />}
      {query.data && <AccountStatementPanel statement={query.data} />}
    </div>
  );
}
