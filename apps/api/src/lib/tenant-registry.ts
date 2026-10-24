import { createHash, createDecipheriv } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { HttpError } from "./errors";

type TenantRecord = { id: string; slug: string; database_url_ciphertext: string; status: string };
type CachedClient = { urlHash: string; client: PrismaClient; touchedAt: number; active: number; evicted: boolean };
export type ResolvedTenant = { id: string; slug: string; client: PrismaClient; release: () => void };
const MAX_TENANT_CLIENTS = 12;
let control: PrismaClient | undefined;
const clients = new Map<string, CachedClient>();

function controlClient() {
  const url = process.env.CONTROL_DATABASE_URL;
  if (!url) throw new Error("CONTROL_DATABASE_URL is required when TENANCY_MODE=multi");
  return (control ??= new PrismaClient({ datasources: { db: { url } } }));
}

function decryptDatabaseUrl(ciphertext: string) {
  const keyHex = process.env.TENANT_ENCRYPTION_KEY;
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("TENANT_ENCRYPTION_KEY must be 32-byte hex");
  const [version, ivHex, tagHex, dataHex] = ciphertext.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !dataHex) throw new Error("Invalid encrypted tenant database URL");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
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
  const rows = await controlClient().$queryRaw<TenantRecord[]>`
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
