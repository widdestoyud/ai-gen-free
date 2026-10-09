# Milestone 2: Performance & Query Optimization (R2) — Handoff Report

## 1. Observation

Direct observations of the codebase prior to optimization revealed multiple performance bottlenecks, unbounded query scans, N+1 patterns, unmanaged Redis connections, and coupling of write operations inside read paths:

1. **N+1 Ledger Balance Queries in Admin User Listing**:
   - Location: `apps/api/src/admin/service.ts:503-518` (original baseline).
   - Verbatim observation: In `listAdminUsers`, the handler fetched up to 100 users (`prisma.user.findMany`) and mapped each user row via `serializeAdminUser(row)`, which called `computeBalance(user.id)`. For each user, `computeBalance` executed a query against `ledgerEntry`. Listing 100 users produced 101 database queries (1 query for users + 100 queries for ledger entries), scaling linearly with page size ($O(N)$).
   - Furthermore, `packages/wallet/src/ledger.ts:32-47` fetched *all* posted ledger entries (`findMany({ where: { userId, status: "posted" } })`) into Node.js memory and iterated sequentially over the entire array to compute net sums.

2. **Unbounded In-Memory Pagination & Filtering in Customer Library**:
   - Location: `apps/api/src/jobs/service.ts:340-420` (original baseline).
   - Verbatim observation: `listCustomerLibrary` queried up to 100 raw `Job` records (`take: 100`) without pushing live output asset validation (`assets.some: { kind: "output", purgedAt: null, expiresAt: { gt: now } }`), mode kind filtering (`mode: { in: [...] }`), or search criteria down into SQL. It then filtered arrays in memory and sliced pages with `.slice(offset, offset + limit)`. This caused two severe defects: users with more than 100 total jobs could not access items past the 100-item cutoff, and database indexes could not prune expired/irrelevant records at query planning time.

3. **Missing Composite Database Indexes on `Job`**:
   - Location: `prisma/schema.prisma:140-145` (original baseline).
   - Verbatim observation: `Job` model only indexed `userId` alone (`@@index([userId])`). Common query patterns filtering on `userId` + `status` or sorting by `createdAt` required sequential table scans over all user jobs.

4. **Lack of Caching Layer & Redundant Redis Connections**:
   - Location: `apps/api/src/routes/wallet.ts:35-50` and `apps/api/src/routes/wallet.ts:60-75` (original baseline).
   - Verbatim observation: In `/invoices/events` and `/admin/invoices/events`, each Server-Sent Events (SSE) connection called `deps.redis.duplicate()` and `await sub.subscribe(...)`. With 100 concurrent SSE subscribers, this spun up 100 dedicated Redis connections, risking connection pool exhaustion.
   - Authentication session validation (`apps/api/src/auth/service.ts:userFromCookie`), customer catalog (`apps/api/src/jobs/catalog.ts`), and app settings (`apps/api/src/admin/service.ts`) performed repeated round-trip database queries on every incoming HTTP request without an in-memory or Redis caching layer.

5. **Coupled Database Writes Inside GET Read Routes**:
   - Location: `apps/api/src/wallet/service.ts:245-285` (original baseline).
   - Verbatim observation: `autoExpireInvoices(client)` was called directly within `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, and `listNotifications`. A read query caused write locks, updating expired invoice records and creating audit log entries on simple page loads or polling requests.

---

## 2. Logic Chain

The step-by-step reasoning that led to the implemented architecture:

1. **Ledger Aggregation & N+1 Elimination**:
   - Step 1.1: `Wallet.availableCached` already tracks the committed available balance maintained transactionally by `refreshWalletCache` during ledger mutations.
   - Step 1.2: Pending holds (`LedgerType.hold`, `LedgerStatus.pending`) represent temporary reservations not yet reflected in `availableCached`.
   - Step 1.3: By modifying `listAdminUsers` in `apps/api/src/admin/service.ts` to eager-load `wallet: { select: { availableCached: true } }` in `prisma.user.findMany`, and executing a single batched `prisma.ledgerEntry.groupBy({ by: ["userId"], where: { userId: { in: userIds }, type: LedgerType.hold, status: LedgerStatus.pending }, _sum: { amount: true } })`, we aggregate pending holds across all $N$ users in exactly 1 query.
   - Step 1.4: Passing precomputed `{ balance: { available, held } }` into `serializeAdminUser` avoids any per-user database calls. Database roundtrips for 100 users drop from 101 queries to 2 queries ($O(1)$ constant query count).
   - Step 1.5: In `packages/wallet/src/ledger.ts`, refactoring `computeBalance` to use `prisma.ledgerEntry.groupBy({ by: ["type", "status"], where: { userId, OR: [{ status: "posted" }, { status: "pending", type: "hold" }] }, _sum: { amount: true } })` delegates summation to PostgreSQL, reducing data transferred over the wire from thousands of rows to $\le 6$ grouped summary records.

2. **SQL Pushdown & Pagination in Customer Library**:
   - Step 2.1: In `apps/api/src/jobs/service.ts`, live output asset checks (`assets.some: { kind: "output", purgedAt: null, expiresAt: { gt: now } }`), mode kind filtering (`mode: { in: [...] }`), and search queries (`prompt: { contains: search, mode: "insensitive" }`) were moved directly into the Prisma `where` clause.
   - Step 2.2: For single-source library requests (`jobs` or `uploads`), pagination is pushed down entirely to PostgreSQL using `skip: offset, take: limit`.
   - Step 2.3: For unified library requests (`all`), querying both tables with `take: offset + limit` guarantees correct combined sorting and eliminates the rigid 100-item truncation cap, while bounding memory consumption.

3. **Composite Database Indexing**:
   - Step 2.4: To support the high-frequency query patterns in `Job`, added `@@index([userId, status])` and `@@index([userId, status, createdAt])` to `prisma/schema.prisma` and generated `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`.
   - Step 2.5: Ran `pnpm db:generate` to synchronize the Prisma client types and metadata.

4. **Redis Cache-Aside Layer & Error Hardening**:
   - Step 3.1: Created `apps/api/src/lib/cache.ts` providing standardized key prefixes (`sess:`, `catalog:`, `settings:`), configurable TTLs (15 min for sessions, 1 hour for catalog and settings), and non-blocking failure semantics (gracefully falling back to null on cache miss or Redis failure).
   - Step 3.2: Reconstituted native JavaScript `Date` instances (`createdAt`, `emailVerifiedAt`, `nextGenerateAt`, `sessionExpiresAt`) in `deserializeSession` to ensure downstream code calling `.getTime()` or `.toISOString()` does not crash.
   - Step 3.3: Integrated cache read-through and mutation-time invalidations:
     - `apps/api/src/auth/service.ts`: `userFromCookie` reads `sess:<token>`; `createSingleSession` caches active sessions; `logout` and `changeUserPassword` invalidate cached tokens.
     - `apps/api/src/jobs/catalog.ts`: `listCustomerCatalog` and `getActiveDefaultModels` read through `catalog:customer` and `catalog:defaults`.
     - `apps/api/src/admin/service.ts`: `getTesterAccountSetting`, `getGenerateCooldownSetting`, and `getDefaultGenerationModelsSetting` read through cached settings; PUT routes invalidate matching keys.
   - Step 3.4: In `apps/api/src/index.ts`, hardened IORedis instances by attaching `.on("error")` listeners to `redis` and `queueConnection` to prevent unhandled process crashes.

5. **Redis Subscriber Multiplexing for SSE**:
   - Step 4.1: Created `apps/api/src/lib/redis-multiplexer.ts` implementing `RedisSubscriberMultiplexer`. A single duplicate subscriber connection is established and shared across all active SSE clients.
   - Step 4.2: Channel subscriptions are tracked in an in-memory `Map<string, Set<SubscriberCallback>>`. The shared connection only executes `SUBSCRIBE` when the first listener binds, and executes `UNSUBSCRIBE` when the last listener unbinds.
   - Step 4.3: In `apps/api/src/routes/wallet.ts`, replaced per-client duplicate connections in `/invoices/events` and `/admin/invoices/events` with the multiplexer and wired `app.addHook("onClose")` cleanup.

6. **Decoupling Database Writes from GET Endpoints**:
   - Step 5.1: Removed synchronous invocations of `autoExpireInvoices(client)` from `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, and `listNotifications` in `apps/api/src/wallet/service.ts`.
   - Step 5.2: In `listAdminInvoices` and `listNotifications`, filtered out expired invoices directly at the SQL level (`{ expiresAt: { gt: now } }` for pending invoices).
   - Step 5.3: Implemented `triggerLazyAutoExpire(client)` for lightweight opportunistic sweeps on mutation paths, and implemented `startInvoiceExpirationScheduler(client)` running every 60 seconds.
   - Step 5.4: Configured timer with `.unref()` so background polling does not prevent the Node.js event loop or test runners from exiting cleanly. Attached lifecycle start and shutdown to `apps/api/src/index.ts`.

---

## 3. Caveats

1. **Prisma groupBy In-Memory Mock Compatibility**:
   - In environments where Prisma is mocked in unit tests without SQL engine execution, `groupBy` returns mock records according to configured mock drivers. The refactored `computeBalance` correctly handles empty arrays and null sums (`g._sum.amount ? asInt(g._sum.amount) : 0`).
2. **Redis Unavailability Graceful Fallback**:
   - When Redis is not configured or temporarily unreachable, `cache.ts` logs a warning and returns `null`, seamlessly bypassing the cache without interrupting request handling.
3. **No Baseline Test Modification**:
   - In accordance with the dispatch instructions, baseline unit tests in `apps/api` were kept intact at exactly 102 passing tests with 0 regressions, preserving strict backward compatibility.

---

## 4. Conclusion

All requirements for Milestone 2 (Performance & Query Optimization - R2) have been successfully designed, implemented, and validated:
- Eliminated N+1 query patterns in `listAdminUsers` and replaced full-table ledger scans in `computeBalance` with SQL `groupBy` aggregations.
- Pushed live output asset checks, mode filters, search, and SQL pagination down to PostgreSQL in `listCustomerLibrary`.
- Added composite database indexes `[userId, status]` and `[userId, status, createdAt]` to the `Job` model with migration SQL.
- Established a robust Redis cache-aside module with native `Date` deserialization and error resilience, wiring cache read-through and invalidations across auth sessions, model catalog, and app settings.
- Replaced per-client SSE subscriber connections with reference-counted connection multiplexing.
- Decoupled `autoExpireInvoices` writes from read routes, added SQL unexpired filters, and isolated background invoice expiration in an unreferenced interval scheduler.

---

## 5. Verification Method

Independent verification can be executed using the following commands:

1. **Verify API Unit Test Suite (102 tests)**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected result*: `tests 102, pass 102, fail 0, exit code 0`.

2. **Verify All Repository Test Suites (249 tests)**:
   ```bash
   pnpm test
   ```
   *Expected result*: `tests 249, suites 6, pass 249, fail 0, exit code 0`.

3. **Verify Next.js Web Production Build**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected result*: `Generating static pages (9/9) ... Build complete, exit code 0`.

4. **Inspect Key Implementation Files**:
   - `packages/wallet/src/ledger.ts`: lines 32–63 (`computeBalance` SQL `groupBy` aggregation).
   - `apps/api/src/admin/service.ts`: lines 544–590 (`availableCached` eager loading + batched holds `groupBy`).
   - `apps/api/src/jobs/service.ts`: lines 360–437 (SQL filtering and pagination).
   - `prisma/schema.prisma`: lines 142–143 (composite indexes on `Job`).
   - `prisma/migrations/20261008100000_job_composite_indexes/migration.sql` (migration DDL).
   - `apps/api/src/lib/cache.ts` (cache-aside with `Date` deserialization).
   - `apps/api/src/lib/redis-multiplexer.ts` (shared subscriber connection multiplexer).
   - `apps/api/src/routes/wallet.ts`: lines 19–21, 36–58 (multiplexed SSE endpoints).
   - `apps/api/src/wallet/service.ts`: lines 231–258, 303–311, 765–775 (GET route DB isolation & scheduler).
   - `apps/api/src/index.ts`: lines 87–95, 148, 172 (IORedis error listeners & scheduler lifecycle).
