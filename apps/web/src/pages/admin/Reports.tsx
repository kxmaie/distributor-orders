import { motion } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  DollarSign,
  Download,
  Filter,
  Printer,
  Sparkles,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import PrintHeader from "../../components/PrintHeader";
import { ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { downloadCsv } from "../../lib/exportCsv";
import { STATUS_LABEL } from "../../lib/status";
import { useAdminSalesReport } from "../../hooks/adminQueries";
import { formatCurrency, formatDate } from "../../lib/format";
import type { OrderStatus } from "@do/shared";
import { api, ApiError } from "../../lib/api";

export default function AdminReports() {
  const [from, setFrom] = useState<string>(() => {
    const d = new Date(Date.now() - 30 * 86_400_000);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [aiError, setAiError] = useState("");
  const [asking, setAsking] = useState(false);

  const { data, isLoading, error, refetch } = useAdminSalesReport({ from, to });

  const handlePrint = () => {
    window.print();
  };

  async function askAssistant() {
    if (question.trim().length < 3 || asking) return;
    setAsking(true); setAiError(""); setAnswer("");
    try {
      const result = await api.post<{ answer: string }>("/admin/reports/ask", { question, from, to });
      setAnswer(result.answer);
    } catch (error) {
      setAiError(error instanceof ApiError && error.code === "AI_NOT_CONFIGURED"
        ? "مساعد الذكاء الاصطناعي يحتاج إعداد AI Gateway ومفتاحه السري في Vercel."
        : "تعذر إنشاء التقرير الآن. حاول مرة أخرى بعد قليل.");
    } finally { setAsking(false); }
  }

  const handleExport = () => {
    if (!data) return;
    downloadCsv(
      `turk-pen-sales-${from}_${to}.csv`,
      ["رقم الطلب", "الموزع", "المخزن", "عدد الأصناف", "الحالة", "التاريخ", "الإجمالي"],
      data.orders.map((o) => [o.orderNo, o.customerName, o.warehouseName, o.itemsCount, STATUS_LABEL[o.status as OrderStatus] ?? o.status, o.createdAt.slice(0, 10), o.total]),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-display font-extrabold">التقارير المالية والمبيعات</h1>
          <p className="text-sm text-muted">استعراض إيرادات المبيعات وأداء الطلبات حسب فترات زمنية محددة</p>
        </div>

        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button onClick={handleExport} disabled={!data || data.orders.length === 0} className="btn-ghost text-xs px-3.5 py-2 flex items-center gap-1.5">
            <Download className="h-4 w-4" />
            <span>تصدير Excel</span>
          </button>
          <button onClick={handlePrint} className="btn-ghost text-xs px-3.5 py-2 flex items-center gap-1.5" title="من نافذة الطباعة اختر «حفظ بصيغة PDF»">
            <Printer className="h-4 w-4" />
            <span>طباعة / PDF</span>
          </button>
        </div>
      </div>

      <section className="card overflow-hidden border-primary/20 print:hidden">
        <div className="flex items-center gap-3 border-b border-line/10 bg-primary/5 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="h-5 w-5" /></span>
          <div><h2 className="font-bold">مساعد التقارير الذكي</h2><p className="text-xs text-muted">اسأل عن المبيعات والطلبات في الفترة المحددة</p></div>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="input text-sm" value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void askAssistant(); }} placeholder="مثال: لخص أداء المبيعات وما أكثر حالة طلبات؟" maxLength={500} />
            <button type="button" className="btn-primary shrink-0 text-sm" onClick={() => void askAssistant()} disabled={asking || question.trim().length < 3}>{asking ? "بيحلل التقرير…" : <><Sparkles className="h-4 w-4" /> اسأل</>}</button>
          </div>
          {aiError && <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">{aiError}</p>}
          {answer && <div className="rounded-xl bg-surface2/70 p-4 text-sm leading-7 whitespace-pre-wrap">{answer}</div>}
        </div>
      </section>

      {/* Date Filter Bar (Hidden in Print) */}
      <div className="card p-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold text-muted">من:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="input text-xs w-auto"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted">إلى:</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="input text-xs w-auto"
          />
        </div>

        <button onClick={() => refetch()} className="btn-primary text-xs px-4 py-2">
          تطبيق
        </button>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-60" />
        </div>
      )}

      {error && <ErrorBox text="فشل تحميل التقرير المالي" onRetry={() => refetch()} />}

      {!isLoading && !error && data && (
        <div className="space-y-6">
          {/* Printable Header */}
          <div className="hidden print:block">
            <PrintHeader title={`تقرير المبيعات · من ${from} إلى ${to}`} />
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted"><DollarSign className="h-4 w-4 text-primary" />إجمالي الإيرادات</span>
              <div className="text-2xl font-bold text-primary mt-2">
                {formatCurrency(data.summary.totalRevenue)}
              </div>
              <span className="text-[11px] text-muted">باستثناء الطلبات الملغاة</span>
            </div>

            <div className="card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted"><ShoppingBag className="h-4 w-4 text-primary" />إجمالي الطلبات</span>
              <div className="text-2xl font-bold text-ink mt-2">{data.summary.totalOrders}</div>
              <span className="text-[11px] text-muted">{data.summary.completedOrders} طلب نشط</span>
            </div>

            <div className="card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted"><TrendingUp className="h-4 w-4 text-primary" />متوسط قيمة الطلب</span>
              <div className="text-2xl font-bold text-accent mt-2">
                {formatCurrency(data.summary.averageOrderValue)}
              </div>
              <span className="text-[11px] text-muted">Average Order Value</span>
            </div>

            <div className="card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted"><CheckCircle2 className="h-4 w-4 text-success" />نسبة الإنجاز</span>
              <div className="text-2xl font-bold text-success mt-2">
                {data.summary.totalOrders > 0
                  ? Math.round((data.summary.completedOrders / data.summary.totalOrders) * 100)
                  : 0}
                %
              </div>
              <span className="text-[11px] text-muted">طلبات ناجحة غير ملغاة</span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-line/10 flex items-center justify-between">
              <h2 className="text-sm font-bold">تفاصيل طلبات الفترة</h2>
              <span className="text-xs text-muted font-mono">{data.orders.length} طلب</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface2/60 text-muted border-b border-line/10">
                  <tr>
                    <th className="p-3 text-start font-semibold">رقم الطلب</th>
                    <th className="p-3 text-start font-semibold">الموزع</th>
                    <th className="p-3 text-start font-semibold">المخزن</th>
                    <th className="p-3 text-center font-semibold">الأصناف</th>
                    <th className="p-3 text-center font-semibold">الحالة</th>
                    <th className="p-3 text-center font-semibold">التاريخ</th>
                    <th className="p-3 text-end font-semibold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {data.orders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        لا توجد طلبات في هذا النطاق الزمني
                      </td>
                    </tr>
                  ) : (
                    data.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-line/5 transition">
                        <td className="p-3 font-mono font-bold text-ink">{o.orderNo}</td>
                        <td className="p-3 font-semibold text-ink">{o.customerName}</td>
                        <td className="p-3 text-muted">{o.warehouseName}</td>
                        <td className="p-3 text-center font-bold">{o.itemsCount}</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={o.status as OrderStatus} />
                        </td>
                        <td className="p-3 text-center text-muted">{formatDate(o.createdAt)}</td>
                        <td className="p-3 text-end font-mono font-bold text-primary">
                          {formatCurrency(o.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
