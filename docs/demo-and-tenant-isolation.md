# Demo and tenant isolation

## Current single-customer deployment

`TENANCY_MODE` defaults to `single`; without changing the production environment, the API continues to use `DATABASE_URL` as it does today. `DEMO_MODE=true` rejects business writes at the API boundary. A demo must use its own API deployment and its own seeded database; do not enable `DEMO_MODE` on the existing production API.

## Tenant routing foundation

Multi-tenant API mode is opt-in and requires:

- `TENANCY_MODE=multi`
- `CONTROL_DATABASE_URL`: a dedicated control-plane PostgreSQL database, separate from every customer database
- `TENANT_ENCRYPTION_KEY`: 32 random bytes encoded as 64 hex characters; keep it as a Vercel secret and back it up securely
- `X-Tenant-Slug` on every API request; the frontend can set `VITE_TENANT_SLUG` for a customer-specific deployment

Apply `apps/api/prisma/control/001_platform_tenants.sql` to the control database. This registry contains only tenant routing metadata and an AES-256-GCM encrypted database URL. Application modules continue importing the shared Prisma proxy, which routes through request-scoped async context. A signed access token is bound to the resolved tenant ID, so changing the tenant header cannot reuse another tenant's session. The API caps idle tenant clients at 12 per instance and returns a retryable capacity error instead of opening unlimited pools. The background worker stays disabled in multi mode until it is made tenant-aware.

To register a customer database after the provider has created it and the app migrations have been applied:

1. Set `CONTROL_DATABASE_URL`, `TENANT_ENCRYPTION_KEY`, `TENANT_SLUG`, `TENANT_NAME`, `TENANT_DATABASE_URL`, and a valid `DATABASE_URL` in a trusted local environment file. Never paste database URLs or keys into chat or commit them.
2. Run `npm run migrate:deploy -w @do/api` with `DATABASE_URL` temporarily set to `TENANT_DATABASE_URL`, then seed the tenant database with a unique initial super-admin account.
3. Run `npx tsx apps/api/scripts/register-tenant.ts` from the repository root. Registration refuses to overwrite an existing slug and does not create or delete database resources.
4. Configure the API's `CONTROL_DATABASE_URL`, `TENANT_ENCRYPTION_KEY`, `TENANCY_MODE=multi`, then deploy the API and set the matching frontend `VITE_TENANT_SLUG`.

`DATABASE_URL` remains required by Prisma's generated client even in multi mode, but the request hook fails closed if a request has no registered tenant. Keep it pointed to a non-customer control database in multi mode. Health checks and CORS preflight requests are exempt from tenant resolution.

## Provider limits and production cutover

The connected Prisma Postgres installation is on the **Free** plan: up to 50 databases, 2 GB total storage, and 100,000 monthly database operations. Current spend shown is 0. These are shared installation limits, not per-customer allowances. The separate `distributor-demo-db` resource is on `free` and is connected only to the API project Preview environment with the `DEMO_` prefix. Preview builds with `DEMO_MODE=true` migrate and seed that database; production builds continue using the existing production `DATABASE_URL`. If provisioning needs a paid plan or exceeds included quota, stop and get the owner's approval before upgrading.

This branch is a routing foundation, not a complete SaaS console: tenant provisioning, owner-facing customer controls, subscription management, backups/restores, and automated per-tenant migration orchestration are still outstanding. Do not switch the production API to multi mode until the separate control DB exists, the current production database is safely migrated as a tenant, every database is backed up and migrated, tenant registration and login have been exercised in preview, and a rollback is prepared. No production database or Vercel environment variable was changed by this foundation.


The isolated Preview demo seeds a demo-admin account from DEMO_SEED_ADMIN_* variables. Keep its password in the Preview secret variable; do not include it in source control.
