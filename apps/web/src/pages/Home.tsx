import { motion } from "framer-motion";
import { ArrowLeft, Boxes, PackageCheck, Sparkles, TrendingUp } from "lucide-react";
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
      <section className="card relative isolate overflow-hidden p-6 md:p-10">
        <motion.div aria-hidden className="pointer-events-none absolute -end-24 -top-28 -z-10 h-80 w-80 rounded-full bg-primary/20 blur-3xl" animate={{ scale: [0.9, 1.12, 0.9], opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div aria-hidden className="pointer-events-none absolute -bottom-36 start-1/4 -z-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" animate={{ x: [0, 30, 0], y: [0, -15, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
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

          <motion.div className="relative mx-auto grid min-h-64 w-full max-w-sm place-items-center md:min-h-80" initial={{ opacity: 0, scale: 0.82, rotate: -5 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 75, damping: 14, delay: 0.2 }}>
            <motion.div aria-hidden className="absolute h-52 w-52 rounded-full border border-primary/25 md:h-64 md:w-64" animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: "linear" }} />
            <motion.div aria-hidden className="absolute h-60 w-60 rounded-full border border-dashed border-accent/25 md:h-72 md:w-72" animate={{ rotate: -360 }} transition={{ duration: 36, repeat: Infinity, ease: "linear" }} />
            <motion.div className="relative z-10 rounded-[2rem] bg-surface/70 p-7 shadow-2xl shadow-primary/20 backdrop-blur-sm" animate={{ y: [0, -9, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
              <BrandMark className="w-36 text-primary opacity-95 md:w-48" />
            </motion.div>
            <motion.div className="absolute end-0 top-7 flex items-center gap-2 rounded-2xl border border-line/15 bg-surface/90 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur" animate={{ y: [0, 6, 0], x: [0, 3, 0] }} transition={{ duration: 3.7, repeat: Infinity, ease: "easeInOut" }}><PackageCheck className="h-4 w-4 text-success" /> متابعة الطلبات</motion.div>
            <motion.div className="absolute bottom-7 start-0 flex items-center gap-2 rounded-2xl border border-line/15 bg-surface/90 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur" animate={{ y: [0, -5, 0], x: [0, -3, 0] }} transition={{ duration: 4.3, repeat: Infinity, ease: "easeInOut" }}><TrendingUp className="h-4 w-4 text-primary" /> أسعار موزعين</motion.div>
            <motion.div aria-hidden className="absolute end-8 bottom-16 text-accent" animate={{ rotate: [0, 18, -8, 0], scale: [1, 1.15, 1] }} transition={{ duration: 4, repeat: Infinity }}><Sparkles className="h-6 w-6" /></motion.div>
          </motion.div>
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
