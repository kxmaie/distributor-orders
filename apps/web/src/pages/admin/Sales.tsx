import { ArrowUpRight, Printer, ReceiptText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBox, Skeleton, StatusBadge } from "../../components/ui";
import { useAdminOrders } from "../../hooks/adminQueries";
import { formatCurrency, formatDate } from "../../lib/format";

export default function AdminSales() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useAdminOrders({ status: "delivered", page, pageSize: 15 });
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 15));

  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><ReceiptText className="h-6 w-6 text-primary" /> المبيعات</h1><p className="mt-1 text-sm text-muted">كل طلب اكتمل تسليمه يظهر هنا كفاتورة مبيعات مستقلة.</p></div>
      {data && <div className="card px-4 py-3 text-sm"><span className="text-muted">عدد الفواتير المسلّمة</span><strong className="ms-2 text-primary">{data.total}</strong></div>}
    </header>
    {isLoading && <div className="space-y-3"><Skeleton className="h-14" /><Skeleton className="h-64" /></div>}
    {error && <ErrorBox text="تعذر تحميل فواتير المبيعات" onRetry={() => refetch()} />}
    {data && data.items.length === 0 && <EmptyState title="لا توجد مبيعات مسلّمة بعد" hint="عند اكتمال تسليم أي طلب، سيظهر هنا تلقائيًا كفاتورة مبيعات." />}
    {data && data.items.length > 0 && <>
      <div className="table-wrap"><table className="data"><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>المخزن</th><th>الإجمالي</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>
        {data.items.map((order) => <tr key={order.id}>
          <td className="font-mono font-bold text-primary" dir="ltr">INV-{order.orderNo}</td>
          <td><strong>{order.user?.fullName ?? "—"}</strong><small className="block text-muted" dir="ltr">{order.user?.phone || order.user?.username || ""}</small></td>
          <td>{formatDate(order.createdAt)}</td><td>{order.warehouse.name}</td><td className="font-bold">{formatCurrency(order.total)}</td><td><StatusBadge status={order.status} /></td>
          <td><Link to={`/admin/sales/${order.id}`} className="btn-ghost min-h-9 px-3 py-1.5 text-xs"><Printer className="h-4 w-4" /> عرض الفاتورة وطباعتها <ArrowUpRight className="h-3.5 w-3.5" /></Link></td>
        </tr>)}
      </tbody></table></div>
      <div className="flex items-center justify-between text-sm"><span className="text-muted">إجمالي الفواتير: {data.total}</span><div className="flex items-center gap-2"><button className="btn-ghost px-3 py-1.5" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</button><span>صفحة {page} من {pageCount}</span><button className="btn-ghost px-3 py-1.5" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>التالي</button></div></div>
    </>}
  </div>;
}

