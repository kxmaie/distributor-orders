import { motion } from "framer-motion";
import { ArrowLeft, Boxes } from "lucide-react";
import { Link } from "react-router-dom";
import { useCategories, useOrders, useProducts } from "../hooks/queries";
import { money } from "../lib/format";
import { useAuth } from "../store/auth";
import { Stagger, StaggerLi, StaggerUl } from "../components/motion";
import BrandMark from "../components/BrandMark";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { Skeleton, StatusBadge } from "../components/ui";

const item = { h: { opacity: 0, y: 14 }, s: { opacity: 1, y: 0 } };

export default function Home() {
  const user = useAuth((s) => s.user);
  const cats = useCategories();
  const products = useProducts({ page: 1, pageSize: 8 });
  const orders = useOrders();
  const recent = orders.data?.pages[0]?.items.slice(0, 3) ?? [];

  return (
    <div className="space-y-10">
      <section className="card relative overflow-hidden p-6 md:p-10">
        <div className="grid items-center gap-8 md:grid-cols-[1.25fr_1fr]">
          <motion.div className="space-y-5" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={item} className="text-muted">أهلًا {user?.fullName}</motion.p>
            <motion.h1 variants={item} className="font-display text-3xl font-extrabold leading-snug md:text-5xl md:leading-snug">
              إكسسوارات UPVC للأبواب والشبابيك، بأسعارك أنت
            </motion.h1>
            <motion.p variants={item} className="max-w-md text-muted">
              اطلب من المخزن مباشرة، وتابع حالة طلبك من لحظة التأكيد لحد التسليم.
            </motion.p>
            <motion.div variants={item} className="flex flex-wrap gap-3">
              <Link to="/catalog" className="btn-primary">تصفح المنتجات <ArrowLeft className="h-4 w-4" /></Link>
              <Link to="/orders" className="btn-ghost">طلباتي</Link>
            </motion.div>
          </motion.div>

          {/* Roof + four-pane window: the Turk-pen mark, drawn large */}
<BrandMark className="mx-auto w-full max-w-[11rem] text-primary opacity-90 md:max-w-[15rem]" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold">التصنيفات</h2>
        <div className="flex flex-wrap gap-3">
          {cats.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-36" />)}
          {cats.data?.map((c) => (
            <Link key={c.id} to={`/catalog?category=${c.slug}`} className="card flex min-h-14 items-center gap-3 px-5 font-semibold transition hover:shadow-glow">
              <Boxes className="h-5 w-5 text-primary" /> {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">المنتجات</h2>
          <Link to="/catalog" className="text-sm text-primary">عرض الكل</Link>
        </div>
        {products.isLoading && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        )}
        {products.data && (
          <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.data.items.map((p) => <ProductCard key={p.id} p={p} />)}
          </Stagger>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">آخر طلباتي</h2>
            <Link to="/orders" className="text-sm text-primary">كل الطلبات</Link>
          </div>
          <StaggerUl className="space-y-3">
            {recent.map((o) => (
              <StaggerLi key={o.id}>
                <Link to={`/orders/${o.id}`} className="card flex items-center justify-between gap-3 p-4 transition hover:shadow-glow">
                  <div><p className="font-display font-bold" dir="ltr">{o.orderNo}</p><p className="text-sm text-muted">{money(o.total)}</p></div>
                  <StatusBadge status={o.status} />
                </Link>
              </StaggerLi>
            ))}
          </StaggerUl>
        </section>
      )}
    </div>
  );
}
