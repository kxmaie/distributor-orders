# Demo environment and customer database isolation

## Demo environment

The demo must use a dedicated PostgreSQL database and a separate Vercel deployment. Never point the demo at the production database.

API project settings:
- Root directory: `apps/api`
- `DATABASE_URL`: connection URL for the dedicated demo database
- `DEMO_MODE=true`
- `JWT_SECRET`: a new random secret, different from production
- `CORS_ORIGIN`: the demo website origin
- `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`: private demo login credentials

Web project settings:
- Root directory: `apps/web`
- `VITE_API_BASE_URL`: demo API origin plus `/api/v1`
- `VITE_DEMO_MODE=true`

After provisioning the empty demo database, run the existing Prisma migrations and seed the sample catalog:

```powershell
npm run migrate:deploy -w @do/api
$env:DEMO_MODE = "true"
npm run seed -w @do/api
```

Run these commands with the demo database URL and demo seed credentials loaded in the local environment. Do not use production credentials. The seed operation is idempotent for its sample category, products, variants, and stock.

The API enforces demo read-only behavior server-side; hiding or disabling buttons in the browser is not a security boundary. When the demo frontend and API use separate Vercel hosts, demo refresh cookies use `SameSite=None; Secure` with credentialed CORS. Authentication and session endpoints remain available, while business writes return `403 DEMO_READ_ONLY`. The UI displays a demo banner. Demo customers should use temporary credentials shared privately, not a reusable public password.

## Separate database per customer

The codebase currently connects to one PostgreSQL database through `DATABASE_URL`. This demo foundation does not yet implement customer provisioning or tenant-aware database routing.

The production design should have:
1. A platform control database for tenant records, subscriptions, database references, provisioning status, and audit history.
2. One PostgreSQL database per customer, with a separate connection pool and credentials.
3. Tenant resolution and authorization in the API before any business query; a session must be bound to one tenant.
4. Encrypted database credentials stored server-side, never returned to the browser or written to logs.
5. Automated migrations, backup/restore, health checks, suspend/resume, and a safe first-tenant data migration.
6. A platform-owner role separate from each customer's own super-admin role.

The current production database must remain the existing single tenant until this routing and migration path is implemented and verified. Creating a demo deployment is independent of migrating or changing production data.
