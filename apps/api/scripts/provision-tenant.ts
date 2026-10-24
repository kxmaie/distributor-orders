import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

async function main() {
  const root = path.resolve(process.cwd(), "../..");
  const databaseUrl = process.env.TENANT_DATABASE_URL?.trim();
  const username = process.env.TENANT_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.TENANT_ADMIN_PASSWORD;
  const fullName = process.env.TENANT_ADMIN_FULLNAME?.trim() || "Tenant Owner";
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new Error("Set TENANT_DATABASE_URL to this customer's separate Postgres URL");
  if (!username || !password || password.length < 12) throw new Error("Set TENANT_ADMIN_USERNAME and TENANT_ADMIN_PASSWORD (at least 12 characters)");
  if (databaseUrl === process.env.DATABASE_URL || databaseUrl === process.env.CONTROL_DATABASE_URL) throw new Error("Tenant database must not reuse the platform/control database URL");

  const env = { ...process.env, DATABASE_URL: databaseUrl, SEED_ADMIN_USERNAME: username, SEED_ADMIN_PASSWORD: password, SEED_ADMIN_FULLNAME: fullName, DEMO_MODE: "false" };
  delete env.DEMO_DATABASE_URL;
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  function run(args: string[]) {
    const result = spawnSync(npm, args, { cwd: root, env, encoding: "utf8", shell: process.platform === "win32" });
    if (result.stdout) process.stdout.write(result.stdout.replaceAll(databaseUrl, "[database URL hidden]"));
    if (result.stderr) process.stderr.write(result.stderr.replaceAll(databaseUrl, "[database URL hidden]"));
    if (result.error) throw new Error(`Could not start ${npm}: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`${args.join(" ")} failed with exit code ${result.status}`);
  }

  const probe = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const rows = await probe.$queryRaw<Array<{ public_tables: bigint }>>`SELECT COUNT(*)::bigint AS public_tables FROM pg_tables WHERE schemaname = 'public'`;
    if ((rows[0]?.public_tables ?? 0n) > 0n) throw new Error("Refusing to initialize a tenant database that already contains public tables");
  } finally { await probe.$disconnect(); }

  run(["run", "migrate:deploy", "-w", "@do/api"]);
  run(["run", "seed", "-w", "@do/api"]);
  console.log(`Tenant database is ready for '${username}'. Add it in the platform console; the connection string is not printed.`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Tenant provisioning failed"); process.exitCode = 1; });
