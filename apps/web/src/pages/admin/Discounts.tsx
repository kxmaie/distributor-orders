import { motion } from "framer-motion";
import {
  Calendar,
  Check,
  Edit,
  FolderTree,
  Package,
  Percent,
  Plus,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorBox, Skeleton } from "../../components/ui";
import {
  useAdminCatalogCategories,
  useAdminCatalogProducts,
  useAdminDiscounts,
  useAdminUsers,
  useDiscountMutations,
} from "../../hooks/adminQueries";
import { formatDate } from "../../lib/format";
import type { Discount } from "../../lib/types";
import { useUI } from "../../store/ui";

export default function AdminDiscounts() {
  const push = useUI((s) => s.push);
  const [page, setPage] = useState<number>(1);

  const { data: discountsData, isLoading, error, refetch } = useAdminDiscounts({ page });
  const { data: usersData } = useAdminUsers({ pageSize: 100 });
  const { data: categories } = useAdminCatalogCategories();
  const { data: productsData } = useAdminCatalogProducts({ pageSize: 100 });

  const mutations = useDiscountMutations();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<Discount | null>(null);

  // Form state
  const [targetType, setTargetType] = useState<"user" | "category" | "product">("user");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [pct, setPct] = useState<string>("5");
  const [startsAt, setStartsAt] = useState<string>("");
  const [endsAt, setEndsAt] = useState<string>("");

  const openNewDiscount = () => {
    setEditingDiscount(null);
    setTargetType("user");
    setSelectedUserId(usersData?.items?.[0]?.id ?? "");
    setSelectedCategoryId(undefined);
    setSelectedProductId("");
    setPct("5");
    setStartsAt("");
    setEndsAt("");
    setModalOpen(true);
  };

  const handleSaveDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const p = parseFloat(pct);
      if (isNaN(p) || p <= 0 || p > 100) {
        push("يرجى إدخال نسبة مئوية صحيحة بين 0.01 و 100", "info");
        return;
      }

      const body = {
        pct: pct.trim(),
        userId: targetType === "user" ? selectedUserId || null : null,
        categoryId: targetType === "category" ? selectedCategoryId || null : null,
        productId: targetType === "product" ? selectedProductId || null : null,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isActive: true,
      };

      if (editingDiscount) {
        await mutations.updateDiscount.mutateAsync({
          id: editingDiscount.id,
          pct: body.pct,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
        });
        push("تم تعديل قاعدة الخصم بنجاح", "success");
      } else {
        await mutations.createDiscount.mutateAsync(body);
        push("تم إنشاء قاعدة الخصم بنجاح", "success");
      }
      setModalOpen(false);
    } catch {
      push("فشل حفظ قاعدة الخصم، تأكد من صحة المدخلات", "danger");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">الخصومات والعروض المخصصة</h1>
          <p className="text-sm text-muted">إدارة قواعد الخصم الموجهة لموزع معين، تصنيف، أو منتج</p>
        </div>

        <button onClick={openNewDiscount} className="btn-primary text-xs px-3.5 py-2">
          <Plus className="h-4 w-4" />
          <span>إضافة قاعدة خصم</span>
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {error && <ErrorBox text="فشل تحميل قائمة الخصومات" onRetry={() => refetch()} />}

      {!isLoading && !error && discountsData && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-surface2/60 text-muted border-b border-line/10">
                <tr>
                  <th className="p-3.5 text-start font-semibold">نطاق الخصم (الهدف)</th>
                  <th className="p-3.5 text-center font-semibold">نسبة الخصم</th>
                  <th className="p-3.5 text-center font-semibold">فترة الصلاحية</th>
                  <th className="p-3.5 text-center font-semibold">الحالة</th>
                  <th className="p-3.5 text-end font-semibold">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {discountsData.items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted">
                      لا توجد قواعد خصم مخصصة حتى الآن
                    </td>
                  </tr>
                ) : (
                  discountsData.items.map((d) => (
                    <tr key={d.id} className="hover:bg-line/5 transition">
                      <td className="p-3.5">
                        {d.user && (
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-primary/10 text-primary">
                              <User className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-ink">{d.user.fullName}</div>
                              <div className="text-[11px] text-muted">@{d.user.username}</div>
                            </div>
                          </div>
                        )}
                        {d.category && (
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-accent/10 text-accent">
                              <FolderTree className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-ink">{d.category.name}</div>
                              <div className="text-[11px] text-muted">تصنيف كامل</div>
                            </div>
                          </div>
                        )}
                        {d.product && (
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded bg-surface2 text-muted">
                              <Package className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-bold text-ink">{d.product.name}</div>
                              <div className="text-[11px] text-muted">منتج محدد</div>
                            </div>
                          </div>
                        )}
                        {!d.user && !d.category && !d.product && (
                          <span className="text-muted italic">خصم عام على كافة المنتجات</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-sm text-accent">
                        {d.pct}%
                      </td>
                      <td className="p-3.5 text-center text-muted">
                        {d.startsAt || d.endsAt ? (
                          <div className="text-[11px]">
                            {d.startsAt && <span>من {formatDate(d.startsAt)}</span>}
                            {d.endsAt && <span> إلى {formatDate(d.endsAt)}</span>}
                          </div>
                        ) : (
                          <span className="text-success font-semibold">دائم / غير محدد بمدة</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                          }`}
                        >
                          {d.isActive ? "نشط" : "معطل"}
                        </span>
                      </td>
                      <td className="p-3.5 text-end">
                        {d.isActive && (
                          <button
                            onClick={async () => {
                              if (confirm("هل تريد تعطيل قاعدة الخصم هذه؟")) {
                                await mutations.deleteDiscount.mutateAsync(d.id);
                                push("تم تعطيل الخصم", "info");
                              }
                            }}
                            className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-danger"
                            title="تعطيل"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Discount Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-md p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">
                {editingDiscount ? "تعديل قاعدة الخصم" : "إضافة قاعدة خصم جديدة"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDiscount} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">تطبيق الخصم على:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("user")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      targetType === "user"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    موزع محدد
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("category")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      targetType === "category"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    تصنيف كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("product")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      targetType === "product"
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    منتج محدد
                  </button>
                </div>
              </div>

              {/* Selector depending on targetType */}
              {targetType === "user" && (
                <div>
                  <label className="block text-muted mb-1 font-semibold">اختر الموزع:</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    <option value="">اختر موزع...</option>
                    {usersData?.items?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} (@{u.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "category" && (
                <div>
                  <label className="block text-muted mb-1 font-semibold">اختر التصنيف:</label>
                  <select
                    value={selectedCategoryId ?? ""}
                    onChange={(e) => setSelectedCategoryId(Number(e.target.value))}
                    className="input text-xs"
                    required
                  >
                    <option value="">اختر تصنيف...</option>
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "product" && (
                <div>
                  <label className="block text-muted mb-1 font-semibold">اختر المنتج:</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    <option value="">اختر منتج...</option>
                    {productsData?.items?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-muted mb-1 font-semibold">نسبة الخصم (%):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="100"
                  placeholder="مثال: 12.5"
                  value={pct}
                  onChange={(e) => setPct(e.target.value)}
                  className="input font-mono font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1 font-semibold">يبدأ في (اختياري):</label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1 font-semibold">ينتهي في (اختياري):</label>
                  <input
                    type="date"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  {editingDiscount ? "تعديل الخصم" : "حفظ الخصم"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
