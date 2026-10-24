import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "./errors";

type TenantRecord = { id: string; slug: string; database_url_ciphertext: string; status: string };
type CachedClient = { urlHash: string; client: PrismaClient; touchedAt: number; active: number; evicted: boolean };
export type ResolvedTenant = { id: string; slug: string; client: PrismaClient; release: () => void };
const MAX_TENANT_CLIENTS = 12;
let control: PrismaClient | undefined;
const clients = new Map<string, CachedClient>();

export function platformControlClient() {
  const url = process.env.CONTROL_DATABASE_URL;
  if (!url) throw new Error("CONTROL_DATABASE_URL is required when TENANCY_MODE=multi");
  return (control ??= new PrismaClient({ datasources: { db: { url } } }));
}

export async function closePlatformControlClient() {
  const client = control;
  control = undefined;
  if (client) await client.$disconnect();
}

export function decryptDatabaseUrl(ciphertext: string) {
  const keyHex = process.env.TENANT_ENCRYPTION_KEY;
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("TENANT_ENCRYPTION_KEY must be 32-byte hex");
  const [version, ivHex, tagHex, dataHex] = ciphertext.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted tenant database URL");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

function encryptDatabaseUrl(databaseUrl: string) {
  const keyHex = process.env.TENANT_ENCRYPTION_KEY;
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("TENANT_ENCRYPTION_KEY must be 32-byte hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const encrypted = Buffer.concat([cipher.update(databaseUrl, "utf8"), cipher.final()]);
  return `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
}

function pruneIdleClients() {
  while (clients.size > MAX_TENANT_CLIENTS) {
    const oldest = [...clients.entries()].filter(([, entry]) => entry.active === 0).sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
    if (!oldest) return;
    clients.delete(oldest[0]);
    oldest[1].evicted = true;
    void oldest[1].client.$disconnect().catch(() => undefined);
  }
}

async function loadTenant(slug: string): Promise<ResolvedTenant | null> {
  const rows = await platformControlClient().$queryRaw<TenantRecord[]>`
    SELECT id, slug, database_url_ciphertext, status FROM platform_tenants WHERE slug = ${slug} LIMIT 1
  `;
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  const databaseUrl = decryptDatabaseUrl(row.database_url_ciphertext);
  const urlHash = createHash("sha256").update(databaseUrl).digest("hex");
  let cached = clients.get(row.id);
  if (!cached || cached.urlHash !== urlHash) {
    if (cached) {
      clients.delete(row.id);
      cached.evicted = true;
      if (cached.active === 0) void cached.client.$disconnect().catch(() => undefined);
    }
    cached = { urlHash, client: new PrismaClient({ datasources: { db: { url: databaseUrl } } }), touchedAt: Date.now(), active: 0, evicted: false };
    clients.set(row.id, cached);
  }
  cached.active += 1;
  cached.touchedAt = Date.now();
  pruneIdleClients();
  let released = false;
  return {
    id: row.id,
    slug: row.slug,
    client: cached.client,
    release: () => {
      if (released) return;
      released = true;
      cached!.active -= 1;
      cached!.touchedAt = Date.now();
      if (cached!.evicted && cached!.active === 0) void cached!.client.$disconnect().catch(() => undefined);
      pruneIdleClients();
    },
  };
}

export async function resolveTenant(slug: string) {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) return null;
  return loadTenant(normalized);
}

export async function listPlatformTenants() {
  return platformControlClient().$queryRaw<Array<{ id: string; slug: string; display_name: string; status: string; created_at: Date; updated_at: Date; last_backup_at: Date | null; backup_count: bigint }>>`
    SELECT t.id, t.slug, t.display_name, t.status, t.created_at, t.updated_at,
      MAX(b.created_at) AS last_backup_at, COUNT(b.id)::bigint AS backup_count
    FROM platform_tenants t LEFT JOIN platform_backups b ON b.tenant_id = t.id
    GROUP BY t.id ORDER BY t.created_at DESC
  `;
}

export async function registerPlatformTenant(input: { slug: string; name: string; databaseUrl: string }, actor: string) {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  const databaseUrl = input.databaseUrl.trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new HttpError(400, "TENANT_SLUG_INVALID", "استخدم حروفًا إنجليزية صغيرة وأرقامًا وشرطة فقط في الرابط");
  if (!name || name.length > 120) throw new HttpError(400, "TENANT_NAME_INVALID", "اسم العميل مطلوب وبحد أقصى 120 حرفًا");
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new HttpError(400, "TENANT_DATABASE_URL_INVALID", "رابط قاعدة البيانات غير صالح");
  if (databaseUrl === process.env.CONTROL_DATABASE_URL || databaseUrl === process.env.DATABASE_URL) throw new HttpError(400, "TENANT_DATABASE_URL_REUSED", "قاعدة العميل يجب أن تكون منفصلة عن قواعد المنصة الحالية");
  const tenantDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const checks = await tenantDb.$queryRaw<Array<{ has_users: boolean; has_migrations: boolean }>>`
      SELECT to_regclass('public.users') IS NOT NULL AS has_users,
        to_regclass('public._prisma_migrations') IS NOT NULL AS has_migrations
    `;
    if (!checks[0]?.has_users || !checks[0]?.has_migrations) throw new HttpError(400, "TENANT_DATABASE_NOT_READY", "شغّل ترحيلات النظام وأضف حساب المالك قبل تسجيل قاعدة العميل");
    const ciphertext = encryptDatabaseUrl(databaseUrl);
    const inserted = await platformControlClient().$queryRaw<Array<{ id: string; slug: string; display_name: string; status: string; created_at: Date }>>`
      INSERT INTO platform_tenants (id, slug, display_name, database_url_ciphertext)
      VALUES (${randomBytes(16).toString("hex")}, ${slug}, ${name}, ${ciphertext})
      ON CONFLICT (slug) DO NOTHING
      RETURNING id, slug, display_name, status, created_at
    `;
    if (!inserted[0]) throw new HttpError(409, "TENANT_SLUG_TAKEN", "رابط العميل مستخدم بالفعل");
    await platformControlClient().$executeRaw`INSERT INTO platform_admin_audit (actor, action, tenant_slug) VALUES (${actor}, ${"tenant.register"}, ${slug})`;
    return inserted[0];
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "TENANT_DATABASE_UNAVAILABLE", "تعذر الاتصال بقاعدة العميل أو التحقق من جاهزيتها");
  } finally {
    await tenantDb.$disconnect();
  }
}

export async function setPlatformTenantStatus(slug: string, status: "active" | "suspended", actor: string) {
  const rows = await platformControlClient().$queryRaw<Array<{ slug: string; display_name: string; status: string }>>`
    UPDATE platform_tenants SET status = ${status}, updated_at = now() WHERE slug = ${slug}
    RETURNING slug, display_name, status
  `;
  if (!rows[0]) return null;
  await platformControlClient().$executeRaw`INSERT INTO platform_admin_audit (actor, action, tenant_slug) VALUES (${actor}, ${status === "active" ? "tenant.activate" : "tenant.suspend"}, ${slug})`;
  return rows[0];
}

export async function listPlatformBackups() {
  return platformControlClient().$queryRaw<Array<{ id: string; tenant_slug: string; file_name: string; checksum_sha256: string; size_bytes: bigint; created_at: Date }>>`
    SELECT b.id, t.slug AS tenant_slug, b.file_name, b.checksum_sha256, b.size_bytes, b.created_at
    FROM platform_backups b JOIN platform_tenants t ON t.id = b.tenant_id
    ORDER BY b.created_at DESC LIMIT 500
  `;
}

export async function listTenantDatabaseConnections() {
  const rows = await platformControlClient().$queryRaw<Array<{ id: string; slug: string; database_url_ciphertext: string }>>`
    SELECT id, slug, database_url_ciphertext FROM platform_tenants ORDER BY slug
  `;
  return rows.map((row) => ({ ...row, databaseUrl: decryptDatabaseUrl(row.database_url_ciphertext) }));
}

export async function recordPlatformBackup(input: { tenantId: string; fileName: string; checksum: string; sizeBytes: bigint }) {
  await platformControlClient().$executeRaw`
    INSERT INTO platform_backups (id, tenant_id, file_name, checksum_sha256, size_bytes)
    VALUES (${randomBytes(16).toString("hex")}, ${input.tenantId}, ${input.fileName}, ${input.checksum}, ${input.sizeBytes})
  `;
}
