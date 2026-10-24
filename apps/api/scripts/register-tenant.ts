import "dotenv/config";
import { randomBytes, createCipheriv } from "node:crypto";
import { PrismaClient } from "@prisma/client";

async function main() {
  const slug = process.env.TENANT_SLUG?.trim().toLowerCase();
  const name = process.env.TENANT_NAME?.trim();
  const databaseUrl = process.env.TENANT_DATABASE_URL;
  const controlUrl = process.env.CONTROL_DATABASE_URL;
  const keyHex = process.env.TENANT_ENCRYPTION_KEY;
  if (!slug || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) throw new Error("Set TENANT_SLUG to a lowercase URL-safe slug");
  if (!name) throw new Error("Set TENANT_NAME");
  if (!databaseUrl || !/^postgres(?:ql)?:\/\//i.test(databaseUrl)) throw new Error("Set TENANT_DATABASE_URL to the provisioned PostgreSQL URL");
  if (!controlUrl) throw new Error("Set CONTROL_DATABASE_URL");
  if (!keyHex || !/^[\da-f]{64}$/i.test(keyHex)) throw new Error("Set TENANT_ENCRYPTION_KEY to 32 random bytes encoded as hex");
  if (process.env.DATABASE_URL && databaseUrl === process.env.DATABASE_URL && process.env.TENANT_ALLOW_DATABASE_URL_REUSE !== "true") {
    throw new Error("Tenant URL matches DATABASE_URL; set TENANT_ALLOW_DATABASE_URL_REUSE=true only after verifying this is intentional");
  }

  const tenantDb = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const control = new PrismaClient({ datasources: { db: { url: controlUrl } } });
  try {
    const tables = await tenantDb.$queryRaw<Array<{ has_users: boolean }>>`SELECT to_regclass('public.users') IS NOT NULL AS has_users`;
    if (!tables[0]?.has_users) throw new Error("Tenant DB is unreachable or migrations have not created the users table");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
    const encrypted = Buffer.concat([cipher.update(databaseUrl, "utf8"), cipher.final()]);
    const ciphertext = `v1:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
    const inserted = await control.$queryRaw<Array<{ slug: string }>>`
      INSERT INTO platform_tenants (id, slug, display_name, database_url_ciphertext)
      VALUES (${randomBytes(16).toString("hex")}, ${slug}, ${name}, ${ciphertext})
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug
    `;
    if (!inserted[0]) throw new Error("Tenant slug already exists; refusing to replace its database URL");
    console.log(`Registered tenant '${inserted[0].slug}'. Create its initial owner account before allowing sign in.`);
  } finally {
    await Promise.all([tenantDb.$disconnect(), control.$disconnect()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Tenant registration failed");
  process.exitCode = 1;
});
