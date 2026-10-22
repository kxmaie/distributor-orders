import { motion } from "framer-motion";
import {
  CheckCircle2,
  Edit,
  KeyRound,
  Lock,
  Plus,
  Search,
  Shield,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorBox, Skeleton } from "../../components/ui";
import {
  useAdminPasswordRequests,
  useAdminPendingUsers,
  useAdminUsers,
  useApproveUser,
  useRejectUser,
  useResolvePasswordRequest,
  useUserMutations,
} from "../../hooks/adminQueries";
import { formatDate } from "../../lib/format";
import type { AdminUser, PasswordRequest, Role } from "../../lib/types";
import { useUI } from "../../store/ui";

const ROLE_LABEL: Record<Role, string> = {
  distributor: "موزع",
  admin: "مسؤول (Admin)",
  super_admin: "سوبر أدمن",
};

type Tab = "users" | "pending" | "requests";

export default function AdminUsers() {
  const push = useUI((s) => s.push);
  const [tab, setTab] = useState<Tab>("users");

  // Filters
  const [search, setSearch] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState<number>(1);

  // Queries
  const { data: usersData, isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useAdminUsers({
    role: roleFilter,
    q: search.trim() || undefined,
    page,
  });

  const {
    data: pendingData,
    isLoading: pendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = useAdminPendingUsers({ page });

  const {
    data: requestsData,
    isLoading: reqLoading,
    error: reqError,
    refetch: refetchRequests,
  } = useAdminPasswordRequests({ page });

  const mutations = useUserMutations();
  const resolveRequest = useResolvePasswordRequest();
  const approveUser = useApproveUser();
  const rejectUser = useRejectUser();

  // Modals state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PasswordRequest | null>(null);

  // Approve modal state
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approvingUser, setApprovingUser] = useState<AdminUser | null>(null);
  const [approveDiscount, setApproveDiscount] = useState("0");

  // User form state
  const [uUsername, setUUsername] = useState("");
  const [uFullName, setUFullName] = useState("");
  const [uPhone, setUPhone] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [uRole, setURole] = useState<Role>("distributor");
  const [uDiscount, setUDiscount] = useState("0");
  const [uUnlock, setUUnlock] = useState(false);

  // Password resolve form state
  const [resAction, setResAction] = useState<"resolved" | "rejected">("resolved");
  const [resNewPassword, setResNewPassword] = useState("");

  const openNewUser = () => {
    setEditingUser(null);
    setUUsername("");
    setUFullName("");
    setUPhone("");
    setUPassword("");
    setURole("distributor");
    setUDiscount("0");
    setUUnlock(false);
    setUserModalOpen(true);
  };

  const openEditUser = (u: AdminUser) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUFullName(u.fullName);
    setUPhone(u.phone || "");
    setUPassword("");
    setURole(u.role);
    setUDiscount(u.defaultDiscountPct);
    setUUnlock(false);
    setUserModalOpen(true);
  };

  const openApproveModal = (u: AdminUser) => {
    setApprovingUser(u);
    setApproveDiscount("0");
    setApproveModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await mutations.updateUser.mutateAsync({
          id: editingUser.id,
          fullName: uFullName,
          phone: uPhone.trim() || null,
          role: uRole,
          defaultDiscountPct: uDiscount,
          password: uPassword.trim() || undefined,
          unlock: uUnlock ? true : undefined,
        });
        push("تم تحديث بيانات المستخدم بنجاح", "success");
      } else {
        if (!uPassword || uPassword.length < 12) {
          push("يجب أن تكون كلمة المرور 12 حرفًا على الأقل", "info");
          return;
        }
        await mutations.createUser.mutateAsync({
          username: uUsername.trim(),
          password: uPassword,
          fullName: uFullName.trim(),
          phone: uPhone.trim() || null,
          role: uRole,
          defaultDiscountPct: uDiscount,
        });
        push("تم إنشاء المستخدم بنجاح", "success");
      }
      setUserModalOpen(false);
    } catch {
      push("فشل حفظ المستخدم، تأكد من صحة البيانات وعدم تكرار اسم المستخدم", "danger");
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingUser) return;
    try {
      await approveUser.mutateAsync({
        id: approvingUser.id,
        defaultDiscountPct: approveDiscount || undefined,
      });
      push(`تم قبول تسجيل "${approvingUser.fullName}" وتفعيل حسابه`, "success");
      setApproveModalOpen(false);
    } catch {
      push("فشل قبول طلب التسجيل", "danger");
    }
  };

  const handleRejectUser = async (u: AdminUser) => {
    if (!confirm(`هل تريد رفض وحذف طلب تسجيل "${u.fullName}" نهائياً؟`)) return;
    try {
      await rejectUser.mutateAsync(u.id);
      push("تم رفض طلب التسجيل وحذف الحساب", "info");
    } catch {
      push("فشل رفض طلب التسجيل", "danger");
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      if (resAction === "resolved" && (!resNewPassword || resNewPassword.length < 12)) {
        push("يرجى كتابة كلمة مرور جديدة لا تقل عن 12 حرفًا", "info");
        return;
      }
      await resolveRequest.mutateAsync({
        id: selectedRequest.id,
        status: resAction,
        newPassword: resAction === "resolved" ? resNewPassword : undefined,
      });
      push(resAction === "resolved" ? "تم تعيين كلمة المرور الجديدة وقبول الطلب" : "تم رفض الطلب", "success");
      setResolveModalOpen(false);
    } catch {
      push("فشل معالجة الطلب", "danger");
    }
  };

  const pendingCount = pendingData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-extrabold">المستخدمين وإعادة التعيين</h1>
          <p className="text-sm text-muted">إدارة حسابات الموزعين، الإداريين، والبت في طلبات استعادة الحسابات</p>
        </div>

        <div className="flex items-center gap-2">
          {tab === "users" && (
            <button onClick={openNewUser} className="btn-primary text-xs px-3.5 py-2">
              <UserPlus className="h-4 w-4" />
              <span>إضافة موزع / مستخدم</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center p-1 bg-surface2/60 border border-line/10 rounded-xl text-xs font-semibold w-fit">
        <button
          onClick={() => { setTab("users"); setPage(1); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
            tab === "users" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>المستخدمين</span>
        </button>
        <button
          onClick={() => { setTab("pending"); setPage(1); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition relative ${
            tab === "pending" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>طلبات التسجيل</span>
          {pendingCount > 0 && (
            <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ${
              tab === "pending" ? "bg-white text-primary" : "bg-primary text-white"
            }`}>
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab("requests"); setPage(1); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg transition ${
            tab === "requests" ? "bg-primary text-primary-fg shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          <KeyRound className="h-4 w-4" />
          <span>طلبات استعادة كلمة المرور</span>
        </button>
      </div>

      {/* ================= USERS TAB ================= */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="absolute start-3 top-3 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder="بحث بالاسم أو اسم المستخدم أو الهاتف..."
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
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="input text-xs"
              >
                <option value="all">جميع الأدوار...</option>
                <option value="distributor">موزع (distributor)</option>
                <option value="admin">مسؤول (admin)</option>
                <option value="super_admin">سوبر أدمن (super_admin)</option>
              </select>
            </div>
          </div>

          {usersLoading && (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {usersError && <ErrorBox text="فشل تحميل المستخدمين" onRetry={() => refetchUsers()} />}

          {!usersLoading && !usersError && usersData && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-surface2/60 text-muted border-b border-line/10">
                    <tr>
                      <th className="p-3.5 text-start font-semibold">المستخدم</th>
                      <th className="p-3.5 text-center font-semibold">الدور</th>
                      <th className="p-3.5 text-start font-semibold">الهاتف</th>
                      <th className="p-3.5 text-center font-semibold">الخصم الافتراضي</th>
                      <th className="p-3.5 text-center font-semibold">الحالة</th>
                      <th className="p-3.5 text-center font-semibold">تاريخ التسجيل</th>
                      <th className="p-3.5 text-end font-semibold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/10">
                    {usersData.items.map((u) => {
                      const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                      return (
                        <tr key={u.id} className="hover:bg-line/5 transition">
                          <td className="p-3.5">
                            <div className="font-bold text-ink">{u.fullName}</div>
                            <div className="text-[11px] text-muted font-mono">@{u.username}</div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.role === "super_admin"
                                  ? "bg-accent/15 text-accent"
                                  : u.role === "admin"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-surface2 text-muted"
                              }`}
                            >
                              {ROLE_LABEL[u.role]}
                            </span>
                          </td>
                          <td className="p-3.5 text-muted">{u.phone || "—"}</td>
                          <td className="p-3.5 text-center font-mono font-bold text-accent">
                            {Number(u.defaultDiscountPct) > 0 ? `${u.defaultDiscountPct}%` : "0%"}
                          </td>
                          <td className="p-3.5 text-center">
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-danger/15 text-danger flex items-center justify-center gap-1">
                                <Lock className="h-3 w-3" />
                                <span>مقفل مؤقتاً</span>
                              </span>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  u.isActive ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                                }`}
                              >
                                {u.isActive ? "نشط" : "معطل"}
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center text-muted">{formatDate(u.createdAt)}</td>
                          <td className="p-3.5 text-end">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => openEditUser(u)}
                                className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-ink"
                                title="تعديل المستخدم"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              {u.isActive && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`هل أنت متأكد من تعطيل حساب "${u.fullName}"؟`)) {
                                      await mutations.deleteUser.mutateAsync(u.id);
                                      push("تم تعطيل الحساب", "info");
                                    }
                                  }}
                                  className="btn-ghost p-1.5 h-7 w-7 text-muted hover:text-danger"
                                  title="تعطيل الحساب"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 border-t border-line/10 flex items-center justify-between text-xs text-muted">
                <span>
                  إجمالي المستخدمين: <strong className="text-ink">{usersData.total}</strong>
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
                    صفحة {page} من {Math.ceil(usersData.total / usersData.pageSize) || 1}
                  </span>
                  <button
                    disabled={page * usersData.pageSize >= usersData.total}
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

      {/* ================= PENDING REGISTRATIONS TAB ================= */}
      {tab === "pending" && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="card p-4 bg-primary/5 border-primary/20 text-xs text-primary flex items-center gap-2">
            <UserCheck className="h-4 w-4 shrink-0" />
            <span>
              هذه قائمة الموزعين الذين سجّلوا حسابات جديدة وبانتظار موافقتك. بعد الموافقة يستطيع الموزع تسجيل الدخول ورؤية الكتالوج.
            </span>
          </div>

          {pendingLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {pendingError && <ErrorBox text="فشل تحميل طلبات التسجيل" onRetry={() => refetchPending()} />}

          {!pendingLoading && !pendingError && pendingData && (
            <div className="card overflow-hidden">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface2/60 text-muted border-b border-line/10">
                  <tr>
                    <th className="p-3.5 text-start font-semibold">المستخدم</th>
                    <th className="p-3.5 text-start font-semibold">الهاتف</th>
                    <th className="p-3.5 text-center font-semibold">تاريخ الطلب</th>
                    <th className="p-3.5 text-end font-semibold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {pendingData.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted">
                        لا توجد طلبات تسجيل معلقة 🎉
                      </td>
                    </tr>
                  ) : (
                    pendingData.items.map((u) => (
                      <tr key={u.id} className="hover:bg-line/5 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-ink">{u.fullName}</div>
                          <div className="text-[11px] text-muted font-mono">@{u.username}</div>
                        </td>
                        <td className="p-3.5 text-muted">{u.phone || "—"}</td>
                        <td className="p-3.5 text-center text-muted">{formatDate(u.createdAt)}</td>
                        <td className="p-3.5 text-end">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => openApproveModal(u)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-success/15 text-success hover:bg-success/25 transition text-xs font-semibold"
                              title="قبول الطلب وتفعيل الحساب"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              موافقة
                            </button>
                            <button
                              onClick={() => handleRejectUser(u)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-danger/15 text-danger hover:bg-danger/25 transition text-xs font-semibold"
                              title="رفض وحذف الطلب"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              رفض
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Pagination */}
              {pendingData.total > pendingData.pageSize && (
                <div className="p-3 border-t border-line/10 flex items-center justify-between text-xs text-muted">
                  <span>
                    إجمالي الطلبات: <strong className="text-ink">{pendingData.total}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                    >
                      السابق
                    </button>
                    <button
                      disabled={page * pendingData.pageSize >= pendingData.total}
                      onClick={() => setPage((p) => p + 1)}
                      className="btn-ghost text-xs px-3 py-1 h-8 disabled:opacity-40"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= PASSWORD REQUESTS TAB ================= */}
      {tab === "requests" && (
        <div className="space-y-4">
          {reqLoading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          )}

          {reqError && <ErrorBox text="فشل تحميل طلبات كلمة المرور" onRetry={() => refetchRequests()} />}

          {!reqLoading && !reqError && requestsData && (
            <div className="card overflow-hidden">
              <table className="w-full text-xs text-start">
                <thead className="bg-surface2/60 text-muted border-b border-line/10">
                  <tr>
                    <th className="p-3.5 text-start font-semibold">المستخدم</th>
                    <th className="p-3.5 text-start font-semibold">ملاحظة الطلب</th>
                    <th className="p-3.5 text-center font-semibold">الحالة</th>
                    <th className="p-3.5 text-center font-semibold">تاريخ الطلب</th>
                    <th className="p-3.5 text-end font-semibold">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/10">
                  {requestsData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted">
                        لا توجد طلبات استعادة كلمة مرور
                      </td>
                    </tr>
                  ) : (
                    requestsData.items.map((req) => (
                      <tr key={req.id} className="hover:bg-line/5 transition">
                        <td className="p-3.5">
                          <div className="font-bold text-ink">
                            {req.user?.fullName ?? req.username}
                          </div>
                          <div className="text-[11px] text-muted font-mono">@{req.username}</div>
                        </td>
                        <td className="p-3.5 text-muted">{req.note || "—"}</td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === "pending"
                                ? "bg-primary/20 text-primary"
                                : req.status === "resolved"
                                ? "bg-success/15 text-success"
                                : "bg-danger/15 text-danger"
                            }`}
                          >
                            {req.status === "pending"
                              ? "قيد الانتظار"
                              : req.status === "resolved"
                              ? "تم التعيين"
                              : "مرفوض"}
                          </span>
                        </td>
                        <td className="p-3.5 text-center text-muted">{formatDate(req.createdAt)}</td>
                        <td className="p-3.5 text-end">
                          {req.status === "pending" && (
                            <button
                              onClick={() => {
                                setSelectedRequest(req);
                                setResAction("resolved");
                                setResNewPassword("");
                                setResolveModalOpen(true);
                              }}
                              className="btn-primary text-xs px-3 py-1 h-7"
                            >
                              معالجة الطلب
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= MODALS ================= */}

      {/* User Create / Edit Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-md p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">
                {editingUser ? "تعديل حساب المستخدم" : "إضافة مستخدم جديد"}
              </h2>
              <button
                onClick={() => setUserModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">اسم المستخدم (Username):</label>
                <input
                  type="text"
                  placeholder="مثال: ahmed_dist"
                  value={uUsername}
                  disabled={!!editingUser}
                  onChange={(e) => setUUsername(e.target.value)}
                  className="input font-mono disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">الاسم الكامل:</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد للتجارة"
                  value={uFullName}
                  onChange={(e) => setUFullName(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted mb-1 font-semibold">الدور:</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as Role)}
                    className="input text-xs"
                  >
                    <option value="distributor">موزع (distributor)</option>
                    <option value="admin">مسؤول (admin)</option>
                    <option value="super_admin">سوبر أدمن (super_admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted mb-1 font-semibold">الخصم الافتراضي (%):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={uDiscount}
                    onChange={(e) => setUDiscount(e.target.value)}
                    className="input font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">رقم الهاتف (اختياري):</label>
                <input
                  type="text"
                  placeholder="مثال: 01012345678"
                  value={uPhone}
                  onChange={(e) => setUPhone(e.target.value)}
                  className="input font-mono"
                />
              </div>

              <div>
                <label className="block text-muted mb-1 font-semibold">
                  {editingUser ? "تعيين كلمة مرور جديدة (اتركه فارغاً للإبقاء عليها):" : "كلمة المرور (12 حرفاً على الأقل):"}
                </label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  className="input font-mono"
                  required={!editingUser}
                />
              </div>

              {editingUser && (
                <div className="pt-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={uUnlock}
                      onChange={(e) => setUUnlock(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>إلغاء قفل الحساب وإعادة تصفير المحاولات الفاشلة</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  {editingUser ? "حفظ التعديلات" : "إنشاء المستخدم"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Approve Registration Modal */}
      {approveModalOpen && approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">قبول طلب تسجيل موزع</h2>
              <button
                onClick={() => setApproveModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs p-3 rounded-xl bg-success/10 border border-success/20 space-y-1">
              <div><strong>الاسم: </strong><span>{approvingUser.fullName}</span></div>
              <div className="font-mono text-muted">@{approvingUser.username}</div>
              {approvingUser.phone && <div className="text-muted">{approvingUser.phone}</div>}
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">الخصم الافتراضي (%) — اختياري:</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={approveDiscount}
                  onChange={(e) => setApproveDiscount(e.target.value)}
                  className="input font-mono"
                  placeholder="0"
                />
                <p className="text-[10px] text-muted mt-1">يمكن تعديله لاحقاً من صفحة المستخدمين.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-success text-white text-xs font-semibold hover:bg-success/90 transition">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  تفعيل الحساب والموافقة
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Password Request Resolution Modal */}
      {resolveModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card w-full max-w-sm p-6 bg-surface shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-line/10">
              <h2 className="text-base font-bold text-ink">معالجة طلب استعادة الحساب</h2>
              <button
                onClick={() => setResolveModalOpen(false)}
                className="h-7 w-7 rounded-lg grid place-items-center text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs p-3 rounded-xl bg-surface2/40 border border-line/10 space-y-1">
              <div>
                <strong>المستخدم: </strong>
                <span>{selectedRequest.user?.fullName ?? selectedRequest.username}</span>
              </div>
              <div className="font-mono text-muted">@{selectedRequest.username}</div>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted mb-1 font-semibold">القرار:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResAction("resolved")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      resAction === "resolved"
                        ? "border-success bg-success/15 text-success"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    قبول وتعيين باسورد
                  </button>
                  <button
                    type="button"
                    onClick={() => setResAction("rejected")}
                    className={`p-2 rounded-xl border text-center font-bold transition ${
                      resAction === "rejected"
                        ? "border-danger bg-danger/15 text-danger"
                        : "border-line/15 text-muted hover:text-ink"
                    }`}
                  >
                    رفض الطلب
                  </button>
                </div>
              </div>

              {resAction === "resolved" && (
                <div>
                  <label className="block text-muted mb-1 font-semibold">
                    كلمة المرور الجديدة (12 حرفًا على الأقل):
                  </label>
                  <input
                    type="text"
                    placeholder="اكتب كلمة مرور قوية..."
                    value={resNewPassword}
                    onChange={(e) => setResNewPassword(e.target.value)}
                    className="input font-mono"
                    required
                  />
                  <p className="text-[10px] text-muted mt-1">
                    قم بإرسال هذه الكلمة للموزع بعد حفظها ليتمكن من الدخول.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-line/10">
                <button
                  type="button"
                  onClick={() => setResolveModalOpen(false)}
                  className="btn-ghost text-xs px-4 py-2"
                >
                  إلغاء
                </button>
                <button type="submit" className="btn-primary text-xs px-5 py-2">
                  تأكيد الإجراء
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
