import { motion } from "framer-motion";
import {
  Boxes,
  Check,
  Edit,
  FolderTree,
  Layers,
  Plus,
  Search,
  Trash2,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorBox, Skeleton } from "../../components/ui";
import {
  useAdminCatalogCategories,
  useAdminCatalogProducts,
  useAdminWarehouses,
  useCatalogMutations,
} from "../../hooks/adminQueries";
import { formatCurrency } from "../../lib/format";
import type { AdminCategory, AdminProduct, AdminVariant, Warehouse } from "../../lib/types";
import { useUI } from "../../store/ui";

export default function AdminCatalog() {
  const push = useUI((s) => s.push);
  const [tab, setTab] = useState<"products" | "categories" | "warehouses">("products");

  // Filters for products
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Queries
  const { data: categories, isLoading: catLoading } = useAdminCatalogCategories();
  const { data: warehouses, isLoading: whLoading } = useAdminWarehouses();
  const {
    data: productsData,
    isLoading: prodLoading,
    error: prodError,
    refetch: refetchProducts,
  } = useAdminCatalogProducts({
    category: categoryFilter || undefined,
    q: search.trim() || undefined,
    page,
    pageSize: 12,
  });

  const mutations = useCatalogMutations();

  // Modal states
  const [productModalOpen, setProductModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const [warehouseModalOpen, setWarehouseModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  const [variantsModalOpen, setVariantsModalOpen] = useState<boolean>(false);
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<AdminProduct | null>(null);

  // Product form state
  const [pName, setPName] = useState("");
  const [pCategory, setPCategory] = useState<number>(1);
  const [pDesc, setPDesc] = useState("");
  const [pImg, setPImg] = useState("");
  const [pBasePrice, setPBasePrice] = useState("");
  const [pUnit, setPUnit] = useState<"piece" | "meter" | "sqm">("piece");

  // Category form state
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catSort, setCatSort] = useState(0);

  // Warehouse form state
  const [whName, setWhName] = useState("");

  // Variant form state
  const [varSku, setVarSku] = useState("");
  const [varLabel, setVarLabel] = useState("");
  const [varPriceDelta, setVarPriceDelta] = useState("0");

  const openNewProduct = () => {
    setEditingProduct(null);
    setPName("");
    setPCategory(categories?.[0]?.id ?? 1);
    setPDesc("");
    setPImg("");
    setPBasePrice("");
    setPUnit("piece");
    setProductModalOpen(true);
  };

  const openEditProduct = (p: AdminProduct) => {
    setEditingProduct(p);
    setPName(p.name);
    setPCategory(p.categoryId);
    setPDesc(p.description || "");
    setPImg(p.imageUrl || "");
    setPBasePrice(p.basePrice);
    setPUnit(p.unit);
    setProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await mutations.updateProduct.mutateAsync({
          id: editingProduct.id,
          name: pName,
          categoryId: pCategory,
          description: pDesc.trim() || null,
          imageUrl: pImg.trim() || null,
          basePrice: pBasePrice,
          unit: pUnit,
        });
        push("تم تحديث بيانات المنتج بنجاح", "success");
      } else {
        await mutations.createProduct.mutateAsync({
          name: pName,
          categoryId: pCategory,
          description: pDesc.trim() || null,
          imageUrl: pImg.trim() || null,
          basePrice: pBasePrice,
          unit: pUnit,
        });
        push("تم إنشاء المنتج بنجاح", "success");
      }
      setProductModalOpen(false);
    } catch {
      push("فشل حفظ المنتج، تأكد من صحة البيانات المدخلة", "danger");
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await mutations.updateCategory.mutateAsync({
          id: editingCategory.id,
          name: catName,
          slug: catSlug || undefined,
          sortOrder: catSort,
        });
        push("تم تعديل التصنيف بنجاح", "success");
      } else {
        await mutations.createCategory.mutateAsync({
          name: catName,
          slug: catSlug || undefined,
          sortOrder: catSort,
        });
        push("تم إنشاء التصنيف بنجاح", "success");
      }
      setCategoryModalOpen(false);
    } catch {
      push("فشل حفظ التصنيف", "danger");
    }
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await mutations.updateWarehouse.mutateAsync({
          id: editingWarehouse.id,
          name: whName,
        });
        push("تم تعديل بيانات المخزن", "success");
      } else {
        await mutations.createWarehouse.mutateAsync({ name: whName });
        push("تمت إضافة المخزن بنجاح", "success");
      }
      setWarehouseModalOpen(false);
    } catch {
      push("فشل حفظ المخزن", "danger");
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForVariants) return;
    try {
      await mutations.createVariant.mutateAsync({
        productId: selectedProductForVariants.id,
        sku: varSku.trim(),
        label: varLabel.trim(),
        priceDelta: varPriceDelta.trim() || "0",
      });
      push("تمت إضافة المقاس بنجاح", "success");
      setVarSku("");
      setVarLabel("");
      setVarPriceDelta("0");
    } catch {
      push("فشل إضافة المقاس، تأكد من عدم تكرار الـ SKU", "danger");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">إدارة الكتالوج والمنتجات</h1>
          <p className="text-sm text-muted">إضافة وتعديل المنتجات، المقاسات، التصنيفات، والمخازن</p>
        </div>

        <div className="flex items-center gap-2">
          {tab === "products" && (
            <button onClick={openNewProduct} className="btn-primary text-xs px-3.5 py-2">
              <Plus className="h-4 w-4" />
              <span>إضافة منتج</span>
            </button>
          )}
          {tab === "categories" && (
            <button
              onClick={() => {
                setEditingCategory(null);
                setCatName("");
                setCatSlug("");
                setCatSort(0);
                setCategoryModalOpen(true);
              }}
              className="btn-primary text-xs px-3.5 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة تصنيف</span>
            </button>
          )}
          {tab === "warehouses" && (
            <button
              onClick={() => {
                setEditingWarehouse(null);
                setWhName("");
                setWarehouseModalOpen(true);
              }}
              className="btn-primary text-xs px-3.5 py-2"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة مخزن</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => {
            setTab("products");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
            tab === "products" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>المنتجات</span>
        </button>
        <button
          onClick={() => {
            setTab("categories");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
            tab === "categories" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <FolderTree className="h-4 w-4" />
          <span>التصنيفات ({categories?.length ?? 0})</span>
        </button>
        <button
          onClick={() => {
            setTab("warehouses");
            setPage(1);
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
            tab === "warehouses" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <WarehouseIcon className="h-4 w-4" />
          <span>المخازن ({warehouses?.length ?? 0})</span>
        </button>
      </div>

      {/* ================= PRODUCTS TAB ================= */}
      {tab === "products" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="بحث باسم المنتج أو الوصف..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input ps-9 text-xs"
              />
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
              >
                <option value="">جميع التصنيفات...</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {prodLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {prodError && <ErrorBox text="فشل تحميل المنتجات" onRetry={() => refetchProducts()} />}

          {!prodLoading && !prodError && productsData && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-3.5 text-start font-semibold">المنتج</th>
                      <th className="p-3.5 text-start font-semibold">التصنيف</th>
                      <th className="p-3.5 text-center font-semibold">السعر الأساسي</th>
                      <th className="p-3.5 text-center font-semibold">الوحدة</th>
                      <th className="p-3.5 text-center font-semibold">المقاسات (Variants)</th>
                      <th className="p-3.5 text-center font-semibold">الحالة</th>
                      <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {productsData.items.map((prod) => (
                      <tr key={prod.id} className="hover:bg-line/5 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-ink">{prod.name}</div>
                          {prod.description && (
                            <div className="text-[11px] text-muted truncate max-w-xs">{prod.description}</div>
                          )}
                        </td>
                        <td className="p-3.5 text-muted">{prod.category.name}</td>
                        <td className="p-3.5 text-center font-bold text-primary font-mono">
                          {formatCurrency(prod.basePrice)}
                        </td>
                        <td className="p-3.5 text-center text-muted">
                          {prod.unit === "piece" ? "قطعة" : prod.unit === "meter" ? "متر" : "م²"}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => {
                              setSelectedProductForVariants(prod);
                              setVariantsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                          >
                            <span>{prod.variants.length} مقاسات</span>
                          </button>
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              prod.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                            }`}
                          >
                            {prod.isActive ? "نشط" : "معطل"}
                          </span>
                        </td>
                        <td className="p-3.5 text-end">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditProduct(prod)}
                              className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                              title="تعديل المنتج"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            {prod.isActive && (
                              <button
                                onClick={async () => {
                                  if (confirm(`هل أنت متأكد من تعطيل المنتج "${prod.name}"؟`)) {
                                    await mutations.deleteProduct.mutateAsync(prod.id);
                                    push("تم تعطيل المنتج", "info");
                                  }
                                }}
                                className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-danger"
                                title="تعطيل"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 border-t border-line/10 flex items-center justify-between text-xs text-muted">
                <span>
                  إجمالي المنتجات: <strong className="text-ink">{productsData.total}</strong>
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
                    صفحة {page} من {Math.ceil(productsData.total / productsData.pageSize) || 1}
                  </span>
                  <button
                    disabled={page * productsData.pageSize >= productsData.total}
                    onClick={() => setPage((p) => p + 1)}
                    className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= CATEGORIES TAB ================= */}
      {tab === "categories" && (
        <div className="card overflow-hidden">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface2/60 text-muted border-b border-line/10">
              <tr>
                <th className="p-3.5 text-start font-semibold">اسم التصنيف</th>
                <th className="p-3.5 text-start font-semibold">المعرف اللاتيني (Slug)</th>
                <th className="p-3.5 text-center font-semibold">الترتيب</th>
                <th className="p-3.5 text-center font-semibold">الحالة</th>
                <th className="p-3.5 text-end font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/10">
              {categories?.map((cat) => (
                <tr key={cat.id} className="hover:bg-line/5 transition">
                  <td className="p-3.5 font-bold text-ink">{cat.name}</td>
                  <td className="p-3.5 font-mono text-muted">{cat.slug}</td>
                  <td className="p-3.5 text-center font-mono">{cat.sortOrder}</td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cat.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {cat.isActive ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="p-3.5 text-end">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCatName(cat.name);
                          setCatSlug(cat.slug);
                          setCatSort(cat.sortOrder);
                          setCategoryModalOpen(true);
                        }}
                        className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                        title="تعديل"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= WAREHOUSES TAB ================= */}
      {tab === "warehouses" && (
        <div className="card overflow-hidden">
          <table className="w-full text-xs text-start">
            <thead className="bg-surface2/60 text-muted border-b border-line/10">
              <tr>
                <th className="p-3.5 text-start font-semibold">اسم المخزن</th>
                <th className="p-3.5 text-center font-semibold">الحالة</th>
                <th className="p-3.5 text-end font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/10">
              {warehouses?.map((wh) => (
                <tr key={wh.id} className="hover:bg-line/5 transition">
                  <td className="p-3.5 font-bold text-ink">{wh.name}</td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        wh.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {wh.isActive ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="p-3.5 text-end">
                    <button
                      onClick={() => {
                        setEditingWarehouse(wh);
                        setWhName(wh.name);
                        setWarehouseModalOpen(true);
                      }}
                      className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                      title="تعديل"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* Product Create / Edit Modal */}
      {productModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-lg p-6 bg-surface shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">
                {editingProduct ? "تعديل بيانات المنتج" : "إضافة منتج جديد"}
              </h2>
              <button
                onClick={() => setProductModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">اسم المنتج:</label>
                <input
                  type="text"
                  placeholder="مثال: شباك UPVC مفصلي مزدوج"
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1 font-semibold">التصنيف:</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(Number(e.target.value))}
                    className="input text-xs"
                    required
                  >
                    {categories?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-muted mb-1 font-semibold">وحدة القياس:</label>
                  <select
                    value={pUnit}
                    onChange={(e) => setPUnit(e.target.value as any)}
                    className="input text-xs"
                  >
                    <option value="piece">قطعة (piece)</option>
                    <option value="meter">متر طولي (meter)</option>
                    <option value="sqm">متر مربع (sqm)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">السعر الأساسي (ج.م):</label>
                <input
                  type="text"
                  placeholder="مثال: 1500.00"
                  value={pBasePrice}
                  onChange={(e) => setPBasePrice(e.target.value)}
                  className="input font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">رابط الصورة (اختياري):</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={pImg}
                  onChange={(e) => setPImg(e.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">وصف المنتج:</label>
                <textarea
                  placeholder="تفاصيل ومواصفات المنتج..."
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  className="input h-20 py-2 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  حفظ المنتج
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Category Create / Edit Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">
                {editingCategory ? "تعديل التصنيف" : "إضافة تصنيف جديد"}
              </h2>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">اسم التصنيف:</label>
                <input
                  type="text"
                  placeholder="مثال: شبابيك مفصلية"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">المعرف اللاتيني (Slug - اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: casement-windows"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">ترتيب العرض:</label>
                <input
                  type="number"
                  value={catSort}
                  onChange={(e) => setCatSort(Number(e.target.value))}
                  className="input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  حفظ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Warehouse Modal */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">
                {editingWarehouse ? "تعديل المخزن" : "إضافة مخزن جديد"}
              </h2>
              <button
                onClick={() => setWarehouseModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">اسم المخزن:</label>
                <input
                  type="text"
                  placeholder="مثال: مخزن طنطا الرئيسي"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  حفظ
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Variants Management Modal */}
      {variantsModalOpen && selectedProductForVariants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-xl p-6 bg-surface shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <div>
                <h2 className="text-base font-bold text-ink">إدارة المقاسات والخيارات (Variants)</h2>
                <div className="text-xs text-muted">{selectedProductForVariants.name}</div>
              </div>
              <button
                onClick={() => setVariantsModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* List of existing variants */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-muted">المقاسات الحالية:</h3>
              <div className="border border-line/10 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-2.5 text-start font-semibold">الوصف / المقاس</th>
                      <th className="p-2.5 text-start font-semibold">SKU</th>
                      <th className="p-2.5 text-center font-semibold">فارق السعر</th>
                      <th className="p-2.5 text-end font-semibold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {selectedProductForVariants.variants.map((v) => (
                      <tr key={v.id}>
                        <td className="p-2.5 font-semibold text-ink">{v.label}</td>
                        <td className="p-2.5 font-mono text-muted">{v.sku}</td>
                        <td className="p-2.5 text-center font-mono">
                          {Number(v.priceDelta) > 0
                            ? `+${v.priceDelta}`
                            : Number(v.priceDelta) < 0
                            ? v.priceDelta
                            : "0.00"}{" "}
                          ج.م
                        </td>
                        <td className="p-2.5 text-end">
                          {v.isActive && (
                            <button
                              onClick={async () => {
                                if (confirm(`هل أنت متأكد من حذف/تعطيل المقاس "${v.label}"؟`)) {
                                  await mutations.deleteVariant.mutateAsync(v.id);
                                  push("تم تعطيل المقاس", "info");
                                  // update local view
                                  setSelectedProductForVariants({
                                    ...selectedProductForVariants,
                                    variants: selectedProductForVariants.variants.filter((x) => x.id !== v.id),
                                  });
                                }
                              }}
                              className="btn-ghost p-1 h-6 w-6 text-muted hover:text-danger"
                              title="حذف"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add new variant form */}
            <form onSubmit={handleAddVariant} className="p-4 rounded-xl border border-line/10 bg-surface2/30 space-y-3 text-xs">
              <h3 className="font-bold text-ink">إضافة مقاس جديد:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-muted mb-1">المقاس / الوصف:</label>
                  <input
                    type="text"
                    placeholder="مثال: 120x150 أبيض"
                    value={varLabel}
                    onChange={(e) => setVarLabel(e.target.value)}
                    className="input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">رمز الـ SKU:</label>
                  <input
                    type="text"
                    placeholder="WIN-120-W"
                    value={varSku}
                    onChange={(e) => setVarSku(e.target.value)}
                    className="input text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-muted mb-1">فارق السعر (+ أو -):</label>
                  <input
                    type="text"
                    placeholder="مثال: 150 أو 0"
                    value={varPriceDelta}
                    onChange={(e) => setVarPriceDelta(e.target.value)}
                    className="input text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="btn-primary text-xs px-4 py-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  <span>إضافة هذا المقاس</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
