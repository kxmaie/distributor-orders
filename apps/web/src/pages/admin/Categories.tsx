import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Edit, FolderTree, Layers, Plus, Search, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { EmptyState, ErrorBox, Modal, Skeleton, Spinner } from "../../components/ui";
import { useAdminCatalogCategories, useCatalogMutations } from "../../hooks/adminQueries";
import { errorText } from "../../lib/api";
import type { AdminCategory } from "../../lib/types";
import { useUI } from "../../store/ui";

export default function AdminCategories() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AdminCategory | null>(null);
  const push = useUI((s) => s.push);

  const { data: categories, isLoading, error, refetch } = useAdminCatalogCategories();
  const mutations = useCatalogMutations();

  const filtered = (categories || []).filter((c) => {
    if (!q.trim()) return true;
    const term = q.trim().toLowerCase();
    return c.name.toLowerCase().includes(term) || c.slug.toLowerCase().includes(term);
  });

  const onOpenCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const onOpenEdit = (cat: AdminCategory) => {
    setEditing(cat);
    setOpen(true);
  };

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const slug = String(f.get("slug") || "").trim() || undefined;
    const sortOrder = Number(f.get("sortOrder") || 0);
    const isActive = f.get("isActive") === "on";

    if (!name) {
      push("اسم التصنيف مطلوب", "err");
      return;
    }

    try {
      if (editing) {
        await mutations.updateCategory.mutateAsync({
          id: editing.id,
          name,
          slug,
          sortOrder,
          isActive,
        });
        push("تم تعديل التصنيف بنجاح", "ok");
      } else {
        await mutations.createCategory.mutateAsync({
          name,
          slug,
          sortOrder,
        });
        push("تم إضافة التصنيف بنجاح", "ok");
      }
      setOpen(false);
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  const onToggleActive = async (cat: AdminCategory) => {
    try {
      if (cat.isActive) {
        await mutations.deleteCategory.mutateAsync(cat.id);
        push("تم إيقاف التصنيف", "ok");
      } else {
        await mutations.updateCategory.mutateAsync({ id: cat.id, isActive: true });
        push("تم تفعيل التصنيف", "ok");
      }
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  const onHardDelete = async (cat: AdminCategory) => {
    try {
      await mutations.hardDeleteCategory.mutateAsync(cat.id);
      push(`تم الحذف النهائي للتصنيف "${cat.name}" وتنظيف سجلاته من قاعدة البيانات`, "ok");
      setDeleteConfirm(null);
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">التصنيفات (Categories)</h1>
          <p className="text-sm text-muted">إدارة أقسام وتصنيفات المنتجات وتعديلها أو حذفها نهائياً</p>
        </div>
        <button onClick={onOpenCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span>إضافة تصنيف</span>
        </button>
      </div>

      {/* Sub-nav Links */}
      <div className="flex items-center gap-1.5 p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold w-fit">
        <Link
          to="/admin/products"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-muted hover:text-ink transition"
        >
          <Layers className="h-4 w-4" />
          <span>المنتجات</span>
        </Link>
        <Link
          to="/admin/categories"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-fg shadow-sm transition"
        >
          <FolderTree className="h-4 w-4" />
          <span>التصنيفات ({categories?.length ?? 0})</span>
        </Link>
        <Link
          to="/admin/warehouses"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-muted hover:text-ink transition"
        >
          <WarehouseIcon className="h-4 w-4" />
          <span>المخازن</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
        <input
          type="text"
          className="input ps-9 text-xs"
          placeholder="بحث بالاسم أو المعرف (Slug)..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorBox text={errorText(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState title="لا توجد تصنيفات" hint="اضغط على زر 'إضافة تصنيف' لإنشاء تصنيف جديد" />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-surface2/60 text-muted border-b border-line/10">
                <tr>
                  <th className="p-3.5 text-start font-semibold">اسم التصنيف</th>
                  <th className="p-3.5 text-start font-semibold">المعرف (Slug)</th>
                  <th className="p-3.5 text-center font-semibold">ترتيب العرض</th>
                  <th className="p-3.5 text-center font-semibold">الحالة</th>
                  <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {filtered.map((c) => (
                  <tr key={c.id} className={`hover:bg-line/5 transition ${!c.isActive ? "opacity-60 bg-line/5" : ""}`}>
                    <td className="p-3.5 font-bold text-ink">{c.name}</td>
                    <td className="p-3.5 font-mono text-muted">{c.slug}</td>
                    <td className="p-3.5 text-center font-mono">{c.sortOrder}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                        }`}
                      >
                        {c.isActive ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenEdit(c)}
                          className="btn-ghost px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => onToggleActive(c)}
                          className={`btn-ghost px-2.5 py-1 text-xs ${
                            c.isActive ? "text-amber-500 hover:bg-amber-500/10" : "text-success hover:bg-success/10"
                          }`}
                        >
                          <span>{c.isActive ? "إيقاف" : "تفعيل"}</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="btn-ghost px-2.5 py-1 text-xs text-danger hover:bg-danger/10 font-bold"
                          title="حذف نهائي من قاعدة البيانات"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>حذف نهائي</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={open} title={editing ? "تعديل التصنيف" : "تصنيف جديد"} onClose={() => setOpen(false)}>
        <form className="space-y-3 text-xs" onSubmit={onSave}>
          <label className="label">
            اسم التصنيف (يدعم العربية)
            <input
              name="name"
              className="input"
              defaultValue={editing?.name ?? ""}
              required
              maxLength={100}
              placeholder="مثال: أبواب وشبابيك"
            />
          </label>
          <label className="label">
            المعرف اللاتيني (Slug)
            <input
              name="slug"
              className="input font-mono"
              dir="ltr"
              defaultValue={editing?.slug ?? ""}
              placeholder="مثال: doors-and-windows (اتركه فارغاً للتوليد التلقائي)"
            />
          </label>
          <label className="label">
            الترتيب (Sort Order)
            <input
              name="sortOrder"
              type="number"
              className="input font-mono"
              dir="ltr"
              defaultValue={editing?.sortOrder ?? 0}
            />
          </label>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive} className="checkbox" />
              <span>التصنيف نشط ومتاح في الكتالوج</span>
            </label>
          )}
          <button
            type="submit"
            className="btn-primary w-full mt-2"
            disabled={mutations.createCategory.isPending || mutations.updateCategory.isPending}
          >
            {mutations.createCategory.isPending || mutations.updateCategory.isPending ? <Spinner /> : "حفظ"}
          </button>
        </form>
      </Modal>

      {/* Hard Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} title="تأكيد الحذف النهائي" onClose={() => setDeleteConfirm(null)}>
        {deleteConfirm && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger space-y-1">
              <p className="font-bold text-sm">تحذير هام: هذا إجراء نهائي ولا يمكن التراجع عنه!</p>
              <p>
                سيتم حذف التصنيف <strong>"{deleteConfirm.name}"</strong> وجميع المنتجات والمقاسات التالفة أو المرتبطة به نهائياً من قاعدة البيانات.
              </p>
            </div>
            <p className="text-muted">هل أنت متأكد تماماً من رغبتك في حذف هذا التصنيف نهائياً؟</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setDeleteConfirm(null)}
                disabled={mutations.hardDeleteCategory.isPending}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary bg-danger hover:bg-danger/90 text-white text-xs px-4"
                onClick={() => onHardDelete(deleteConfirm)}
                disabled={mutations.hardDeleteCategory.isPending}
              >
                {mutations.hardDeleteCategory.isPending ? <Spinner /> : "تأكيد الحذف النهائي"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
