import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Download, Printer, Search, RotateCcw, FileText, Boxes } from "lucide-react";
import PrintHeader from "../../components/PrintHeader";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/exportCsv";
import { formatDate, money } from "../../lib/format";

type ReturnLine = { product: string; variant: string; qty: number; unitPrice: string; total: string };
type ReturnRow = { id: string; number: string; invoiceNo: string; customer?: string; supplier?: string; date: string; total: string; items: ReturnLine[] };
type Report = { summary: { count: number; quantity: number; total: string }; rows: ReturnRow[] };

export default function ReturnsReport({ kind }: { kind: "sales" | "purchases" }) {
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");
  const isSales = kind === "sales";
  const title = isSales ? "تقارير مرتجعات المبيعات" : "تقارير مرتجعات المشتريات";
  const query = useQuery({
    queryKey: ["report-returns", kind, from, to],
    queryFn: () => api.get<Report>(`/admin/reports/returns/${kind}?${new URLSearchParams({ from, to })}`),
  });
  const rows = useMemo(() => (query.data?.rows ?? []).filter(row =>
    `${row.number} ${row.invoiceNo} ${row.customer ?? ""} ${row.supplier ?? ""} ${row.items.map(item => item.product + " " + item.variant).join(" ")}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  ), [query.data, search]);
  const exportRows = () => downloadCsv(`returns-${kind}-${from}-${to}.csv`,
    ["رقم المرتجع", isSales ? "رقم فاتورة البيع" : "رقم فاتورة الشراء", isSales ? "العميل" : "المورد", "التاريخ", "الأصناف والكميات", "قيمة المرتجع"],
    rows.map(row => [row.number, row.invoiceNo, row.customer ?? row.supplier ?? "", row.date.slice(0, 10), row.items.map(item => `${item.product} ${item.variant} × ${item.qty}`).join("؛ "), row.total]),
  );

  return <div className="space-y-5">
    <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><RotateCcw className="h-5 w-5" /></span><div><h1 className="font-display text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-muted">المرتجعات المسجلة وتأثيرها المالي، مع ربط كل مرتجع بالفاتورة الأصلية.</p></div></div>
      <div className="flex gap-2"><button className="btn-ghost flex items-center gap-2" onClick={exportRows} disabled={!rows.length}><Download className="h-4 w-4" />تصدير CSV</button><button className="btn-ghost flex items-center gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />طباعة / PDF</button></div>
    </motion.header>
    <div className="hidden print:block"><PrintHeader title={`${title} · ${from} — ${to}`} /></div>
    <section className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
      <label className="label">من<input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="label">إلى<input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label className="label min-w-52 flex-1"><span className="flex items-center gap-1"><Search className="h-4 w-4" />بحث برقم المستند أو الطرف أو الصنف</span><input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث هنا" /></label>
    </section>
    {query.isError && <p className="card p-4 text-danger">تعذر تحميل تقرير المرتجعات.</p>}
    <section className="grid gap-3 sm:grid-cols-3">
      {[[FileText, "عدد مستندات المرتجع", query.data?.summary.count?.toLocaleString("ar-EG") ?? "—"], [Boxes, "الوحدات المرتجعة", query.data?.summary.quantity?.toLocaleString("ar-EG") ?? "—"], [RotateCcw, "إجمالي قيمة المرتجعات", query.data ? money(query.data.summary.total) : "—"]].map(([Icon, label, value]) => {
        const CardIcon = Icon as typeof FileText;
        return <motion.article key={String(label)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="card flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CardIcon className="h-5 w-5" /></span><div><span className="block text-sm text-muted">{label as string}</span><strong className="mt-1 block text-lg">{value as string}</strong></div></motion.article>;
      })}
    </section>
    <section className="card overflow-hidden">
      <div className="border-b border-line/10 p-4 font-bold">المستندات ({rows.length})</div>
      <div className="overflow-x-auto"><table className="data"><thead><tr><th>رقم المرتجع</th><th>الفاتورة الأصلية</th><th>{isSales ? "العميل" : "المورد"}</th><th>الأصناف والكميات</th><th>التاريخ</th><th>القيمة</th></tr></thead><tbody>
        {rows.map(row => <tr key={row.id}><td className="font-mono font-bold">{row.number}</td><td>{row.invoiceNo}</td><td>{row.customer ?? row.supplier}</td><td>{row.items.map((item, i) => <span key={`${item.product}-${i}`} className="me-2 inline-block">{item.product} · {item.variant} × {item.qty}</span>)}</td><td>{formatDate(row.date)}</td><td className="font-bold text-primary">{money(row.total)}</td></tr>)}
        {!query.isLoading && rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted">{search ? "لا توجد نتائج مطابقة." : "لا توجد مرتجعات في الفترة المحددة."}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
