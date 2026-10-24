import "dotenv/config";
import { createDecipheriv, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrismaClient } from "@prisma/client";
import { closePlatformControlClient, listTenantDatabaseConnections } from "../src/lib/tenant-registry";

type Manifest = { version: number; tenantSlug: string; algorithm: string; iv: string; tag: string; checksumSha256: string; fileName: string };
function pgEnv(connection: string) {
  const url = new URL(connection);
  if (!/^postgres(?:ql)?:$/.test(url.protocol)) throw new Error("Not a PostgreSQL URL");
  return { PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")), PGSSLMODE: url.searchParams.get("sslmode") === "disable" ? "disable" : "require" };
}
async function main() {
  const file = path.resolve(process.env.BACKUP_FILE || "");
  const target = process.env.RESTORE_TARGET_DATABASE_URL?.trim();
  const confirm = process.env.CONFIRM_RESTORE_TENANT?.trim().toLowerCase();
  const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
  if (!process.env.BACKUP_FILE || !target || !/^postgres(?:ql)?:\/\//i.test(target)) throw new Error("Set BACKUP_FILE and RESTORE_TARGET_DATABASE_URL");
  if (target === process.env.DATABASE_URL || target === process.env.CONTROL_DATABASE_URL) throw new Error("Refusing to restore over the platform or control database");
  if (!process.env.CONTROL_DATABASE_URL || !process.env.TENANT_ENCRYPTION_KEY) throw new Error("Set CONTROL_DATABASE_URL and TENANT_ENCRYPTION_KEY to protect registered tenant databases");
  const registered = await listTenantDatabaseConnections();
  if (registered.some((tenant) => tenant.databaseUrl === target)) throw new Error("Restore to a new, unregistered empty database; then switch the tenant connection after verification");
  if (process.env.RESTORE_TARGET_EMPTY !== "YES") throw new Error("Set RESTORE_TARGET_EMPTY=YES only after confirming this is a separate, empty database");
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("Set BACKUP_ENCRYPTION_KEY to the 32-byte encryption key");
  const manifest = JSON.parse(await readFile(`${file}.json`, "utf8")) as Manifest;
  if (manifest.version !== 1 || manifest.algorithm !== "aes-256-gcm" || path.basename(file) !== manifest.fileName) throw new Error("Backup manifest is invalid or does not match the selected file");
  if (confirm !== manifest.tenantSlug) throw new Error(`Set CONFIRM_RESTORE_TENANT=${manifest.tenantSlug} to confirm the backup's tenant`);
  const targetDb = new PrismaClient({ datasources: { db: { url: target } } });
  try {
    const tables = await targetDb.$queryRaw<Array<{ table_count: bigint }>>`SELECT COUNT(*)::bigint AS table_count FROM pg_tables WHERE schemaname = 'public'`;
    if ((tables[0]?.table_count ?? 0n) !== 0n) throw new Error("Restore target contains public tables; choose a new empty database");
  } finally { await targetDb.$disconnect(); }
  const digest = createHash("sha256");
  const check = new Transform({ transform(chunk, _encoding, callback) { digest.update(chunk); callback(null, chunk); } });
  await pipeline(createReadStream(file), check, new Transform({ transform(_chunk, _encoding, callback) { callback(); } }));
  if (digest.digest("hex") !== manifest.checksumSha256) throw new Error("Backup checksum mismatch; no data was restored");

  const plaintext = path.join(os.tmpdir(), `tenant-restore-${process.pid}-${Date.now()}.dump`);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), Buffer.from(manifest.iv, "hex"));
  decipher.setAuthTag(Buffer.from(manifest.tag, "hex"));
  try {
    await pipeline(createReadStream(file), decipher, createWriteStream(plaintext, { flags: "wx", mode: 0o600 }));
    const connectionEnv = pgEnv(target);
    const child = spawn("pg_restore", ["--dbname", connectionEnv.PGDATABASE, "--no-owner", "--no-privileges", "--exit-on-error", plaintext], { env: { ...process.env, ...connectionEnv }, stdio: "inherit" });
    const exitCode = await new Promise<number>((resolve, reject) => { child.once("error", reject); child.once("close", (code) => resolve(code ?? 1)); });
    if (exitCode !== 0) throw new Error(`pg_restore failed with exit code ${exitCode}; inspect the separate target database before retrying`);
    console.log(`Restore completed for ${manifest.tenantSlug}.`);
  } finally { await rm(plaintext, { force: true }); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Restore failed"); process.exitCode = 1; }).finally(async () => { await closePlatformControlClient().catch(() => undefined); });
