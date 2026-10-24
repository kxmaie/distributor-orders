import { useAuth } from "../store/auth";

const BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "/api/v1";
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG?.trim().toLowerCase();

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;
/** Single-flight refresh: the refresh token is a rotating httpOnly cookie, so only one call may run at a time. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include", headers: TENANT_SLUG ? { "X-Tenant-Slug": TENANT_SLUG } : {} });
        if (!r.ok) return false;
        const d = await r.json();
        useAuth.getState().setSession(d.accessToken, d.user);
        return true;
      } catch {
        return false;
      }
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

type Opts = { method?: string; body?: unknown; query?: Record<string, string | number | undefined | null>; retry?: boolean };

async function request<T>(path: string, { method = "GET", body, query, retry = true }: Opts = {}): Promise<T> {
  const qs = query
    ? new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString()
    : "";
  const token = useAuth.getState().token;
  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ""}`, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(TENANT_SLUG ? { "X-Tenant-Slug": TENANT_SLUG } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    if (await refreshSession()) return request<T>(path, { method, body, query, retry: false });
    useAuth.getState().clear();
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "ERROR", data.message ?? "", data.details ?? data.issues);
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Opts["query"]) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ?? {} }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

const MESSAGES: Record<string, string> = {
  USER_NOT_REGISTERED: "اسم المستخدم غير مسجل، تأكد من الاسم أو أنشئ حسابًا جديدًا",
  WRONG_PASSWORD: "كلمة المرور غير صحيحة، حاول مرة أخرى",
  ACCOUNT_LOCKED: "الحساب مقفول مؤقتًا بسبب محاولات كثيرة، حاول بعد 15 دقيقة",
  ACCOUNT_PENDING: "حسابك قيد المراجعة من قبل الإدارة، سيتم تفعيله قريباً",
  USERNAME_TAKEN: "اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر",
  RATE_LIMITED: "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة",
  INSUFFICIENT_STOCK: "الكمية المطلوبة غير متوفرة حاليًا",
  NO_SINGLE_WAREHOUSE: "لا يوجد مخزن واحد يغطي كل الأصناف، قسّم الطلب إلى طلبين",
  ITEM_UNAVAILABLE: "أحد المنتجات لم يعد متاحًا",
  CANCEL_NOT_ALLOWED: "لا يمكن إلغاء الطلب بعد تأكيده",
  INVALID_TRANSITION: "لا يمكن تنفيذ هذا الإجراء على الطلب",
  ORDER_NOT_FOUND: "الطلب غير موجود",
  PRODUCT_NOT_FOUND: "المنتج غير موجود",
  VALIDATION: "البيانات المدخلة غير صحيحة",
  UNAUTHORIZED: "انتهت الجلسة، سجّل الدخول من جديد",
  FORBIDDEN: "ليست لديك صلاحية لهذا الإجراء",
  USER_NOT_FOUND: "المستخدم غير موجود",
  CANNOT_MODIFY_SELF: "لا يمكنك تنفيذ هذا الإجراء على حسابك",
  ALREADY_RESOLVED: "تم البت في هذا الطلب مسبقًا",
  DISCOUNT_NOT_FOUND: "الخصم غير موجود",
  VARIANT_NOT_FOUND: "المقاس غير موجود",
  WAREHOUSE_NOT_FOUND: "المخزن غير موجود",
  CONFLICT: "تعارض في البيانات، حدّث الصفحة وحاول مرة أخرى",
  ORDER_ITEM_LIMIT: "الطلب تجاوز الحد الأقصى للأصناف المسموح به، قلل عدد الأصناف وحاول مرة أخرى",
  ADMIN_ORDER_ACTION_FORBIDDEN: "الأدمن يقدر يعتمد الطلب أو يلغيه أو يجهزه للبيع فقط",
  PURCHASE_HAS_RETURNS: "لا يمكن تعديل فاتورة مرتبطة بمرتجعات مسجلة",
  RETURN_ITEM_NOT_IN_PURCHASE: "الصنف غير تابع لفاتورة الشراء المختارة",
  RETURN_ITEM_NOT_IN_ORDER: "الصنف غير موجود في الطلب المختار",
  RETURN_QTY_EXCEEDED: "الكمية تتجاوز الكمية المتبقية القابلة للمرتجع",
  RETURN_STOCK_UNAVAILABLE: "الكمية غير متاحة في المخزون أو محجوزة لطلبات أخرى",
  ORDER_NOT_RETURNABLE: "مرتجع البيع متاح بعد تسليم الطلب فقط",
  UNBALANCED_VOUCHER: "القيد غير متوازن؛ يجب تساوي المدين والدائن",
  INVALID_RECEIPT_VOUCHER: "سند القبض يجب أن يزيد أصلًا ويقابله إيراد أو التزام",
  INVALID_PAYMENT_VOUCHER: "سند الصرف يجب أن يخفض أصلًا ويقابله مصروف أو التزام",
  AI_PROVIDER_ERROR: "خدمة المساعد واجهت مشكلة. تأكد من إعداد AI Gateway في Vercel ثم حاول مرة أخرى.",
  DEMO_READ_ONLY: "هذه نسخة تجريبية للعرض فقط؛ لا يمكن حفظ التغييرات.",
  TENANT_REQUIRED: "اختر مساحة العمل للمتابعة",
  TENANT_NOT_FOUND: "مساحة العمل غير موجودة أو غير مفعلة",
  TENANT_SESSION_MISMATCH: "الجلسة لا تخص مساحة العمل الحالية؛ سجل الدخول من جديد",
  TENANT_CAPACITY: "الخدمة مشغولة مؤقتًا، حاول مرة أخرى بعد قليل",
};
export const errorText = (e: unknown) =>
  e instanceof ApiError ? MESSAGES[e.code] ?? (e.message || "حدث خطأ غير متوقع، حاول مرة أخرى") : "تعذّر الاتصال بالخادم، تأكد من الإنترنت";
