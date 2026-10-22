import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Edit, FolderTree, Layers, Plus, Search, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { EmptyState, ErrorBox, Modal, Skeleton, Spinner } from "../../components/ui";
import { useAdminWarehouses, useCatalogMutations } from "../../hooks/adminQueries";
import { errorText } from "../../lib/api";
import type { Warehouse } from "../../lib/types";
import { useUI } from "../../store/ui";

export default function AdminWarehouses() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Warehouse | null>(null);
  const push = useUI((s) => s.push);

  const { data: warehouses, isLoading, error, refetch } = useAdminWarehouses();
  const mutations = useCatalogMutations();

  const filtered = (warehouses || []).filter((w) => {
    if (!q.trim()) return true;
    return w.name.toLowerCase().includes(q.trim().toLowerCase());
  });

  const onOpenCreate = () => {
    setEditing(null);
    setOpen(true);
  };

  const onOpenEdit = (wh: Warehouse) => {
    setEditing(wh);
    setOpen(true);
  };

  const onSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const isActive = f.get("isActive") === "on";

    if (!name) {
      push("اسم المخزن مطلوب", "err");
      return;
    }

    try {
      if (editing) {
        await mutations.updateWarehouse.mutateAsync({
          id: editing.id,
          name,
          isActive,
        });
        push("تم تعديل المخزن بنجاح", "ok");
      } else {
        await mutations.createWarehouse.mutateAsync({ name });
        push("تمت إضافة المخزن بنجاح", "ok");
      }
      setOpen(false);
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  const onToggleActive = async (wh: Warehouse) => {
    try {
      if (wh.isActive) {
        await mutations.deleteWarehouse.mutateAsync(wh.id);
        push("تم إيقاف المخزن", "ok");
      } else {
        await mutations.updateWarehouse.mutateAsync({ id: wh.id, isActive: true });
        push("تم تفعيل المخزن", "ok");
      }
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  const onHardDelete = async (wh: Warehouse) => {
    try {
      await mutations.hardDeleteWarehouse.mutateAsync(wh.id);
      push(`تم الحذف النهائي للمخزن "${wh.name}" بنجاح`, "ok");
      setDeleteConfirm(null);
    } catch (err) {
      push(errorText(err), "err");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold">المخازن والفروع (Warehouses)</h1>
          <p className="text-sm text-muted">إدارة المخازن والفروع التابعة للشركة وحالاتها</p>
        </div>
        <button onClick={onOpenCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          <span>إضافة مخزن</span>
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
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-muted hover:text-ink transition"
        >
          <FolderTree className="h-4 w-4" />
          <span>التصنيفات</span>
        </Link>
        <Link
          to="/admin/warehouses"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-fg shadow-sm transition"
        >
          <WarehouseIcon className="h-4 w-4" />
          <span>المخازن ({warehouses?.length ?? 0})</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
        <input
          type="text"
          className="input ps-9 text-xs"
          placeholder="بحث باسم المخزن..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading && <Skeleton className="h-64" />}
      {error && <ErrorBox text={errorText(error)} onRetry={() => refetch()} />}

      {!isLoading && !error && filtered.length === 0 && (
        <EmptyState title="لا توجد مخازن" hint="اضغط على زر 'إضافة مخزن' لإنشاء مخزن جديد" />
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-surface2/60 text-muted border-b border-line/10">
                <tr>
                  <th className="p-3.5 text-start font-semibold">اسم المخزن</th>
                  <th className="p-3.5 text-center font-semibold">الحالة</th>
                  <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/10">
                {filtered.map((w) => (
                  <tr key={w.id} className={`hover:bg-line/5 transition ${!w.isActive ? "opacity-60 bg-line/5" : ""}`}>
                    <td className="p-3.5 font-bold text-ink">{w.name}</td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          w.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                        }`}
                      >
                        {w.isActive ? "نشط" : "معطل"}
                      </span>
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenEdit(w)}
                          className="btn-ghost px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          onClick={() => onToggleActive(w)}
                          className={`btn-ghost px-2.5 py-1 text-xs ${
                            w.isActive ? "text-amber-500 hover:bg-amber-500/10" : "text-success hover:bg-success/10"
                          }`}
                        >
                          <span>{w.isActive ? "إيقاف" : "تفعيل"}</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(w)}
                          className="btn-ghost px-2.5 py-1 text-xs text-danger hover:bg-danger/10 font-bold"
                          title="حذف نهائي"
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
      <Modal open={open} title={editing ? "تعديل المخزن" : "مخزن جديد"} onClose={() => setOpen(false)}>
        <form className="space-y-3 text-xs" onSubmit={onSave}>
          <label className="label">
            اسم المخزن (يدعم العربية)
            <input
              name="name"
              className="input"
              defaultValue={editing?.name ?? ""}
              required
              maxLength={80}
              placeholder="مثال: مخزن طنطا الرئيسي"
            />
          </label>
          {editing && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" name="isActive" defaultChecked={editing.isActive} className="checkbox" />
              <span>المخزن نشط ومتاح للطلبات والمخزون</span>
            </label>
          )}
          <button
            type="submit"
            className="btn-primary w-full mt-2"
            disabled={mutations.createWarehouse.isPending || mutations.updateWarehouse.isPending}
          >
            {mutations.createWarehouse.isPending || mutations.updateWarehouse.isPending ? <Spinner /> : "حفظ"}
          </button>
        </form>
      </Modal>

      {/* Hard Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} title="تأكيد الحذف النهائي للمخزن" onClose={() => setDeleteConfirm(null)}>
        {deleteConfirm && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger space-y-1">
              <p className="font-bold text-sm">تحذير: حذف نهائي من قاعدة البيانات!</p>
              <p>
                سيتم حذف المخزن <strong>"{deleteConfirm.name}"</strong> نهائياً من قاعدة البيانات.
              </p>
            </div>
            <p className="text-muted">هل أنت متأكد من رغبتك في حذف هذا المخزن نهائياً؟</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => setDeleteConfirm(null)}
                disabled={mutations.hardDeleteWarehouse.isPending}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary bg-danger hover:bg-danger/90 text-white text-xs px-4"
                onClick={() => onHardDelete(deleteConfirm)}
                disabled={mutations.hardDeleteWarehouse.isPending}
              >
                {mutations.hardDeleteWarehouse.isPending ? <Spinner /> : "تأكيد الحذف النهائي"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
