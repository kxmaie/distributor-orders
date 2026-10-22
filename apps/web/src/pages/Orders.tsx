import { useState } from "react";
import { Link } from "react-router-dom";
import { ORDER_STATUSES } from "@do/shared";
import { useOrders } from "../hooks/queries";
import { errorText } from "../lib/api";
import { dateTime, money } from "../lib/format";
import { STATUS_LABEL } from "../lib/status";
import { StaggerLi, StaggerUl } from "../components/motion";
import { BtnLabel, EmptyState, ErrorBox, Skeleton, StatusBadge } from "../components/ui";

export default function Orders() {
  const [status, setStatus] = useState<string>();
  const q = useOrders(status);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold">طلباتي</h1>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={`chip shrink-0 ${!status ? "chip-active" : ""}`} onClick={() => setStatus(undefined)}>الكل</button>
        {ORDER_STATUSES.map((s) => (
          <button key={s} className={`chip shrink-0 ${status === s ? "chip-active" : ""}`} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>
        ))}
      </div>
      {q.isError && <ErrorBox text={errorText(q.error)} onRetry={() => q.refetch()} />}
      {q.isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>}
      {q.data && items.length === 0 && <EmptyState title="لا توجد طلبات" hint="ابدأ بطلبك الأول من الكتالوج" action={<Link to="/catalog" className="btn-primary">تصفح المنتجات</Link>} />}
      <StaggerUl className="space-y-3">
        {items.map((o) => (
          <StaggerLi key={o.id}>
            <Link to={`/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-glow">
              <div className="space-y-1">
                <p className="font-display text-lg font-bold" dir="ltr">{o.orderNo}</p>
                <p className="text-sm text-muted">{dateTime(o.createdAt)} · {o.itemCount} صنف</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-display font-bold text-primary">{money(o.total)}</span>
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </StaggerLi>
        ))}
      </StaggerUl>
      {q.hasNextPage && (
        <div className="text-center"><button className="btn-ghost" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} aria-busy={q.isFetchingNextPage}><BtnLabel loading={q.isFetchingNextPage}>تحميل المزيد</BtnLabel></button></div>
      )}
    </div>
  );
}
