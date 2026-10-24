# Demo and tenant isolation

## Current single-customer deployment

`TENANCY_MODE` defaults to `single`; without changing the production environment, the API continues to use `DATABASE_URL` as it does today. `DEMO_MODE=true` rejects business writes at the API boundary. A demo must use its own API deployment and its own seeded database; do not enable `DEMO_MODE` on the existing production API.

## Tenant routing foundation

Multi-tenant API mode is opt-in and requires:

- `TENANCY_MODE=multi`
- `CONTROL_DATABASE_URL`: a dedicated control-plane PostgreSQL database, separate from every customer database
- `TENANT_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hex characters; keep it as a Vercel secret and back it up securely
- `X-Tenant-Slug` on every API request; the frontend can set `VITE_TENANT_SLUG` for a customer-specific deployment

Apply `apps/api/prisma/control/001_platform_tenants.sql` to the control database. This registry contains only tenant routing metadata and an AES-256-GCM encrypted database URL. Application modules continue importing the shared Prisma proxy, which routes through request-scoped async context. A signed access token is bound to the resolved tenant ID, so changing the tenant header cannot reuse another tenant's session. The API caps idle tenant clients at 12 per instance and returns a retryable capacity error instead of opening unlimited pools. In multi mode, WhatsApp queue messages include the tenant slug and use tenant-scoped idempotency keys. Queue consumers resolve and hold the same tenant database before processing. On Vercel, in-app outbox delivery is best-effort within the originating request; it does not add a paid queue topic or guarantee delivery if the function is terminated.

## Owner console and customer database setup

The isolated owner console is available at `/platform`. It uses its own account, Argon2id password hash, signed HTTP-only session, and is independent from customer logins. Configure these API secrets before enabling it:

- `PLATFORM_ADMIN_USERNAME`
- `PLATFORM_ADMIN_PASSWORD_HASH` (generate locally with `npm run api:tenant:hash-platform-password`)
- `PLATFORM_SESSION_SECRET` (random, at least 32 characters)
- `CONTROL_DATABASE_URL`, `TENANT_ENCRYPTION_KEY`, and `TENANCY_MODE=multi`

Apply `apps/api/prisma/control/001_platform_tenants.sql` to a dedicated control database first. The console can register an already provisioned and migrated tenant database, show status and backup metadata, and suspend/reactivate a tenant. It never returns saved connection strings and does not delete tenants or create hosted databases. Use the provision script for a new, empty database; it checks for public tables, applies Prisma migrations, and creates that tenant's initial super-admin:

1. Set `TENANT_DATABASE_URL`, `TENANT_ADMIN_USERNAME`, `TENANT_ADMIN_PASSWORD` (12+ characters), and optionally `TENANT_ADMIN_FULLNAME` in a trusted local shell/environment file.
2. Run `npm run api:tenant:provision` from the repository root. It will refuse a database that already has public tables.
3. Sign into `/platform` and register the tenant's slug, display name, and connection URL. The URL is encrypted with `TENANT_ENCRYPTION_KEY` before it is stored in the control DB.

The current storefront sends `VITE_TENANT_SLUG`, so a tenant needs a frontend deployment built with its slug (or a future hostname-to-tenant resolver). This is a database-per-customer foundation and owner console, not yet a self-service signup, domain manager, billing/subscription system, or one-build multi-domain SaaS product.

## Encrypted backups and restore

Backups use the installed PostgreSQL client tools (`pg_dump` and `pg_restore`) and local disk; there is no paid storage integration or automatic schedule. Configure `CONTROL_DATABASE_URL`, `TENANT_ENCRYPTION_KEY`, `TENANCY_MODE=multi`, and `BACKUP_ENCRYPTION_KEY` only in the trusted machine running the backup command. `BACKUP_ENCRYPTION_KEY` must be 32 random bytes encoded as 64 hex characters and must be stored separately from backup files. Keep it permanently: losing it makes backups unrecoverable. Set `BACKUP_DIRECTORY` to an owner-controlled path, then run `npm run api:tenant:backup`. Each custom-format dump is encrypted with AES-256-GCM, and a manifest records the authenticated-encryption metadata and checksum; the control DB records the filename, checksum, size, and date, but the backup bytes stay on local disk. Copy the encrypted files and manifests to a separately protected/offsite location as an operational step.

Restore requires `BACKUP_FILE`, `RESTORE_TARGET_DATABASE_URL`, `RESTORE_TARGET_EMPTY=YES`, and `CONFIRM_RESTORE_TENANT=<slug>` plus the same backup key and control-plane keys. The script verifies checksum and GCM authentication, refuses all registered tenant DB URLs and all non-empty public schemas, then restores into a new, unregistered database without `--clean`. Verify that database before registering it as the tenant's new connection. No live database is overwritten by these scripts.

The connected PostgreSQL installation is on the **Free** plan: up to 50 databases, 2 GB total storage, and 100,000 monthly database operations. These are shared installation limits, not per-customer allowances. Current spend shown is 0. If the available free quota is insufficient, stop and get the owner's approval before upgrading or adding paid storage/queues. The existing WhatsApp Queue is reused for WhatsApp only; no additional topic is introduced here.

The isolated Preview demo seeds a demo-admin account from DEMO_SEED_ADMIN_* variables. Keep its password in the Preview secret variable; do not include it in source control.
