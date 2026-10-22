import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownUp,
  Boxes,
  Clock,
  Filter,
  Plus,
  RotateCcw,
  Search,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorBox, Skeleton } from "../../components/ui";
import {
  useAdjustStock,
  useAdminMovements,
  useAdminStock,
  useAdminWarehouses,
} from "../../hooks/adminQueries";
import { formatDate } from "../../lib/format";
import { useUI } from "../../store/ui";

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  receipt: "إدخال وارد",
  adjustment: "تسوية جردية",
  reserve: "حجز لطلب",
  release: "إلغاء حجز",
  ship: "شحن وتسليم",
};

export default function AdminStock() {
  const push = useUI((s) => s.push);
  const [tab, setTab] = useState<"levels" | "movements">("levels");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [search, setSearch] = useState<string>("");
  const [movementType, setMovementType] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  // Adjust stock modal state
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [selectedStock, setSelectedStock] = useState<{
    variantId: string;
    warehouseId: number;
    sku: string;
    productName: string;
  } | null>(null);
  const [adjustType, setAdjustType] = useState<"receipt" | "adjustment">("adjustment");
  const [delta, setDelta] = useState<number>(0);
  const [note, setNote] = useState<string>("");

  const { data: warehouses } = useAdminWarehouses();
  const { data: stockData, isLoading: stockLoading, error: stockError, refetch: refetchStock } = useAdminStock({
    warehouseId,
    q: search.trim() || undefined,
    page,
  });

  const { data: movementsData, isLoading: movementsLoading, error: movementsError, refetch: refetchMovements } =
    useAdminMovements({
      warehouseId,
      type: movementType,
      page,
    });

  const adjustStock = useAdjustStock();

  const handleOpenAdjust = (variantId: string, whId: number, sku: string, prodName: string) => {
    setSelectedStock({ variantId, warehouseId: whId, sku, productName: prodName });
    setDelta(0);
    setNote("");
    setAdjustType("adjustment");
    setAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || delta === 0) {
      push("يرجى إدخال كمية غير صفرية", "info");
      return;
    }
    try {
      await adjustStock.mutateAsync({
        variantId: selectedStock.variantId,
        warehouseId: selectedStock.warehouseId,
        delta,
        type: adjustType,
        note: note.trim() || undefined,
      });
      push("تم تعديل المخزون وتسجيل الحركة بنجاح", "success");
      setAdjustModalOpen(false);
    } catch {
      push("فشل تعديل المخزون، تأكد من أن الرصيد لن يقل عن المحجوز", "danger");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">إدارة المخزون</h1>
          <p className="text-sm text-muted">مراقبة الأرصدة، الحجوزات، تسوية الجرد، وحركات المخازن</p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => {
              setTab("levels");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              tab === "levels" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Boxes className="h-4 w-4" />
            <span>أرصدة المخزون</span>
          </button>
          <button
            onClick={() => {
              setTab("movements");
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              tab === "movements" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>سجل الحركات</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tab === "levels" ? (
          <div className="relative sm:col-span-2">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
            <input
              type="text"
              placeholder="بحث بالصنف أو SKU أو اسم المنتج..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input ps-9 text-xs"
            />
          </div>
        ) : (
          <div className="sm:col-span-2">
            <select
              value={movementType}
              onChange={(e) => {
                setMovementType(e.target.value);
                setPage(1);
              }}
              className="input text-xs"
            >
              <option value="all">كل أنواع الحركات...</option>
              <option value="receipt">إدخال وارد (receipt)</option>
              <option value="adjustment">تسوية جردية (adjustment)</option>
              <option value="reserve">حجز لطلب (reserve)</option>
              <option value="release">إلغاء حجز (release)</option>
              <option value="ship">شحن وتسليم (ship)</option>
            </select>
          </div>
        )}

        <div>
          <select
            value={warehouseId ?? ""}
            onChange={(e) => {
              setWarehouseId(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="input text-xs"
          >
            <option value="">جميع المخازن...</option>
            {warehouses?.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content depending on Tab */}
      {tab === "levels" ? (
        <>
          {stockLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )}

          {stockError && <ErrorBox text="فشل تحميل بيانات المخزون" onRetry={() => refetchStock()} />}

          {!stockLoading && !stockError && stockData && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-3.5 text-start font-semibold">المنتج والـ SKU</th>
                      <th className="p-3.5 text-start font-semibold">المخزن</th>
                      <th className="p-3.5 text-center font-semibold">الفعلي (On-Hand)</th>
                      <th className="p-3.5 text-center font-semibold">المحجوز (Reserved)</th>
                      <th className="p-3.5 text-center font-semibold">المتاح (Available)</th>
                      <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {stockData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted">
                          لا توجد بيانات مخزون مطابقة
                        </td>
                      </tr>
                    ) : (
                      stockData.items.map((row, idx) => {
                        const isLow = row.available <= 5;
                        return (
                          <tr key={idx} className="hover:bg-line/5 transition">
                            <td className="p-3.5">
                              <Link
                                to={`/admin/products/${row.variant.product.id}`}
                                className="font-bold text-ink hover:text-primary transition"
                                title="فتح صفحة تعديل المنتج"
                              >
                                {row.variant.product.name}
                              </Link>
                              <div className="text-[11px] text-muted flex items-center gap-2">
                                <span>{row.variant.label}</span>
                                <span className="font-mono text-[10px] bg-surface2 px-1.5 py-0.5 rounded">
                                  {row.variant.sku}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 text-muted">{row.warehouse.name}</td>
                            <td className="p-3.5 text-center font-bold text-ink">{row.onHand}</td>
                            <td className="p-3.5 text-center text-muted">{row.reserved}</td>
                            <td className="p-3.5 text-center">
                              <span
                                className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full ${
                                  isLow ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                                }`}
                              >
                                {isLow && <AlertTriangle className="h-3 w-3" />}
                                <span>{row.available}</span>
                              </span>
                            </td>
                            <td className="p-3.5 text-end">
                              <button
                                onClick={() =>
                                  handleOpenAdjust(
                                    row.variantId,
                                    row.warehouseId,
                                    row.variant.sku,
                                    row.variant.product.name
                                  )
                                }
                                className="btn-ghost text-xs px-3 py-1 h-7 text-primary border-primary/20 hover:bg-primary/10"
                              >
                                تعديل الرصيد
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 border-t border-line/10 flex items-center justify-between text-xs text-muted">
                <span>
                  إجمالي النتائج: <strong className="text-ink">{stockData.total}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="font-semibold text-ink">
                    صفحة {page} من {Math.ceil(stockData.total / stockData.pageSize) || 1}
                  </span>
                  <button
                    disabled={page * stockData.pageSize >= stockData.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Movements Log Tab */
        <>
          {movementsLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          )}

          {movementsError && <ErrorBox text="فشل تحميل سجل الحركات" onRetry={() => refetchMovements()} />}

          {!movementsLoading && !movementsError && movementsData && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-3.5 text-start font-semibold">التاريخ</th>
                      <th className="p-3.5 text-start font-semibold">نوع الحركة</th>
                      <th className="p-3.5 text-center font-semibold">الكمية</th>
                      <th className="p-3.5 text-start font-semibold">الملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {movementsData.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-muted">
                          لا توجد حركات مسجلة
                        </td>
                      </tr>
                    ) : (
                      movementsData.items.map((m) => (
                        <tr key={m.id} className="hover:bg-line/5 transition">
                          <td className="p-3.5 text-muted">{formatDate(m.createdAt)}</td>
                          <td className="p-3.5">
                            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-surface2 text-ink">
                              {MOVEMENT_TYPE_LABEL[m.type] ?? m.type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold">
                            <span className={m.qty > 0 ? "text-success" : "text-danger"}>
                              {m.qty > 0 ? `+${m.qty}` : m.qty}
                            </span>
                          </td>
                          <td className="p-3.5 text-muted">{m.note ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-md p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">تعديل رصيد المخزون</h2>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs p-3 rounded-xl bg-surface2/40 border border-line/10 space-y-1">
              <div className="font-bold text-ink">{selectedStock.productName}</div>
              <div className="text-muted font-mono">SKU: {selectedStock.sku}</div>
            </div>

            <form onSubmit={handleSaveAdjust} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">نوع العملية:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType("receipt")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      adjustType === "receipt"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    إدخال وارد (شحنة)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType("adjustment")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      adjustType === "adjustment"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    تسوية جردية
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">
                  فرق الكمية (+ للزيادة أو - للنقصان):
                </label>
                <input
                  type="number"
                  placeholder="مثال: 10 أو -5"
                  value={delta || ""}
                  onChange={(e) => setDelta(parseInt(e.target.value, 10) || 0)}
                  className="input font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">سبب التعديل / ملاحظة:</label>
                <input
                  type="text"
                  placeholder="رقم إذن الوارد أو سبب الجرد..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={delta === 0 || adjustStock.isPending}
                  className="btn-primary text-xs px-5 py-2"
                >
                  {adjustStock.isPending ? "جارٍ الحفظ..." : "تأكيد التعديل"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
