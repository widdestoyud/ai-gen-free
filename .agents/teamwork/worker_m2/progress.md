# Progress Log — Milestone 2 Performance & Optimization Worker

Last visited: 2026-10-08T10:00:00Z

## Status
- [x] Read DISPATCH.md and Explorer handoff reports (explorer_m2_1, explorer_m2_2, explorer_m2_3).
- [x] Initialized BRIEFING.md and progress.md.
- [x] Verified initial baseline (102/102 passing tests).
- [x] Step 1: Database Query Optimization
  - [x] `packages/wallet/src/ledger.ts`: groupBy aggregation in `computeBalance`, reused in `adjustWallet`.
  - [x] `apps/api/src/admin/service.ts`: Eager-loaded `availableCached` + single groupBy query for pending holds in `listAdminUsers`.
  - [x] `apps/api/src/jobs/service.ts`: Pushed live assets, mode filtering, search, and SQL pagination down to Prisma.
  - [x] `prisma/schema.prisma`: Added `@@index([userId, status])` and `@@index([userId, status, createdAt])`.
  - [x] Generated migration `prisma/migrations/20261008100000_job_composite_indexes/migration.sql` and ran `pnpm db:generate`.
- [x] Step 2: Redis Caching & Connection Multiplexing
  - [x] `apps/api/src/lib/cache.ts`: Cache-aside for sessions, catalog, and app settings with Date deserialization and graceful fallback.
  - [x] `apps/api/src/lib/redis-multiplexer.ts`: Shared subscriber multiplexer over duplicated connection.
  - [x] `apps/api/src/routes/wallet.ts`: Multiplexed `/invoices/events` and `/admin/invoices/events` with clean onClose teardown.
  - [x] `apps/api/src/index.ts`: Hardened IORedis with `.on("error")` handlers and set cache instance.
  - [x] `apps/api/src/auth/service.ts` & `apps/api/src/jobs/catalog.ts` & `apps/api/src/admin/service.ts`: Wired cache read-through and mutation invalidations.
- [x] Step 3: GET Route Isolation & Background Decoupling
  - [x] `apps/api/src/wallet/service.ts`: Removed `autoExpireInvoices` from GET read routes, added unexpired SQL query filters, added `triggerLazyAutoExpire()`, implemented `startInvoiceExpirationScheduler` with `.unref()`.
  - [x] `apps/api/src/index.ts`: Started invoice expiration scheduler and wired clean graceful shutdown.
- [x] Step 4: Verification (API tests 102/102, repo test suites 249/249, web build 9/9 pages clean).
- [x] Step 5: Handoff report written to handoff.md.
