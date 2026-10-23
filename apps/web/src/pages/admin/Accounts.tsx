import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Printer, Wallet } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import AccountStatementPanel from "../../components/AccountStatementPanel";
import PrintHeader from "../../components/PrintHeader";
import { ErrorBox, Skeleton } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { downloadCsv } from "../../lib/exportCsv";
import { dateTime, money } from "../../lib/format";
import type { AccountStatement } from "../../lib/types";
import { useUI } from "../../store/ui";

type AccountRow = { id: string; username: string; fullName: string; phone: string | null; isActive: boolean; balance: string };

export default function AdminAccounts() {
  const [selected, setSelected] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["admin", "accounts"], queryFn: () => api.get<AccountRow[]>("/admin/accounts") });
  const statement = useQuery({
    queryKey: ["admin", "account-statement", selected, from, to],
    queryFn: () => api.get<AccountStatement>("/admin/accounts/" + selected + "/statement", { from: from || undefined, to: to || undefined }),
    enabled: Boolean(selected),
  });
  useEffect(() => { if (!selected && accounts.data?.length) setSelected(accounts.data[0].id); }, [accounts.data, selected]);
  const payment = useMutation({
    mutationFn: (body: { amount: string; method: string; reference?: string; note?: string }) => api.post("/admin/accounts/" + selected + "/payments", body),
    onSuccess: () => {
      push("تم تسجيل الدفعة وتحديث كشف الحساب", "ok");
      setAmount(""); setReference(""); setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "account-statement"] });
      qc.invalidateQueries({ queryKey: ["admin", "accounts"] });
    },
    onError: (error) => push(errorText(error), "err"),
  });
  const csvRows = useMemo(() => statement.data?.rows.map((row) => [
    dateTime(row.date), row.description, row.reference, row.debit, row.credit, row.balance,
  ]) ?? [], [statement.data]);

  function submitPayment(event: FormEvent) {
    event.preventDefault();
    if (!selected || Number(amount) <= 0) return;
    payment.mutate({ amount, method, reference: reference || undefined, note: note || undefined });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><Wallet className="h-4 w-4" /> الحسابات</p><h1 className="font-display text-2xl font-extrabold">حسابات الموزعين</h1><p className="mt-1 text-sm text-muted">تابع المديونيات وسجل المقبوضات.</p></div>
        <div className="flex gap-2">
          <button className="btn-ghost" disabled={!statement.data} onClick={() => downloadCsv("turk-pen-account-" + selected + ".csv", ["التاريخ", "البيان", "المرجع", "عليه", "له", "الرصيد"], csvRows)}><Download className="h-4 w-4" /> CSV</button>
          <button className="btn-ghost" disabled={!statement.data} onClick={() => window.print()}><Printer className="h-4 w-4" /> حفظ PDF</button>
        </div>
      </header>
      {accounts.isError && <ErrorBox text="تعذر تحميل حسابات الموزعين" onRetry={() => accounts.refetch()} />}
      {accounts.isLoading && <Skeleton className="h-32" />}
      {accounts.data && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
          {accounts.data.map((account) => (
            <button key={account.id} onClick={() => setSelected(account.id)} className={"card flex items-center justify-between gap-3 p-4 text-start transition hover:-translate-y-0.5 hover:shadow-glow " + (selected === account.id ? "border-primary/50 ring-1 ring-primary/30" : "")}>
              <span className="min-w-0"><span className="block truncate font-semibold">{account.fullName}</span><span className="block text-xs text-muted" dir="ltr">{account.username}{account.phone ? " · " + account.phone : ""}</span></span>
              <span className="shrink-0 text-end"><span className="block text-xs text-muted">الرصيد</span><span className="font-display font-bold text-primary">{money(account.balance)}</span></span>
            </button>
          ))}
        </section>
      )}
      {selected && statement.data && <div className="hidden print:block"><PrintHeader title={"كشف حساب · " + statement.data.user.fullName} /></div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section className="min-w-0 space-y-3">
          <div className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
            <label className="label">من<input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="label">إلى<input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {(from || to) && <button className="btn-ghost" onClick={() => { setFrom(""); setTo(""); }}>كل الفترات</button>}
          </div>
          {statement.isLoading && <><Skeleton className="h-32" /><Skeleton className="h-64" /></>}
          {statement.isError && <ErrorBox text="تعذر تحميل كشف الحساب" onRetry={() => statement.refetch()} />}
          {statement.data && <AccountStatementPanel statement={statement.data} />}
        </section>
        <form onSubmit={submitPayment} className="card h-fit space-y-4 p-5 print:hidden">
          <h2 className="font-display text-lg font-bold">تسجيل دفعة</h2>
          <label className="label">المبلغ<input className="input" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></label>
          <label className="label">طريقة الدفع<select className="input" value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">نقدًا</option><option value="bank_transfer">تحويل بنكي</option><option value="check">شيك</option><option value="other">أخرى</option></select></label>
          <label className="label">رقم الإيصال أو المرجع<input className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></label>
          <label className="label">ملاحظة<input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></label>
          <button className="btn-primary w-full" disabled={!selected || payment.isPending} aria-busy={payment.isPending}>{payment.isPending ? "جارٍ الحفظ..." : "تسجيل الدفعة"}</button>
        </form>
      </div>
    </div>
  );
}
