# Turk-pen — UPVC Accessories (Distributor Orders v2) — PostgreSQL edition

## Phase 1 — Database + Auth

```bash
npm install
cp .env.example apps/api/.env        # edit secrets; keep POSTGRES_PASSWORD and DATABASE_URL in sync
npm run db:up                         # PostgreSQL in Docker (wait until healthy)
cd apps/api
npx prisma migrate dev --name init    # creates all tables
```

Apply the additional CHECK constraints:

```bash
npx prisma migrate dev --create-only --name checks
# copy the contents of prisma/checks.sql into the new prisma/migrations/*_checks/migration.sql
npx prisma migrate dev
```

```bash
cd ../..
npm run api:seed      # super_admin + warehouse from SEED_* env vars
npm run api:dev       # http://localhost:3000
```

For production, set `DATABASE_URL` to the PostgreSQL connection string from your database provider,
then run `prisma migrate deploy` and the admin seed once.

### Database design notes
| Concern | PostgreSQL implementation |
|---|---|
| enum-like values | `VARCHAR` + CHECK; shared values in `packages/shared/src/enums.ts` |
| non-negative quantities | signed `INT/BIGINT` + CHECK constraints |
| JSON payloads | serialized text + PostgreSQL JSON validation CHECK; helpers in `lib/json.ts` |
| text search | Prisma `contains` with case-insensitive mode |
| Arabic text | PostgreSQL UTF-8 text columns |
| relation deletes | explicit `NoAction` (+ `Cascade` only for order children / variants / refresh tokens) |

Usernames are compared case-insensitively and stored in lowercase.

### Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | /api/v1/auth/login | `{username,password}` → `{accessToken,user}` + refresh cookie |
| POST | /api/v1/auth/refresh | rotates refresh cookie, returns new access token |
| POST | /api/v1/auth/logout | revokes token family |
| POST | /api/v1/auth/password-request | always 202 (no user enumeration) |
| GET | /api/v1/auth/me | Bearer access token |

## Phase 2 — Catalog + Stock

Auth required on everything. Distributor endpoints (any logged-in role):

| Method | Path | Notes |
|---|---|---|
| GET | /api/v1/categories | active categories |
| GET | /api/v1/products?category=<id\|slug>&q=&page=&pageSize= | variants with `price`, `yourPrice` (user default discount only), `available` |
| GET | /api/v1/products/:id | |

Admin (`admin` / `super_admin`), under `/api/v1/admin`:

| Group | Paths |
|---|---|
| Categories | GET/POST `/categories`, PATCH/DELETE `/categories/:id` |
| Products | GET/POST `/products`, GET/PATCH/DELETE `/products/:id` |
| Variants | POST `/variants`, PATCH/DELETE `/variants/:id` |
| Warehouses | GET/POST `/warehouses`, PATCH `/warehouses/:id` |
| Stock | GET `/stock`, POST `/stock/adjust` `{variantId, warehouseId, delta, type: receipt\|adjustment, note}`, GET `/stock/movements` |

DELETE is a soft delete (`is_active = 0`). Money is sent/returned as strings. BigInt ids are returned as strings.
Stock adjust is one atomic UPDATE (never below `reserved`) + a `stock_movements` row + an audit row in one transaction.

## Phase 3 — Orders

Distributor (any logged-in user), under `/api/v1`:

| Method | Path | Notes |
|---|---|---|
| POST | /cart/price | `{items:[{variantId,qty}], warehouseId?}` → priced lines, totals, `fulfillableWarehouses`, `shortages` |
| POST | /orders | `{items, warehouseId?, notes?}` → 201 order. One transaction: re-price, number, order + items, reserve stock, queue notification |
| GET | /orders?status=&page= | own orders only |
| GET | /orders/:id | own order with status timeline (someone else's id => 404) |
| POST | /orders/:id/cancel | only while status is `new` |

Admin, under `/api/v1/admin`:

| Method | Path | Notes |
|---|---|---|
| GET | /orders?status=&q=&userId=&from=&to=&page= | `from`/`to` = YYYY-MM-DD (inclusive) |
| GET | /orders/:id | includes distributor and full history |
| PATCH | /orders/:id/status | `{status, note?}` |

Status flow: `new → confirmed → in_production → ready → delivered`; `cancelled` is allowed from any non-final status.

Rules
- Prices and discounts are computed on the server only. Discount = the best of the user's `default_discount_pct` and any applicable active `discounts` row (no stacking). Each line's discount is rounded to 2 decimals (half up).
- An order ships from a single warehouse: the first active one that can fulfil every line (or the requested one).
- Reservation on create (`reserved += qty`); cancel releases it; `delivered` ships it (`on_hand -= qty`, `reserved -= qty`). Every change writes `stock_movements`.
- Status changes are compare-and-set, so two admins (or admin + distributor) can't both win.
- Order numbers: `ORD-<year>-<6 digits>` from `order_counters`.
- Notifications are queued in `notification_queue` inside the same transaction as the order, then delivered by the worker (Phase 6).

## Phase 4 — Distributor web app (`apps/web`)

React 18 + Vite + TypeScript, Tailwind (RTL, dark by default + light), Framer Motion, TanStack Query, Zustand.

```bash
npm install                 # from the repo root
npm run api:dev             # terminal 1  (http://localhost:3000)
npm run web:dev             # terminal 2  (http://localhost:5173)
```

Vite proxies `/api` to `localhost:3000`, so the browser talks to one origin and the httpOnly refresh cookie works with no CORS setup.
Log in with a user created in the API (the seeded super_admin works; distributors are created by an admin — the Users screen arrives in Phase 5, until then insert via `POST`/seed).

Screens: login (+ password reset request), home, catalog (search, category chips, pagination), product details (variants, qty, availability),
cart drawer, checkout (server-priced, stock shortage messages), my orders (status filter, load more), order details (animated timeline, cancel while `new`), profile.

Notes
- Prices/discounts/totals are always the server's (`POST /cart/price`); the browser never computes money.
- The access token is kept in memory only; on page load the app silently calls `/auth/refresh`.
- The cart is persisted in `localStorage` (items + quantities only) and cleared on logout.
- `npm run web:build` type-checks then builds to `apps/web/dist`.

## Phase 5 — Admin panel

Admin (`admin` / `super_admin`) UI at `/admin`. Distributors are redirected away.

| Method | Path | Notes |
|---|---|---|
| GET/POST/PATCH/DELETE | `/admin/users` | Soft-delete via `isActive`. Only `super_admin` assigns admin roles |
| GET | `/admin/password-requests` | |
| POST | `/admin/password-requests/:id/resolve` | `{status: resolved\|rejected, newPassword?}` |
| GET/POST/PATCH/DELETE | `/admin/discounts` | Best (highest) applicable pct wins; no stacking |
| GET | `/admin/reports/dashboard` | KPIs, 14-day series, low stock, recent orders |
| GET | `/admin/reports/sales?from=&to=` | Daily series, top products, top distributors |
| GET | `/admin/orders/board` | Latest 40 orders per status for the Kanban |

Screens: dashboard, orders (Kanban + table), order details (status + print), stock + movements, products/variants/categories, users, discounts, password requests, reports.

## Phase 6 — Notifications (SSE + WhatsApp)

**Who gets what** (rows are written in the order's own transaction. WhatsApp messages are queued after commit):

| Event | Admins | Distributor (order owner) |
|---|---|---|
| Order created | in-app (SSE) + WhatsApp (if opted in) | – |
| Admin changes status | other admins: in-app | in-app + WhatsApp (if opted in) |
| Distributor cancels | in-app + WhatsApp (if opted in) | – |

**Queue lifecycle** (`notification_queue.status`): `pending → sent` only after the provider confirmed the send; a failure goes back to
`pending` with exponential back-off (60 s, 120 s) and becomes `failed` after 3 attempts (or immediately for an invalid phone number).
If `WHATSAPP_API_URL` is not set, whatsapp rows simply stay `pending` (they are never marked `sent`); rows older than 24 h are expired instead of sent.

**WhatsApp providers** — Meta Cloud API, Evolution API, or CallMeBot (testing). On Vercel, the transactional outbox publishes to Vercel Queues and a private queue-triggered Function delivers with retries. Configure `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, and `WHATSAPP_PROVIDER` in Vercel. For Meta, `WHATSAPP_API_URL` must include the Cloud API Phone Number ID and `/messages`; also set the two approved template names (`WHATSAPP_ORDER_CREATED_TEMPLATE`, `WHATSAPP_ORDER_STATUS_TEMPLATE`) and `WHATSAPP_TEMPLATE_LANGUAGE`. Create templates with body variables in this order: order-created = order number, distributor, total, currency; status = order number, Arabic status. Phone numbers
are normalised to digits-only international format (`01012345678` → `201012345678`, controlled by `WHATSAPP_DEFAULT_COUNTRY_CODE`). Each account must enable WhatsApp opt-in from Profile before order messages can be sent.

**Frontend**: exactly one `EventSource` (`apps/web/src/store/sse.ts`). The bell counter, toasts and react-query invalidation all hang off it
(`subscribe()`), and a reconnect triggers a refetch so nothing is missed while offline.

## Phase 7 — PWA, animation polish, mobile

```bash
npm install                 # picks up vite-plugin-pwa + workbox-window
npm run web:build           # tsc + vite build  → apps/web/dist (manifest.webmanifest, sw.js, workbox-*.js)
npm run -w @do/web preview  # test the PWA locally (service workers don't run in `vite dev`)
```

**PWA** (`apps/web/vite.config.ts`): name/short_name/description in Arabic + English, `lang=ar dir=rtl`, standalone, icons 192/512 + maskable,
shortcuts (المنتجات / طلباتي). The service worker precaches the app shell and falls back to `index.html` for navigations
(except `/api/*`). Fonts and images are cached at runtime. **`/api/*` is never cached** (authenticated per-user data); offline you get the
shell plus a red "لا يوجد اتصال" banner. Updates are user-driven: a "يتوفر إصدار جديد — تحديث" card appears, nothing reloads mid-order.
Install: Android/Chrome shows a native prompt via the in-app banner / Profile button; iOS Safari shows "Share → Add to Home Screen" instructions.

Deploy checklist: serve over **HTTPS**; serve `sw.js` and `index.html` with `Cache-Control: no-cache`; assets under `/assets/*` can be `immutable`;
proxy `/api` to Fastify (same origin) so the refresh cookie and SSE keep working; for SSE behind nginx keep `proxy_buffering off`.

**Motion**: shared presets in `components/motion.tsx` (`Stagger`/`StaggerItem`). Only `opacity`/`transform` are animated.
`<MotionConfig reducedMotion="user">` + a CSS `prefers-reduced-motion` block disable movement for users who ask for it (the loading spinner stays).
Cart drawer: spring slide, swipe the header to dismiss, scroll lock, Esc, safe-area padding. Modals are bottom sheets on phones.
Buttons use `<BtnLabel loading>` so a loading state never changes the button's width.

## Product images and admin AI

- Product images use Vercel Blob. Create a **public** Blob store in the Vercel project and add its `BLOB_READ_WRITE_TOKEN` to the API project's Production and Preview environments. Admins can upload JPG, PNG, WebP, or AVIF images up to 5 MB from product create/edit screens.
- Bulk product creation accepts a UTF-8 CSV file (up to 200 rows / 2 MB). Download the template from **Admin → Products → Import CSV**. Required columns are `name`, `category` (category name, slug, or ID), and `basePrice`; optional columns include unit, stock, SKU, variant, description, and image URL. The page previews and validates rows before sending them through the normal product-creation API.
- The report assistant uses Vercel AI Gateway. Add `AI_GATEWAY_API_KEY` and `AI_GATEWAY_MODEL` (a model ID available in your AI Gateway account) to the API project's Production and Preview environments. It sends only the selected period's aggregate totals and status counts, not distributor identities or order details.
- After changing Vercel environment variables, redeploy the API project for them to take effect. Local development reads the same variables from `apps/api/.env`.
