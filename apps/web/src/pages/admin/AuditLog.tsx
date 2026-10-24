import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, History, Search } from "lucide-react";
import { ErrorBox, Skeleton } from "../../components/ui";
import { api } from "../../lib/api";
import { downloadCsv } from "../../lib/exportCsv";
import { dateTime } from "../../lib/format";

type AuditEntry = { id: string; actor: { fullName: string; username: string } | null; action: string; entity: string; entityId: string | null; meta: unknown; ip: string | null; createdAt: string };
type AuditResult = { items: AuditEntry[]; total: number; page: number; pageSize: number };
const actionLabels: Record<string, string> = {
  "user.create": "إضافة مستخدم", "user.update": "تعديل مستخدم", "user.approve": "اعتماد مستخدم", "user.reject": "رفض مستخدم", "user.deactivate": "تعطيل مستخدم",
  "product.create": "إضافة منتج", "product.update": "تعديل منتج", "product.price_change": "تغيير سعر منتج", "product.deactivate": "إخفاء منتج", "product.force_delete": "حذف منتج نهائيًا",
  "purchase.create": "إنشاء فاتورة مشتريات", "purchase.update": "تعديل فاتورة مشتريات", "purchase.void": "إلغاء فاتورة مشتريات", "account.payment": "تسجيل دفعة", "company_profile.update": "تعديل بيانات المنشأة",
  "order.admin_edit": "تعديل طلب", "order.update": "تعديل طلب", "category.force_delete": "حذف تصنيف نهائيًا", "category.create": "إضافة تصنيف", "category.update": "تعديل تصنيف", "category.deactivate": "إيقاف تصنيف", "warehouse.create": "إضافة مخزن", "warehouse.update": "تعديل مخزن", "warehouse.deactivate": "إيقاف مخزن", "variant.create": "إضافة متغير", "variant.update": "تعديل متغير", "variant.price_change": "تغيير سعر متغير", "stock.adjust": "تعديل كمية المخزون", "stock.threshold": "تغيير حد تنبيه المخزون", "order.create": "إنشاء طلب", "order.status_change": "تغيير حالة طلب", "order.delivery": "تسليم طلب", "user.register_pending": "طلب تسجيل جديد", "password_request.resolve": "معالجة طلب استعادة كلمة المرور", "password_request.reject": "رفض طلب استعادة كلمة المرور", "discount.create": "إنشاء خصم", "discount.update": "تعديل خصم", "discount.deactivate": "إيقاف خصم",
};
const entityLabels: Record<string, string> = { user: "مستخدم", product: "منتج", variant: "متغير", purchase: "فاتورة مشتريات", order: "طلب", payment: "دفعة", category: "تصنيف", discount: "خصم", warehouse: "مخزن", company_profile: "بيانات المنشأة" };
const detailText = (value: unknown) => value == null ? "—" : typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));

export default function AdminAuditLog() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin", "audit-log", from, to, search, page],
    queryFn: () => api.get<AuditResult>("/admin/reports/audit-log", { from: from || undefined, to: to || undefined, q: search.trim() || undefined, page, pageSize: 50 }),
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 50));
  const exportCsv = () => {
    if (!query.data) return;
    downloadCsv(`turk-pen-audit-${from || "all"}-${to || "today"}-page-${page}.csv`, ["التاريخ", "المستخدم", "اسم الدخول", "الإجراء", "النوع", "المرجع", "التفاصيل", "عنوان الشبكة"], query.data.items.map((row) => [dateTime(row.createdAt), row.actor?.fullName ?? "النظام", row.actor?.username ?? "", actionLabels[row.action] ?? row.action, entityLabels[row.entity] ?? row.entity, row.entityId ?? "", detailText(row.meta), row.ip ?? ""]));
  };
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary"><History className="h-4 w-4"/> الرقابة والشفافية</p><h1 className="font-display text-2xl font-extrabold">سجل التغييرات</h1><p className="mt-1 text-sm text-muted">راجع العمليات الإدارية، منفذها، وتوقيتها مع إمكانية البحث والتصدير.</p></div>
      <button className="btn-ghost flex items-center gap-2" onClick={exportCsv} disabled={!query.data?.items.length}><Download className="h-4 w-4"/>تصدير الصفحة</button>
    </header>
    <section className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
      <label className="label">من تاريخ<input className="input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}/></label>
      <label className="label">إلى تاريخ<input className="input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }}/></label>
      <label className="label min-w-56 flex-1"><span className="flex items-center gap-1"><Search className="h-4 w-4"/>بحث بالمستخدم أو الإجراء أو المرجع</span><input className="input" value={search} maxLength={120} placeholder="اسم أو إجراء أو رقم" onChange={(e) => { setSearch(e.target.value); setPage(1); }}/></label>
      {(from || to || search) && <button className="btn-ghost" onClick={() => { setFrom(""); setTo(""); setSearch(""); setPage(1); }}>مسح الفلاتر</button>}
    </section>
    {query.isLoading && <Skeleton className="h-80"/>}
    {query.isError && <ErrorBox text="تعذر تحميل سجل التغييرات" onRetry={() => query.refetch()}/>}
    {query.data && <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line/10 p-4"><h2 className="font-bold">العمليات المسجلة</h2><span className="text-sm text-muted">{query.data.total.toLocaleString("ar-EG")} عملية</span></div>
      <div className="overflow-x-auto"><table className="data min-w-[64rem]"><thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>النوع والمرجع</th><th>التفاصيل</th><th>عنوان الشبكة</th></tr></thead><tbody>
        {query.data.items.map((row) => <tr key={row.id}><td className="whitespace-nowrap" dir="ltr">{dateTime(row.createdAt)}</td><td><span className="block font-semibold">{row.actor?.fullName ?? "النظام"}</span>{row.actor && <span className="text-xs text-muted" dir="ltr">{row.actor.username}</span>}</td><td><span className="font-semibold">{actionLabels[row.action] ?? row.action}</span><span className="block text-xs text-muted" dir="ltr">{row.action}</span></td><td>{entityLabels[row.entity] ?? row.entity}{row.entityId && <span className="ms-1 text-xs text-muted" dir="ltr">#{row.entityId}</span>}</td><td className="max-w-72"><details><summary className="cursor-pointer text-primary">عرض التفاصيل</summary><pre dir="auto" className="mt-2 max-h-40 max-w-72 overflow-auto whitespace-pre-wrap break-all text-xs">{detailText(row.meta)}</pre></details></td><td className="text-xs text-muted" dir="ltr">{row.ip ?? "—"}</td></tr>)}
        {!query.data.items.length && <tr><td colSpan={6} className="p-10 text-center text-muted">لا توجد عمليات مطابقة للبحث.</td></tr>}
      </tbody></table></div>
      <footer className="flex items-center justify-between gap-3 border-t border-line/10 p-4 print:hidden"><span className="text-sm text-muted">صفحة {page} من {pages}</span><div className="flex gap-2"><button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>السابق</button><button className="btn-ghost" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>التالي</button></div></footer>
    </section>}
  </div>;
}