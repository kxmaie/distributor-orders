import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Boxes, Check, Edit, Package, PackageCheck, Plus, RotateCcw, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorBox, Modal, Skeleton, Spinner } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { UNIT_LABEL } from "../../lib/format";
import { useUI } from "../../store/ui";
import type { AdminCategory, AdminProduct, AdminVariant, Warehouse } from "../../lib/types";
import ImageUploadField from "../../components/admin/ImageUploadField";

export default function AdminProductEdit() {
  const { id = "" } = useParams();
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const [imageUrl, setImageUrl] = useState("");
  const [editUnit, setEditUnit] = useState("piece");

  // Modals state
  const [varOpen, setVarOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);
  const [stockModalVariant, setStockModalVariant] = useState<AdminVariant | null>(null);

  // Stock Adjust State inside modal
  const [selectedWhId, setSelectedWhId] = useState<number | undefined>(undefined);
  const [stockMode, setStockMode] = useState<"add" | "set">("add");
  const [stockQty, setStockQty] = useState<number>(10);
  const [stockNote, setStockNote] = useState<string>("");

  const p = useQuery({
    queryKey: ["admin-product", id],
    queryFn: () => api.get<AdminProduct>(`/admin/products/${id}`),
  });
  useEffect(() => { if (p.data) { setImageUrl(p.data.imageUrl ?? ""); setEditUnit(p.data.unit); } }, [p.data?.id, p.data?.imageUrl, p.data?.unit]);
  const units = useQuery({ queryKey: ["units"], queryFn: () => api.get<{ name: string; label: string }[]>("/units") });
  const cats = useQuery({
    queryKey: ["admin-cats"],
    queryFn: () => api.get<AdminCategory[]>("/admin/categories"),
  });
  const whs = useQuery({
    queryKey: ["admin-wh"],
    queryFn: () => api.get<Warehouse[]>("/admin/warehouses"),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-product", id] });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["admin", "stock"] });
    qc.invalidateQueries({ queryKey: ["admin", "movements"] });
  };

  const saveProduct = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/admin/products/${id}`, body),
    onSuccess: () => {
      push("تم حفظ بيانات المنتج بنجاح", "ok");
      invalidate();
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const addVariant = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/admin/variants", body),
    onSuccess: () => {
      push("تمت إضافة المقاس ورصيده بنجاح", "ok");
      setVarOpen(false);
      invalidate();
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const updateVariant = useMutation({
    mutationFn: ({ vid, body }: { vid: string; body: Record<string, unknown> }) =>
      api.patch(`/admin/variants/${vid}`, body),
    onSuccess: () => {
      push("تم تحديث المقاس بنجاح", "ok");
      setEditingVariant(null);
      invalidate();
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const deleteVariant = useMutation({
    mutationFn: (vid: string) => api.del(`/admin/variants/${vid}`),
    onSuccess: () => {
      push("تم إيقاف المقاس", "ok");
      invalidate();
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const adjustStock = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/admin/stock/adjust", body),
    onSuccess: () => {
      push("تم تعديل كمية المخزون وتسجيل الحركة بنجاح", "ok");
      setStockModalVariant(null);
      invalidate();
    },
    onError: (e) => push(errorText(e), "err"),
  });

  function onSaveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const selectedUnit = String(f.get("unit"));
    saveProduct.mutate({
      categoryId: Number(f.get("categoryId")),
      name: String(f.get("name")),
      description: String(f.get("description") || "") || null,
      imageUrl: String(f.get("imageUrl") || "") || null,
      basePrice: String(f.get("basePrice")),
      unit: selectedUnit,
      piecesPerUnit: selectedUnit === "carton" ? Number(f.get("piecesPerUnit") || 1) : 1,
      isActive: f.get("isActive") === "on",
    });
  }

  function onAddVariant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const whId = f.get("warehouseId");
    const initStock = f.get("initialStock");
    addVariant.mutate({
      productId: id,
      sku: String(f.get("sku") || "").trim() || undefined,
      label: String(f.get("label")).trim(),
      priceDelta: String(f.get("priceDelta") || "0"),
      warehouseId: whId ? Number(whId) : undefined,
      initialStock: initStock ? Number(initStock) : 0,
    });
  }

  function onEditVariantSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingVariant) return;
    const f = new FormData(e.currentTarget);
    updateVariant.mutate({
      vid: editingVariant.id,
      body: {
        sku: String(f.get("sku")).trim(),
        label: String(f.get("label")).trim(),
        priceDelta: String(f.get("priceDelta") || "0"),
        isActive: f.get("isActive") === "on",
      },
    });
  }

  function onSaveStockAdjust(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stockModalVariant) return;
    const targetWh = selectedWhId ?? whs.data?.[0]?.id;
    if (!targetWh) {
      push("يرجى اختيار مخزن", "err");
      return;
    }

    const currentLevel = stockModalVariant.stockLevels?.find((s) => s.warehouseId === targetWh);
    const currentOnHand = currentLevel?.onHand ?? 0;
    const reserved = currentLevel?.reserved ?? 0;

    let delta = 0;
    let type: "receipt" | "adjustment" = "adjustment";

    if (stockMode === "add") {
      delta = stockQty;
      type = delta > 0 ? "receipt" : "adjustment";
    } else {
      // Set to direct balance
      delta = stockQty - currentOnHand;
      type = "adjustment";
    }

    if (delta === 0) {
      push("الرصيد لم يتغير، الكمية المدخلة مطابقة للرصيد الحالي", "info");
      setStockModalVariant(null);
      return;
    }

    if (currentOnHand + delta < reserved) {
      push(`لا يمكن تقليل الرصيد لأقل من الكمية المحجوزة (${reserved})`, "err");
      return;
    }

    adjustStock.mutate({
      variantId: stockModalVariant.id,
      warehouseId: targetWh,
      delta,
      type,
      note: stockNote.trim() || (stockMode === "add" ? "توريد بضاعة للمقاس" : "تسوية جردية مباشرة"),
    });
  }

  const openStockModal = (v: AdminVariant) => {
    setStockModalVariant(v);
    // Pick the warehouse that already has stock, or fall back to first active wh
    const whWithStock = v.stockLevels?.find((s) => s.onHand > 0)?.warehouseId;
    const defaultWh = whWithStock ?? whs.data?.[0]?.id;
    setSelectedWhId(defaultWh);
    const current = v.stockLevels?.find((s) => s.warehouseId === defaultWh)?.onHand ?? 0;
    setStockQty(current);
    setStockMode("set");
    setStockNote("");
  };

  if (p.isLoading) return <Skeleton className="h-64" />;
  if (p.isError || !p.data) return <ErrorBox text={errorText(p.error)} onRetry={() => p.refetch()} />;
  const prod = p.data;

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link
            to="/admin/products"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink transition mb-2"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>العودة لقائمة المنتجات</span>
          </Link>
          <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary shadow-glow"><Package className="h-5 w-5" /></span><h1 className="font-display text-2xl font-extrabold">{prod.name}</h1></div>
          <p className="text-xs text-muted">تعديل بيانات المنتج، المقاسات، والتحكم بأرصدة المخزون في كل فرع</p>
        </div>
      </div>

      {/* Product Details Form */}
      <form className="card grid gap-4 p-5 md:grid-cols-2 text-xs" onSubmit={onSaveProduct}>
        <div className="md:col-span-2 font-bold text-sm text-ink border-b border-line/10 pb-2 flex items-center justify-between">
          <span className="flex items-center gap-2"><PackageCheck className="h-4 w-4 text-primary" />بيانات المنتج الأساسية</span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              prod.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            }`}
          >
            {prod.isActive ? "المنتج نشط" : "المنتج موقوف"}
          </span>
        </div>

        <label className="label md:col-span-2">
          اسم المنتج
          <input name="name" className="input" defaultValue={prod.name} required maxLength={160} />
        </label>

        <label className="label">
          التصنيف
          <select name="categoryId" className="input text-xs" defaultValue={prod.category.id}>
            {cats.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          الوحدة
          <select name="unit" className="input text-xs" value={editUnit} onChange={(e) => setEditUnit(e.target.value)}>
            {(units.data ?? []).map((u) => (
              <option key={u.name} value={u.name}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <label className="label">
          سعر القطعة
          <input
            name="basePrice"
            className="input font-mono"
            dir="ltr"
            defaultValue={String(prod.basePrice)}
            required
          />
        </label>

        {editUnit === "carton" && <label className="label">عدد القطع في الكرتونة<input name="piecesPerUnit" className="input" type="number" min="1" max="100000" defaultValue={prod.piecesPerUnit > 1 ? prod.piecesPerUnit : 100} required /></label>}

        <label className="label">

          صورة المنتج (اختياري)
          <ImageUploadField value={imageUrl} onChange={setImageUrl} />
        </label>

        <label className="label md:col-span-2">
          الوصف
          <textarea
            name="description"
            className="input min-h-[4rem] py-2"
            defaultValue={prod.description ?? ""}
          />
        </label>

        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" name="isActive" defaultChecked={prod.isActive} className="checkbox" />
          <span>المنتج نشط ومتاح في كتالوج الموزعين</span>
        </label>

        <div className="md:col-span-2 pt-2">
          <button className="btn-primary" disabled={saveProduct.isPending}>
            {saveProduct.isPending ? <Spinner /> : "حفظ بيانات المنتج"}
          </button>
        </div>
      </form>

      {/* Variants & Stock Management Section */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Boxes className="h-5 w-5 text-primary" />
              <span>المقاسات وأرصدة المخزون (Variants & Stock)</span>
            </h2>
            <p className="text-xs text-muted">
              رؤية وتعديل كميات المخزون المتاحة للمقاسات في كل مخزن مع تسجيل الحركات تلقائياً
            </p>
          </div>
          <button className="btn-primary text-xs" onClick={() => setVarOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>إضافة مقاس جديد</span>
          </button>
        </div>

        {prod.variants.length === 0 && (
          <div className="card p-6 text-center text-muted text-xs space-y-2">
            <p>لا توجد مقاسات مسجلة لهذا المنتج بعد.</p>
            <button className="btn-ghost text-xs text-primary" onClick={() => setVarOpen(true)}>
              + إضافة المقاس الأساسي مع الرصيد
            </button>
          </div>
        )}

        {prod.variants.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface2/60 text-muted border-b border-line/10">
                  <tr>
                    <th className="p-3.5 text-start font-semibold">كود الصنف (SKU)</th>
                    <th className="p-3.5 text-start font-semibold">المقاس / الوصف</th>
                    <th className="p-3.5 text-center font-semibold">فرق السعر</th>
                    <th className="p-3.5 text-start font-semibold">أرصدة المخازن (On-Hand)</th>
                    <th className="p-3.5 text-center font-semibold">الحالة</th>
                    <th className="p-3.5 text-end font-semibold">إجراءات المخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {prod.variants.map((v) => {
                    const totalOnHand = v.stockLevels?.reduce((acc, s) => acc + (s.onHand || 0), 0) ?? 0;
                    const totalReserved = v.stockLevels?.reduce((acc, s) => acc + (s.reserved || 0), 0) ?? 0;
                    const totalAvail = totalOnHand - totalReserved;

                    return (
                      <tr key={v.id} className={`hover:bg-line/5 transition ${!v.isActive ? "opacity-60 bg-line/5" : ""}`}>
                        <td className="p-3.5 font-mono font-bold text-ink" dir="ltr">
                          {v.sku}
                        </td>
                        <td className="p-3.5 font-semibold">{v.label}</td>
                        <td className="p-3.5 text-center font-mono" dir="ltr">
                          {Number(v.priceDelta) > 0 ? `+${v.priceDelta}` : v.priceDelta}
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-1">
                            {/* Break down per warehouse */}
                            {v.stockLevels && v.stockLevels.length > 0 ? (
                              v.stockLevels.map((sl) => {
                                const avail = sl.onHand - sl.reserved;
                                return (
                                  <div
                                    key={sl.warehouseId}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-surface2/80 border border-line/10 text-[11px] me-1.5"
                                  >
                                    <span className="font-semibold text-ink">{sl.warehouse.name}:</span>
                                    <span className={`font-mono font-bold ${avail > 0 ? "text-primary" : "text-muted"}`}>
                                      {avail} متاح
                                    </span>
                                    {sl.reserved > 0 && (
                                      <span className="text-[10px] text-danger">({sl.reserved} محجوز)</span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <span className="text-muted text-[11px]">لا يوجد رصيد مسجل</span>
                            )}
                            <div className="text-[10px] text-muted">
                              الإجمالي: <strong className="text-ink">{totalOnHand}</strong> فعلي ({totalAvail} متاح)
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                            }`}
                          >
                            {v.isActive ? "نشط" : "معطل"}
                          </span>
                        </td>
                        <td className="p-3.5 text-end">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openStockModal(v)}
                              className="btn-ghost px-2.5 py-1 text-xs text-primary hover:bg-primary/10 inline-flex items-center gap-1 font-bold"
                              title="تعديل المخزون والتوريد"
                            >
                              <WarehouseIcon className="h-3.5 w-3.5" />
                              <span>ضبط المخزون</span>
                            </button>
                            <button
                              onClick={() => setEditingVariant(v)}
                              className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                              title="تعديل المقاس"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => deleteVariant.mutate(v.id)}
                              className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-danger"
                              title="إيقاف المقاس"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Modal: Add New Variant with Initial Stock */}
      <Modal open={varOpen} title="إضافة مقاس جديد مع المخزون" onClose={() => setVarOpen(false)}>
        <form className="space-y-3 text-xs" onSubmit={onAddVariant}>
          <label className="label">
            المقاس / الوصف
            <input
              name="label"
              className="input"
              required
              placeholder="مثال: 120×150 أبيض أو كبير"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              كود الصنف (SKU)
              <input
                name="sku"
                className="input font-mono"
                dir="ltr"
                placeholder="توليد تلقائي إذا تُرك فارغاً"
              />
            </label>
            <label className="label">
              فرق السعر عن الأساسي
              <input name="priceDelta" className="input font-mono" dir="ltr" defaultValue="0" />
            </label>
          </div>

          <div className="p-3 bg-surface2/60 border border-line/10 rounded-xl space-y-3">
            <p className="font-bold text-ink flex items-center gap-1.5">
              <Boxes className="h-4 w-4 text-primary" />
              <span>الرصيد الافتتاحي للمقاس</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">
                المخزن
                <select name="warehouseId" className="input text-xs">
                  {whs.data
                    ?.filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="label">
                الكمية الأولية
                <input
                  name="initialStock"
                  type="number"
                  min="0"
                  defaultValue={0}
                  className="input font-mono font-bold"
                  dir="ltr"
                />
              </label>
            </div>
          </div>

          <button className="btn-primary w-full mt-2" disabled={addVariant.isPending}>
            {addVariant.isPending ? <Spinner /> : "إضافة المقاس وتحديث المخزن"}
          </button>
        </form>
      </Modal>

      {/* Modal: Edit Existing Variant */}
      <Modal open={!!editingVariant} title="تعديل المقاس" onClose={() => setEditingVariant(null)}>
        {editingVariant && (
          <form className="space-y-3 text-xs" onSubmit={onEditVariantSubmit}>
            <label className="label">
              المقاس / الوصف
              <input
                name="label"
                className="input"
                defaultValue={editingVariant.label}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">
                كود الصنف (SKU)
                <input
                  name="sku"
                  className="input font-mono"
                  dir="ltr"
                  defaultValue={editingVariant.sku}
                  required
                />
              </label>
              <label className="label">
                فرق السعر عن الأساسي
                <input
                  name="priceDelta"
                  className="input font-mono"
                  dir="ltr"
                  defaultValue={String(editingVariant.priceDelta)}
                />
              </label>
            </div>

            {/* Stock Levels Summary */}
            {editingVariant.stockLevels && editingVariant.stockLevels.length > 0 && (
              <div className="p-3 bg-surface2/60 border border-line/10 rounded-xl space-y-2">
                <p className="font-bold text-ink flex items-center gap-1.5 text-[11px]">
                  <WarehouseIcon className="h-3.5 w-3.5 text-primary" />
                  <span>أرصدة المخازن الحالية</span>
                </p>
                <div className="space-y-1">
                  {editingVariant.stockLevels.map((sl) => {
                    const avail = sl.onHand - sl.reserved;
                    return (
                      <div
                        key={sl.warehouseId}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface border border-line/10 text-[11px]"
                      >
                        <span className="font-semibold text-ink">{sl.warehouse.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted">فعلي: <strong className="text-ink font-mono">{sl.onHand}</strong></span>
                          {sl.reserved > 0 && <span className="text-danger font-mono">محجوز: {sl.reserved}</span>}
                          <span className={`font-mono font-bold ${avail > 0 ? "text-success" : "text-muted"}`}>{avail} متاح</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted">لتعديل الكميات استخدم زر "ضبط المخزون" في الجدول</p>
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editingVariant.isActive}
                className="checkbox"
              />
              <span>المقاس نشط ومتاح للطلب</span>
            </label>
            <button className="btn-primary w-full mt-2" disabled={updateVariant.isPending}>
              {updateVariant.isPending ? <Spinner /> : "حفظ التعديلات"}
            </button>
          </form>
        )}
      </Modal>

      {/* Modal: Stock Adjust & Direct Set per Warehouse */}
      <Modal
        open={!!stockModalVariant}
        title={`ضبط مخزون المقاس: ${stockModalVariant?.label ?? ""}`}
        onClose={() => setStockModalVariant(null)}
      >
        {stockModalVariant && (
          <form className="space-y-3 text-xs" onSubmit={onSaveStockAdjust}>
            <div className="p-3 bg-surface2/60 border border-line/10 rounded-xl space-y-2">
              <label className="label">
                اختر المخزن المراد تعديل رصيده
                <select
                  value={selectedWhId ?? whs.data?.[0]?.id}
                  onChange={(e) => {
                    const wid = Number(e.target.value);
                    setSelectedWhId(wid);
                    const current = stockModalVariant.stockLevels?.find((s) => s.warehouseId === wid)?.onHand ?? 0;
                    setStockQty(current);
                  }}
                  className="input text-xs"
                >
                  {whs.data
                    ?.filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>

              {(() => {
                const targetWid = selectedWhId ?? whs.data?.[0]?.id ?? 1;
                const level = stockModalVariant.stockLevels?.find((s) => s.warehouseId === targetWid);
                const onHand = level?.onHand ?? 0;
                const reserved = level?.reserved ?? 0;
                const avail = onHand - reserved;

                return (
                  <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-surface border border-line/10">
                    <div>
                      <div className="text-[10px] text-muted">الرصيد الفعلي</div>
                      <div className="font-mono font-bold text-ink text-sm">{onHand}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted">المحجوز لطلبات</div>
                      <div className="font-mono font-bold text-danger text-sm">{reserved}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted">المتاح للبيع</div>
                      <div className="font-mono font-bold text-success text-sm">{avail}</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Adjust Mode Selector */}
            <div className="flex items-center gap-2 p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStockMode("set")}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  stockMode === "set" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                تحديد الرصيد المباشر (=)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStockMode("add");
                  setStockQty(10);
                }}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  stockMode === "add" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                إضافة وارد (+ توريد)
              </button>
            </div>

            <label className="label">
              {stockMode === "set" ? "الرصيد الفعلي الجديد المطلوب تحديده:" : "كمية الوارد المراد إضافتها:"}
              <input
                type="number"
                min={stockMode === "set" ? 0 : 1}
                value={stockQty}
                onChange={(e) => setStockQty(Number(e.target.value))}
                className="input font-mono font-bold text-sm"
                dir="ltr"
                required
              />
            </label>

            <label className="label">
              ملاحظة / سبب الحركة (اختياري)
              <input
                type="text"
                value={stockNote}
                onChange={(e) => setStockNote(e.target.value)}
                className="input"
                placeholder={stockMode === "set" ? "مثال: تسوية جرد سنوي" : "مثال: استلام شحنة جديدة"}
              />
            </label>

            <button className="btn-primary w-full mt-2" disabled={adjustStock.isPending}>
              {adjustStock.isPending ? <Spinner /> : "تأكيد وتحديث رصيد المخزن"}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
