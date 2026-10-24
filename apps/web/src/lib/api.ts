import { useAuth } from "../store/auth";

const BASE = "/api/v1";

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
        const r = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
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
  NO_SINGLE_WA