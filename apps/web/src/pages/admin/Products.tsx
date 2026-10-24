import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Boxes, Edit, FileUp, FolderTree, Layers, Package, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { EmptyState, ErrorBox, Modal, Skeleton, Spinner } from "../../components/ui";
import { useAdminWarehouses } from "../../hooks/adminQueries";
import { api, errorText } from "../../lib/api";
import { money, UNIT_LABEL } from "../../lib/format";
import { useUI } from "../../store/ui";
import type { AdminCategory, AdminProduct, Page } from "../../lib/types";
import ImageUploadField from "../../components/admin/ImageUploadField";

type ImportRow = { categoryId: number; name: string; basePrice: string; unit: string; initialStock: number; sku?: string; variantLabel?: string; description?: string; imageUrl?: string };
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && quoted && text[i + 1] === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export default function AdminProducts() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminProduct | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const push = useUI((s) => s.push);
  const qc = useQueryClient();

  const cats = useQuery({ queryKey: ["admin-cats"], queryFn: () => api.get<AdminCategory[]>("/admin/categories") });
  const units = useQuery({ queryKey: ["units"], queryFn: () => api.get<{ name: string; label: string }[]>("/units") });
  const { data: warehouses } = useAdminWarehouses();
  const list = useQuery({
    queryKey: ["admin-products", q, page],
    queryFn: () => api.get<Page<AdminProduct>>("/admin/products", { q, page, pageSize: 20 }),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post("/admin/products", body),
    onSuccess: () => {
      push("تم إضافة المنتج وإنشاء رصيد المخزون بنجاح", "ok");
      setOpen(false);
      setNewImageUrl("");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      qc.invalidateQueries({ queryKey: ["admin", "movements"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? api.del(`/admin/products/${id}`) : api.patch(`/admin/products/${id}`, { isActive: true }),
    onSuccess: (_, vars) => {
      push(vars.isActive ? "تم إيقاف المنتج" : "تم تفعيل المنتج", "ok");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  const hardDelete = useMutation({
    mutationFn: (id: string) => api.del(`/admin/products/${id}/force`),
    onSuccess: () => {
      push("تم الحذف النهائي للمنتج وتنظيف سجلاته من قاعدة البيانات", "ok");
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin", "stock"] });
      qc.invalidateQueries({ queryKey: ["admin-cats"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const whVal = f.get("warehouseId");
    const initStockVal = f.get("initialStock");
    create.mutate({
      categoryId: Number(f.get("categoryId")),
      name: String(f.get("name")),
      description: String(f.get("description") || "") || null,
      imageUrl: String(f.get("imageUrl") || "") || null,
      basePrice: String(f.get("basePrice")),
      unit: String(f.get("unit")),
      piecesPerUnit: Number(f.get("piecesPerUnit") || 1),
      warehouseId: whVal ? Number(whVal) : undefined,
      initialStock: initStockVal ? Number(initStockVal) : 0,
      sku: String(f.get("sku") || "").trim() || undefined,
      variantLabel: String(f.get("variantLabel") || "").trim() || undefined,
    });
  }

  async function onImportFile(file?: File) {
    if (!file) return;
    setImportError(""); setImportRows([]);
    if (!file.name.toLowerCase().endsWith(".csv") || file.size > 2 * 1024 * 1024) { setImportError("ارفع ملف CSV حتى 2 ميجابايت. يمكن فتح Excel وحفظ الملف بصيغة CSV."); return; }
    const rows = parseCsv(await file.text());
    if (rows.length < 2 || rows.length > 201) { setImportError("الملف لازم يحتوي عنوان الأعمدة وصفًا واحدًا على الأقل، وبحد أقصى 200 منتج."); return; }
    const headers = rows[0].map((h) => h.replace(/^\uFEFF/, "").toLowerCase());
    const at = (...names: string[]) => headers.findIndex((h) => names.includes(h));
    const idx = { name: at("name", "الاسم", "اسم المنتج"), category: at("category", "categoryid", "التصنيف"), price: at("baseprice", "price", "السعر"), unit: at("unit", "الوحدة"), stock: at("initialstock", "stock", "المخزون"), sku: at("sku", "كود الصنف"), variant: at("variantlabel", "variant", "المقاس"), description: at("description", "الوصف"), image: at("imageurl", "image", "رابط الصورة") };
    if (idx.name < 0 || idx.category < 0 || idx.price < 0) { setImportError("الأعمدة المطلوبة: name, category, basePrice. حمّل نموذج CSV من هنا لتجهيز الملف."); return; }
    const products: ImportRow[] = [];
    for (const [n, cells] of rows.slice(1).entries()) {
      const get = (i: number) => i >= 0 ? cells[i] ?? "" : "";
      const categoryValue = get(idx.category).trim().toLowerCase();
      const category = cats.data?.find((c) => String(c.id) === categoryValue || c.slug.toLowerCase() === categoryValue || c.name.toLowerCase() === categoryValue);
      const name = get(idx.name), price = get(idx.price).replace(/[^0-9.]/g, "");
      const unit = get(idx.unit) || "piece";
      const stock = Number(get(idx.stock) || 0);
      if (!name || !category || !Number.isFinite(Number(price)) || Number(price) <= 0 || !units.data?.some((u) => u.name === unit) || !Number.isInteger(stock) || stock < 0) { setImportError(`راجع الصف ${n + 2}: الاسم والتصنيف الموجود والسعر الموجب والوحدة والكمية الصحيحة مطلوبة.`); return; }
      products.push({ categoryId: category.id, name, basePrice: price, unit, initialStock: stock, sku: get(idx.sku) || undefined, variantLabel: get(idx.variant) || undefined, description: get(idx.description) || undefined, imageUrl: get(idx.image) || undefined });
    }
    setImportRows(products);
  }

  async function importProducts() {
    setImporting(true);
    let added = 0;
    for (const row of importRows) {
      try { await api.post("/admin/products", row); added++; }
      catch { /* Keep going so one duplicate SKU does not stop the whole file. */ }
    }
    setImporting(false); setImportOpen(false); setImportRows([]);
    push(`اكتملت الإضافة: ${added} من ${importRows.length} منتج. راجع المنتجات التي لم تُضف يدويًا.`, added === importRows.length ? "ok" : "err");
    qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["admin", "stock"] }); qc.invalidateQueries({ queryKey: ["admin", "movements"] });
  }

  const getTotalStock = (p: AdminProduct) => {
    return p.variants?.reduce((sum, v) => {
      const vSum = v.stockLevels?.reduce((acc, s) => acc + (s.onHand || 0), 0) ?? 0;
      return sum + vSum;
    }, 0) ?? 0;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Package className="h-5 w-5" /></span><h1 className="font-display text-2xl font-extrabold">المنتجات (Products)</h1></div>
          <p className="text-sm text-muted">إدارة قائمة المنتجات والأسعار والمقاسات</p>
        </div>
        <div className="flex items-center gap-2">
        <button className="btn-ghost" onClick={() => { setImportRows([]); setImportError(""); setImportOpen(true); }}><FileUp className="h-4 w-4" />استيراد CSV</button>
          <Link to="/admin/categories" className="btn-ghost text-xs">
            <FolderTree className="h-4 w-4" />
            <span>إدارة التصنيفات</span>
          </Link>
          <button className="btn-primary" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            <span>منتج جديد</span>
          </button>
        </div>
      </div>

      {/* Sub-nav Links */}
      <div className="flex items-center gap-1.5 p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold w-fit">
        <Link
          to="/admin/products"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-fg shadow-sm transition"
        >
          <Layers className="h-4 w-4" />
          <span>المنتجات</span>
        </Link>
        <Link
          to="/admin/categories"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-muted hover:text-ink transition"
        >
          <FolderTree className="h-4 w-4" />
          <span>التصنيفات ({cats.data?.length ?? 0})</span>
        </Link>
        <Link
          to="/admin/warehouses"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-muted hover:text-ink transition"
        >
          <WarehouseIcon className="h-4 w-4" />
          <span>المخازن</span>
        </Link>
      </div>

      <input
        className="input max-w-xs text-xs"
        placeholder="بحث باسم المنتج أو الوصف..."
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />

      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorBox text={errorText(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState title="لا توجد منتجات" />}

      {list.data && list.data.items.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-surface2/60 text-muted border-b border-line/10">
                <tr>
                  <th className="p-3.5 text-start font-semibold">المنتج</th>
                  <th className="p-3.5 text-start font-semibold">التصنيف</th>
                  <th className="p-3.5 text-center font-semibold">السعر الأساسي</th>
                  <th className="p-3.5 text-center font-semibold">المقاسات والمخزون</th>
                  <th className="p-3.5 text-center font-semibold">الحالة</th>
                  <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {list.data.items.map((p) => {
                  const totalStock = getTotalStock(p);
                  return (
                    <tr key={p.id} className={`hover:bg-line/5 transition ${!p.isActive ? "opacity-60 bg-line/5" : ""}`}>
                      <td className="p-3.5 font-bold text-ink">
                        <div>{p.name}</div>
                        {p.description && <div className="text-[11px] text-muted truncate max-w-xs">{p.description}</div>}
                      </td>
                      <td className="p-3.5 text-muted">{p.category.name}</td>
                      <td className="p-3.5 text-center font-mono font-bold text-primary">
                        {money(Number(p.basePrice) * p.piecesPerUnit)} / {UNIT_LABEL[p.unit] ?? p.unit}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="font-mono font-semibold">{p.variants.length} مقاسات</div>
                        <div className={`text-[11px] font-bold ${totalStock > 0 ? "text-success" : "text-muted"}`}>
                          {totalStock > 0 ? `المخزون: ${totalStock} ${UNIT_LABEL[p.unit]}` : "لا يوجد رصيد"}
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                          }`}
                        >
                          {p.isActive ? "نشط" : "موقوف"}
                        </span>
                      </td>
                      <td className="p-3.5 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            className="btn-ghost px-2.5 py-1 text-xs text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                            to={`/admin/products/${p.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>تعديل</span>
                          </Link>
                          <button
                            className={`btn-ghost px-2.5 py-1 text-xs ${
                              p.isActive ? "text-amber-500 hover:bg-amber-500/10" : "text-success hover:bg-success/10"
                            }`}
                            onClick={() => toggleActive.mutate({ id: p.id, isActive: p.isActive })}
                            disabled={toggleActive.isPending}
                          >
                            <span>{p.isActive ? "إيقاف" : "تفعيل"}</span>
                          </button>
                          <button
                            className="btn-ghost px-2.5 py-1 text-xs text-danger hover:bg-danger/10 font-bold inline-flex items-center gap-1"
                            title="حذف نهائي من قاعدة البيانات"
                            onClick={() => setDeleteConfirm(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف نهائي</span>
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

      {list.data && list.data.total > list.data.pageSize && (
        <div className="flex justify-center gap-2">
          <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </button>
          <span className="text-xs text-muted flex items-center px-2">
            صفحة {page} من {Math.ceil(list.data.total / list.data.pageSize) || 1}
          </span>
          <button
            className="btn-ghost text-xs"
            disabled={page * list.data.pageSize >= list.data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </button>
        </div>
      )}

      {/* New Product Modal */}
      <Modal open={open} title="منتج جديد مع رصيد المخزون" onClose={() => setOpen(false)}>
        <form className="space-y-3 text-xs" onSubmit={onCreate}>
          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              التصنيف
              <select name="categoryId" className="input text-xs" required>
                {cats.data
                  ?.filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="label">
              الوحدة
              <select name="unit" className="input text-xs">
                {(units.data ?? []).map((u) => (
                  <option key={u.name} value={u.name}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="label">
            الاسم
            <input name="name" className="input" required maxLength={160} placeholder="مثال: شباك مفصلي مزدوج" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="label">
              سعر القطعة
              <input name="basePrice" className="input font-mono" dir="ltr" required placeholder="0.00" /><span className="text-xs text-muted">سعر القطعة، والإجمالي للوحدة يساوي السعر × عدد القطع</span>
            </label>
            <label className="label">
              عدد القطع في الوحدة أو الكرتونة
              <input name="piecesPerUnit" className="input" type="number" min="1" max="100000" defaultValue="1" required />
            </label>
            <label className="label">
              صورة المنتج (اختياري)
              <ImageUploadField value={newImageUrl} onChange={setNewImageUrl} />
            </label>
          </div>

          <label className="label">
            الوصف
            <textarea name="description" className="input min-h-[4rem] py-2" placeholder="وصف وتفاصيل المنتج..." />
          </label>

          {/* Initial Stock Section */}
          <div className="p-3 bg-surface2/60 border border-line/10 rounded-xl space-y-3">
            <p className="font-bold text-ink flex items-center gap-1.5">
              <Boxes className="h-4 w-4 text-primary" />
              <span>الرصيد الافتتاحي والمخزن (Initial Stock)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">
                المخزن للإيداع
                <select name="warehouseId" className="input text-xs">
                  {warehouses
                    ?.filter((w) => w.isActive)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="label">
                الكمية الأولية (الرصيد الفعلي)
                <input
                  name="initialStock"
                  type="number"
                  min="0"
                  defaultValue={0}
                  className="input font-mono font-bold"
                  dir="ltr"
                  placeholder="0"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="label">
                كود الصنف / SKU (اختياري)
                <input
                  name="sku"
                  className="input font-mono"
                  dir="ltr"
                  placeholder="توليد تلقائي إذا تُرك فارغاً"
                />
              </label>
              <label className="label">
                المقاس / الموديل (افتراضي)
                <input
                  name="variantLabel"
                  className="input"
                  defaultValue="الأساسي"
                  placeholder="مثال: 120×150 أبيض"
                />
              </label>
            </div>
          </div>

          <button className="btn-primary w-full mt-2" disabled={create.isPending}>
            {create.isPending ? <Spinner /> : "حفظ المنتج وإيداع المخزون"}
          </button>
        </form>
      </Modal>

      <Modal open={importOpen} title="استيراد منتجات من ملف CSV" onClose={() => !importing && setImportOpen(false)}>
        <div className="space-y-4 text-sm">
          <p className="text-muted">جهز الملف بالأعمدة المطلوبة: <b dir="ltr">name, category, basePrice</b>. التصنيف يقبل الاسم أو الرابط أو الرقم. الحد الأقصى 200 منتج في الملف.</p>
          <button type="button" className="btn-ghost text-xs" onClick={() => {
            const csv = "name,category,basePrice,unit,initialStock,sku,variantLabel,description,imageUrl\nمثال منتج,category-slug,100,piece,0,SKU-001,الأساسي,,,";
            const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a"); a.href = url; a.download = "products-template.csv"; a.click(); URL.revokeObjectURL(url);
          }}>تحميل نموذج CSV</button>
          <input ref={importInput} className="input" type="file" accept=".csv,text/csv" onChange={(e) => void onImportFile(e.target.files?.[0])} />
          {cats.data && <p className="text-xs text-muted">التصنيفات المتاحة: {cats.data.map((c) => `${c.name} (${c.slug})`).join("، ")}</p>}
          {importError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">{importError}</p>}
          {importRows.length > 0 && <div className="rounded-xl border border-primary/25 bg-primary/5 p-3"><p className="font-bold text-primary">تمت معاينة {importRows.length} منتجًا قبل الإضافة</p><ul className="mt-2 space-y-1 text-xs text-muted">{importRows.slice(0, 5).map((r, i) => <li key={`${r.name}-${i}`}>{r.name} · {r.basePrice} · {cats.data?.find((c) => c.id === r.categoryId)?.name}</li>)}</ul>{importRows.length > 5 && <p className="mt-1 text-xs text-muted">و {importRows.length - 5} منتجات أخرى</p>}</div>}
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost text-xs" disabled={importing} onClick={() => setImportOpen(false)}>إلغاء</button><button type="button" className="btn-primary text-xs" disabled={!importRows.length || importing} onClick={() => void importProducts()}>{importing ? <Spinner /> : `إضافة ${importRows.length} منتج`}</button></div>
        </div>
      </Modal>

      {/* Hard Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} title="تأكيد الحذف النهائي للمنتج" onClose={() => setDeleteConfirm(null)}>
        {deleteConfirm && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger space-y-1">
              <p className="font-bold text-sm">تحذير: سيتم حذف المنتج نهائياً من قاعدة البيانات!</p>
              <p>
                سيتم حذف المنتج <strong>"{deleteConfirm.name}"</strong> وجميع مقاساته وسجلاته التالفة بشكل نهائي لا رجعة فيه.
              </p>
            </div>
            <p className="text-muted">هل أنت متأكد من رغبتك في حذف هذا المنتج نهائياً؟</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setDeleteConfirm(null)}
                disabled={hardDelete.isPending}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary bg-danger hover:bg-danger/90 text-white text-xs px-4"
                onClick={() => hardDelete.mutate(deleteConfirm.id)}
                disabled={hardDelete.isPending}
              >
                {hardDelete.isPending ? <Spinner /> : "تأكيد الحذف النهائي"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
