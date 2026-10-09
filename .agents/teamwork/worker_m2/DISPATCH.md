# Dispatch: Milestone 2 Performance & Optimization Worker

## Objective
Implement all performance optimizations, database query improvements, Redis caching, SSE multiplexing, and route decoupling for Milestone 2 as specified in:
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md`
- `/home/ubuntu/projects/ai-gen-free/PROJECT.md`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_1/handoff.md`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/handoff.md`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3/handoff.md`

## Mandatory Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Scope & File Ownership
You have exclusive write ownership of these files:
- `apps/api/src/admin/service.ts`
- `apps/api/src/jobs/service.ts`
- `packages/wallet/src/ledger.ts`
- `apps/api/src/wallet/service.ts`
- `apps/api/src/routes/wallet.ts`
- `apps/api/src/index.ts`
- `apps/api/src/lib/cache.ts`
- `apps/api/src/lib/redis-multiplexer.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`

## Concrete Tasks
1. **N+1 Elimination in `listAdminUsers`** (`apps/api/src/admin/service.ts`):
   - Eager-load `wallet: { select: { availableCached: true } }` in `prisma.user.findMany`.
   - Aggregate holds across all page users using a single batch `prisma.ledgerEntry.groupBy` query.
   - Use `balance: { available, held }` in `serializeAdminUser` to avoid calling `computeBalance` per user in a loop.
2. **Customer Library SQL Pagination** (`apps/api/src/jobs/service.ts`):
   - Push live output asset filtering (`assets.some: { kind: "output", purgedAt: null, expiresAt: { gt: now } }`) to Prisma `where`.
   - Push kind filtering (`video` vs `image`) via `mode: { in: [...] }` to Prisma `where`.
   - Push SQL pagination (`skip: offset, take: limit`) directly down to SQL for single-source queries, and use `take: offset + limit` for unified union queries instead of hardcoded `take: 100`.
3. **Ledger Aggregation in `computeBalance`** (`packages/wallet/src/ledger.ts`):
   - Replace memory-heavy `findMany` full historical scan with Prisma `groupBy({ by: ['type', 'status'], _sum: { amount: true } })`.
   - Update `adjustWallet` to reuse this optimized `computeBalance`.
4. **Redis Caching of Hot Entities** (`apps/api/src/lib/cache.ts` & callers):
   - Implement cache-aside for sessions (`userFromCookie`), Model Catalog, and App Settings.
   - Ensure proper Date deserialization and graceful fallback when Redis is absent/disconnected.
   - Wire invalidation hooks into session revocation, logout, admin catalog updates, and admin settings updates.
5. **SSE Subscription Multiplexing** (`apps/api/src/lib/redis-multiplexer.ts` & `apps/api/src/routes/wallet.ts`):
   - Implement `RedisSubscriberMultiplexer` holding a single duplicated subscriber connection with an in-memory listener map.
   - Replace per-client `deps.redis.duplicate()` in `/invoices/events` and `/admin/invoices/events`.
6. **IORedis Error Handling & Background Isolation** (`apps/api/src/index.ts`):
   - Attach `.on("error")` handlers on all IORedis instances.
   - Start the periodic invoice expiration scheduler on app startup and shut it down cleanly on app exit.
7. **GET Route DB Isolation** (`apps/api/src/wallet/service.ts`):
   - Remove `await autoExpireInvoices()` from `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, and `listNotifications`.
   - Update `listNotifications` and `listAdminInvoices` queries to filter unexpired invoices directly in SQL SELECT.
8. **Composite Indexes on `Job`** (`prisma/schema.prisma`):
   - Add `@@index([userId, status])` and `@@index([userId, status, createdAt])`.
   - Generate client (`pnpm db:generate`) and migration SQL.

## Verification
- Run `pnpm --filter @ai-gen-free/api test` (must pass 102/102 baseline tests).
- Run `pnpm test` (must pass repository test suites).
- Record all commands, outputs, and verification details in `handoff.md`.
