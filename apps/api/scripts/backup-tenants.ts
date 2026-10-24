import "dotenv/config";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { closePlatformControlClient, listTenantDatabaseConnections, recordPlatformBackup } from "../src/lib/tenant-registry";

function pgEnv(connection: string) {
  const url = new URL(connection);
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("Not a PostgreSQL URL");
  const sslMode = url.searchParams.get("sslmode") || "require";
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGSSLMODE: sslMode === "disable" ? "disable" : "require",
  };
}

async function dumpTenant(tenant: { id: string; slug: string; databaseUrl: string }, directory: string, encryptionKey: Buffer) {
  const slug = tenant.slug.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("Unsafe tenant slug");
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  const fileName = `${slug}-${stamp}.dump.enc`;
  const filePath = path.join(directory, fileName);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const digest = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) { digest.update(chunk); bytes += chunk.length; callback(null, chunk); } });
  const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges"], { env: { ...process.env, ...pgEnv(tenant.databaseUrl) }, stdio: ["ignore", "pipe", "ignore"] });
  const closed = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolve(code ?? 1));
  });
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const output = createWriteStream(filePath, { flags: "wx", mode: 0o600 });
    const [, exitCode] = await Promise.all([pipeline(child.stdout!, cipher, meter, output), closed]);
    if (exitCode !== 0) throw new Error(`pg_dump failed with exit code ${exitCode}`);
    const checksum = digest.digest("hex");
    const manifest = { version: 1, tenantSlug: slug, fileName, format: "pg_dump-custom", algorithm: "aes-256-gcm", iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), checksumSha256: checksum, sizeBytes: bytes, createdAt: new Date().toISOString() };
    await writeFile(`${filePath}.json`, JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
    await recordPlatformBackup({ tenantId: tenant.id, fileName, checksum, sizeBytes: BigInt(bytes) });
    console.log(`Backed up ${slug}: ${fileName} (${bytes} bytes; encrypted)`);
  } catch (error) {
    child.kill();
    await rm(filePath, { force: true });
    await rm(`${filePath}.json`, { force: true });
    throw error;
  }
}

async function main() {
  if (process.env.TENANCY_MODE !== "multi") throw new Error("Set TENANCY_MODE=multi only in a trusted backup environment");
  const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("Set BACKUP_ENCRYPTION_KEY to 32 random bytes encoded as hex");
  const directory = path.resolve(process.cwd(), "../..", process.env.BACKUP_DIRECTORY || "backups/tenants");
  const tenants = await listTenantDatabaseConnections();
  if (!tenants.length) { console.log("No tenant databases are registered."); return; }
  const key = Buffer.from(keyHex, "hex");
  let failed = 0;
  for (const tenant of tenants) {
    try { await dumpTenant(tenant, directory, key); }
    catch (error) { failed += 1; console.error(`Backup failed for ${tenant.slug}: ${error instanceof Error ? error.message : "unknown error"}`); }
  }
  if (failed) throw new Error(`${failed} tenant backup(s) failed; successful files remain available`);
  console.log(`Encrypted backups saved in ${directory}. Copy them to owner-controlled storage and test restore regularly.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Backup failed"); process.exitCode = 1; }).finally(async () => { await closePlatformControlClient().catch(() => undefined); });
