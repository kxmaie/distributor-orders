import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PASSWORD_MIN_LENGTH } from "@do/shared";
import { EmptyState, ErrorBox, Modal, Skeleton, Spinner } from "../../components/ui";
import { api, errorText } from "../../lib/api";
import { dateTime } from "../../lib/format";
import { useUI } from "../../store/ui";
import type { Page, PasswordRequest } from "../../lib/types";

export default function AdminPasswordRequests() {
  const [status, setStatus] = useState<string>("pending");
  const [pick, setPick] = useState<PasswordRequest | null>(null);
  const [pw, setPw] = useState("");
  const push = useUI((s) => s.push);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["admin-pw", status],
    queryFn: () => api.get<Page<PasswordRequest>>("/admin/password-requests", { status, pageSize: 50 }),
  });
  const resolve = useMutation({
    mutationFn: (body: { id: string; status: "resolved" | "rejected"; newPassword?: string }) =>
      api.post(`/admin/password-requests/${body.id}/resolve`, { status: body.status, newPassword: body.newPassword }),
    onSuccess: () => {
      push("تم تنفيذ الإجراء", "ok");
      setPick(null); setPw("");
      qc.invalidateQueries({ queryKey: ["admin-pw"] });
      qc.invalidateQueries({ queryKey: ["admin-dash"] });
    },
    onError: (e) => push(errorText(e), "err"),
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-extrabold">طلبات إعادة التعيين</h1>
      <div className="flex gap-2">
        {(["pending", "resolved", "rejected"] as const).map((s) => (
          <button key={s} className={`chip ${status === s ? "chip-active" : ""}`} onClick={() => setStatus(s)}>
            {s === "pending" ? "معلّقة" : s === "resolved" ? "منفّذة" : "مرفوضة"}
          </button>
        ))}
      </div>
      {list.isLoading && <Skeleton className="h-64" />}
      {list.isError && <ErrorBox text={errorText(list.error)} onRetry={() => list.refetch()} />}
      {list.data && list.data.items.length === 0 && <EmptyState title="لا توجد طلبات" />}
      {list.data && list.data.items.length > 0 && (
        <ul className="space-y-3">
          {list.data.items.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold" dir="ltr">{r.username}</p>
                <p className="text-sm text-muted">{r.user?.fullName ?? "مستخدم غير معروف"} · {dateTime(r.createdAt)}</p>
                {r.note && <p className="text-sm">{r.note}</p>}
              </div>
              {r.status === "pending" && (
                <div className="flex gap-2">
                  <button className="btn-primary" onClick={() => setPick(r)}>تعيين كلمة مرور</button>
                  <button className="btn-danger" onClick={() => resolve.mutate({ id: r.id, status: "rejected" })}>رفض</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!pick} title="تعيين كلمة مرور جديدة" onClose={() => setPick(null)}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pick) resolve.mutate({ id: pick.id, status: "resolved", newPassword: pw }); }}>
          <p className="text-sm text-muted">{pick?.user?.fullName} · <span dir="ltr">{pick?.username}</span></p>
          <label className="label">كلمة المرور ({PASSWORD_MIN_LENGTH}+)
            <input className="input" dir="ltr" type="password" required minLength={PASSWORD_MIN_LENGTH} value={pw} onChange={(e) => setPw(e.target.value)} />
          </label>
          <button className="btn-primary w-full" disabled={resolve.isPending}>{resolve.isPending ? <Spinner /> : "حفظ وإغلاق الطلب"}</button>
        </form>
      </Modal>
    </div>
  );
}
