# Milestone 2: Reviewer M2-1 (Database Query Optimizations) — Review & Adversarial Challenge Report

## Review Summary

- **Role**: Reviewer M2-1 (Database Query Optimizations) & Adversarial Critic
- **Target Worker**: `worker_m2`
- **Reviewed Scope**:
  - `apps/api/src/admin/service.ts` (Admin user listing N+1 elimination via `wallet.availableCached` eager loading + batched `groupBy` pending holds)
  - `apps/api/src/jobs/service.ts` (Customer library SQL pushdown for live output assets, mode filters, search, and pagination)
  - `packages/wallet/src/ledger.ts` (SQL `groupBy` aggregation with `_sum: { amount: true }` in `computeBalance(userId, tx?)`)
  - `prisma/schema.prisma` & `prisma/migrations/20261008100000_job_composite_indexes/migration.sql` (Composite indexes on `Job`)
- **Integrity Audit**: **PASS** (Zero integrity violations; no hardcoded test outputs, no facade implementations, no shortcuts, no fabricated logs).
- **Verdict**: **APPROVE**

---

## 1. Observation

Direct observations and evidence gathered during the review:

1. **Elimination of N+1 Ledger Queries in `listAdminUsers`**:
   - Location: `apps/api/src/admin/service.ts:544-590`
   - In `listAdminUsers`:
     ```ts
     prisma.user.findMany({
       where,
       orderBy,
       take: limit,
       skip,
       select: {
         id: true,
         email: true,
         role: true,
         nextGenerateAt: true,
         createdAt: true,
         wallet: {
           select: {
             availableCached: true,
           },
         },
       },
     })
     ```
   - Followed by batched hold resolution:
     ```ts
     const userIds = rows.map((r) => r.id);
     const heldByUserId = new Map<string, number>();
     if (userIds.length > 0) {
       const heldRows = await prisma.ledgerEntry.groupBy({
         by: ["userId"],
         where: {
           userId: { in: userIds },
           type: LedgerType.hold,
           status: LedgerStatus.pending,
         },
         _sum: { amount: true },
       });
       for (const h of heldRows) {
         if (h._sum.amount) heldByUserId.set(h.userId, Number(h._sum.amount));
       }
     }
     ```
   - In `serializeAdminUser` (`apps/api/src/admin/service.ts:486-496`):
     ```ts
     let bal: { available: number; held: number };
     if (extra.balance) {
       bal = extra.balance;
     } else if (user.wallet !== undefined) {
       bal = {
         available: user.wallet ? Number(user.wallet.availableCached) : 0,
         held: 0,
       };
     } else {
       bal = await computeBalance(user.id);
     }
     ```
   - Verbatim check: `serializeAdminUser` receives precomputed `extra.balance` from `heldByUserId` and `row.wallet.availableCached`. `computeBalance(user.id)` is completely bypassed inside the user loop. Total queries per page request are strictly bounded at 3 queries ($O(1)$) instead of $O(N + 1)$.

2. **SQL Pushdown and Pagination in `listCustomerLibrary`**:
   - Location: `apps/api/src/jobs/service.ts:356-420`
   - In `jobWhere`:
     ```ts
     const jobWhere: Prisma.JobWhereInput = {
       userId: opts.userId,
       status: JobStatus.succeeded,
       assets: {
         some: {
           kind: "output",
           purgedAt: null,
           expiresAt: { gt: now },
         },
       },
       ...spicyFilterCondition,
     };
     if (generatedKindFilter === "video") {
       jobWhere.mode = { in: ["t2v", "i2v"] };
     } else if (generatedKindFilter === "image") {
       jobWhere.mode = { in: ["t2i", "i2i", "inpaint", "faceswap"] };
     }
     if (search) {
       jobWhere.OR = [
         { alias: { contains: search, mode: "insensitive" } },
         { prompt: { contains: search, mode: "insensitive" } },
         { id: { contains: search, mode: "insensitive" } },
         { modelId: { contains: search, mode: "insensitive" } },
       ];
     }
     ```
   - For single-source requests (`isJobOnly = !includeUploads`):
     `skip: offset, take: limit` is executed directly in PostgreSQL.
   - For uploads (`isUploadOnly = !includeGenerated`):
     `skip: offset, take: limit` is executed directly in PostgreSQL.
   - For unified requests (`includeGenerated && includeUploads`):
     `take: fetchLimit` (`fetchLimit = offset + limit`) replaces the previous rigid `take: 100` cutoff, removing the truncation defect where items beyond index 100 were permanently hidden.

3. **SQL `groupBy` Aggregation in `computeBalance`**:
   - Location: `packages/wallet/src/ledger.ts:32-63`
   - Code:
     ```ts
     export async function computeBalance(userId: string, tx?: Prisma.TransactionClient) {
       const client = tx ?? prisma;
       const groups = await client.ledgerEntry.groupBy({
         by: ["type", "status"],
         where: {
           userId,
           OR: [
             { status: LedgerStatus.posted },
             { status: LedgerStatus.pending, type: LedgerType.hold },
           ],
         },
         _sum: {
           amount: true,
         },
       });

       let postedNet = 0;
       let held = 0;
       for (const g of groups) {
         const sum = g._sum.amount ? asInt(g._sum.amount) : 0;
         if (g.status === LedgerStatus.posted) {
           if (g.type === LedgerType.topup || g.type === LedgerType.refund || g.type === LedgerType.adjust) {
             postedNet += sum;
           } else if (g.type === LedgerType.capture) {
             postedNet -= sum;
           }
         } else if (g.status === LedgerStatus.pending && g.type === LedgerType.hold) {
           held += sum;
         }
       }
       return { available: postedNet - held, held, postedNet };
     }
     ```
   - In `adjustWallet` (`packages/wallet/src/ledger.ts:129`):
     `const bal = await computeBalance(opts.userId, tx);`
     The optional `tx` argument passes the transactional client directly into `computeBalance`, ensuring balance validation respects active pessimistic row locks (`SELECT "userId" FROM "Wallet" FOR UPDATE`).

4. **Composite Database Indexes on `Job` Model**:
   - Location: `prisma/schema.prisma:207-208`
   - Added schema indexes:
     ```prisma
     @@index([userId, status])
     @@index([userId, status, createdAt])
     ```
   - Migration DDL: `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`
     ```sql
     -- CreateIndex
     CREATE INDEX "Job_userId_status_idx" ON "Job"("userId", "status");

     -- CreateIndex
     CREATE INDEX "Job_userId_status_createdAt_idx" ON "Job"("userId", "status", "createdAt");
     ```

5. **Independent Test Execution Results**:
   - Command: `pnpm --filter @ai-gen-free/api test`
     - Output: `tests 102, suites 0, pass 102, fail 0, exit code 0`.
     - Zero test regressions on baseline suite.
   - Command: `pnpm test`
     - Output: `tests 249, suites 6, pass 249, fail 0, exit code 0`.
   - Command: `pnpm --filter @ai-gen-free/web build`
     - Output: Next.js 15.5.25 production build succeeded cleanly (`Generating static pages (9/9) ... Build complete, exit code 0`).

---

## 2. Logic Chain

1. **Elimination of N+1 Queries**:
   - *Premise*: Prior to this change, listing $N$ users in `listAdminUsers` triggered $N$ subsequent database roundtrips to compute ledger balances.
   - *Inference*: By eager-loading `wallet.availableCached` on `User` and aggregating pending holds in a single `prisma.ledgerEntry.groupBy` query across all returned `userIds`, the database roundtrips become $O(1)$ constant (1 count + 1 findMany + 1 groupBy).
   - *Confirmation*: Inspection of `apps/api/src/admin/service.ts:544-590` confirms `computeBalance` is no longer invoked in the loop over `rows`. When `userIds` is empty, `if (userIds.length > 0)` prevents executing an empty `IN` condition.

2. **Removal of 100-Item Truncation & SQL Pushdown in Library**:
   - *Premise*: In the baseline, `listCustomerLibrary` retrieved a hardcoded `take: 100` rows from the database and evaluated live asset status, expiration dates, mode filters, search terms, and slicing purely in Node.js memory. Users with > 100 jobs experienced silent truncation.
   - *Inference*: Pushing live asset filtering (`assets.some: { kind: "output", purgedAt: null, expiresAt: { gt: now } }`), mode filtering (`mode: { in: [...] }`), and search queries into `jobWhere` offloads row elimination to PostgreSQL index scans.
   - *Confirmation*: For single-source queries (`video`, `upload`), pagination (`skip: offset, take: limit`) executes purely in SQL. For multi-source queries (`all`), querying `take: offset + limit` guarantees correct combined sorting and eliminates the 100-item cutoff.

3. **Delegation of Ledger Summation to PostgreSQL Engine**:
   - *Premise*: Fetching all historical posted ledger entries for a user over the wire to sum them sequentially in Node.js wasted bandwidth, CPU, and memory, and did not support passing an active transaction client `tx`.
   - *Inference*: Grouping by `type` and `status` with `_sum: { amount: true }` in SQL aggregates potentially tens of thousands of rows down to $\le 6$ summary records directly within PostgreSQL.
   - *Confirmation*: `computeBalance(userId, tx?)` accepts `tx`, allowing `adjustWallet` to perform balance aggregation within the same transactional context as the pessimistic `FOR UPDATE` lock.

4. **Composite Index Alignment with Query Patterns**:
   - *Premise*: Frequently queried paths filter by `userId` and `status` (e.g. active jobs `pending`/`processing` or customer library `succeeded`) and sort by `createdAt DESC`.
   - *Inference*: Composite B-Tree indexes on `[userId, status]` and `[userId, status, createdAt]` allow PostgreSQL to execute index scans that prune non-matching records and provide pre-sorted ordering without an in-memory `Sort` node.
   - *Confirmation*: The indexes in `prisma/schema.prisma` and the migration DDL match the PROJECT.md specifications and Prisma's schema convention.

---

## 3. Adversarial Challenges & Stress Tests

### Challenge 1: Handling of Users with No Existing Wallet Record
- **Assumption Challenged**: Every user retrieved by `listAdminUsers` has an associated `Wallet` record.
- **Attack Scenario**: An older test user or edge-case registration created without a wallet record could trigger a null pointer access when reading `row.wallet.availableCached`.
- **Finding & Mitigation**: Line 585 of `apps/api/src/admin/service.ts` uses conditional chaining: `available: row.wallet ? Number(row.wallet.availableCached) : 0`. If `wallet` is null, it gracefully defaults to 0 without throwing.
- **Status**: PASSED.

### Challenge 2: Handling of Zero Ledger Records in `computeBalance`
- **Assumption Challenged**: Prisma `groupBy` aggregation returns non-null sums.
- **Attack Scenario**: A newly created user has 0 ledger records; `groupBy` returns `[]`.
- **Finding & Mitigation**: The loop `for (const g of groups)` does not execute when `groups` is empty, safely returning `{ available: 0, held: 0, postedNet: 0 }`. Furthermore, `g._sum.amount ? asInt(g._sum.amount) : 0` safely converts null/undefined sums to 0.
- **Status**: PASSED.

### Challenge 3: Transactional Row Lock Leakage in `adjustWallet`
- **Assumption Challenged**: Does `computeBalance(userId, tx)` execute within the active row-locked transaction?
- **Attack Scenario**: If `computeBalance` defaulted to the root `prisma` client, it would read from outside the transaction, risking dirty reads or concurrency anomalies.
- **Finding & Mitigation**: `packages/wallet/src/ledger.ts:33` uses `const client = tx ?? prisma;`. Line 129 passes `bal = await computeBalance(opts.userId, tx);`, guaranteeing transactional isolation.
- **Status**: PASSED.

### Challenge 4: Deep Pagination Memory Scaling in Unified Library (`rawType=all`)
- **Assumption Challenged**: Multi-source querying with `fetchLimit = offset + limit`.
- **Attack Scenario**: If a client requests `offset: 5000, limit: 20`, both jobs and uploads query `take: 5020`, merging up to 10,040 rows in Node.js memory.
- **Blast Radius**: Increased query latency on extreme deep pagination pages.
- **Mitigation / Recommendation**: In normal application usage, single-source queries (`video`, `image`, `upload`) push `skip` and `take` directly to SQL. For unified multi-source views, standard customer UI utilizes infinite scrolling with shallow offsets. If high-offset deep pagination is needed in the future, cursor-based pagination across multiple tables should be considered.
- **Risk Level**: LOW / Documented Caveat.

---

## 4. Integrity Violation Audit

| Integrity Dimension | Evaluation | Evidence |
|---------------------|------------|----------|
| Hardcoded Test Results | **CLEAN** | Source code contains real database queries; no synthetic values or mocks in production logic. |
| Facade/Dummy Implementations | **CLEAN** | Full database queries and aggregation logic implemented in `ledger.ts`, `jobs/service.ts`, `admin/service.ts`. |
| Task Shortcuts | **CLEAN** | All requirements from Milestone 2 (including composite indexes, migration DDL, SQL pushdown, and N+1 elimination) fully built. |
| Fabricated Logs / Outputs | **CLEAN** | Test executions independently reproduced and verified by this reviewer: 102 API unit tests passed, 249 repository tests passed, Next.js build passed. |
| Self-Certifying Work | **CLEAN** | Independent verification performed through automated test suites and source analysis. |

---

## 5. Caveats

1. **Unified Library Memory Usage on Extreme Offsets**:
   - For `rawType === "all"` or `rawType === "image"`, pagination uses `fetchLimit = offset + limit` to correctly merge and sort heterogeneous records from two database tables (`Job` and `Upload`). While this completely resolves the 100-item cutoff bug, offsets larger than several thousand items will retrieve corresponding row counts into memory before slicing.
2. **Prisma groupBy Mock Compatibility**:
   - Unit tests that do not connect to a real PostgreSQL instance require the test mock driver to support `groupBy`. The mock setup in `@ai-gen-free/api` and `@ai-gen-free/wallet` correctly supports this, with all 249 tests passing cleanly.

---

## 6. Conclusion

The Milestone 2 Database Query Optimizations implemented by `worker_m2` satisfy all architectural and functional requirements:
1. **N+1 queries eliminated**: `listAdminUsers` uses constant $O(1)$ query count by eager loading `wallet.availableCached` and executing a single `groupBy` for pending holds.
2. **Library SQL pushdown**: Live asset checking, mode filtering, search, and pagination are delegated to PostgreSQL, eliminating the rigid 100-item cutoff.
3. **Ledger balance aggregation**: `computeBalance` uses SQL `groupBy` with `_sum: { amount: true }`, reducing transferred payload from thousands of records to $\le 6$ summary objects, with full transaction client support.
4. **Composite indexes**: `[userId, status]` and `[userId, status, createdAt]` added to `Job` with valid migration DDL.
5. **Zero regressions**: 102/102 API tests pass, 249/249 repo tests pass, Next.js production build compiles cleanly.

**Final Verdict**: **APPROVE**

---

## 7. Verification Method

To independently reproduce and verify this assessment:

1. **Run API Unit Test Suite (102 tests)**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected outcome*: 102 tests passed, 0 failures, exit code 0.

2. **Run Monorepo Test Suites (249 tests across 6 packages)**:
   ```bash
   pnpm test
   ```
   *Expected outcome*: 249 tests passed, 6 suites passed, exit code 0.

3. **Run Production Web Build**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected outcome*: `Generating static pages (9/9) ... Build complete, exit code 0`.

4. **Inspect Source Files**:
   - `apps/api/src/admin/service.ts`: lines 544–590 (N+1 elimination & hold groupBy)
   - `apps/api/src/jobs/service.ts`: lines 356–420 (SQL pushdown & pagination)
   - `packages/wallet/src/ledger.ts`: lines 32–63 (SQL groupBy aggregation)
   - `prisma/schema.prisma`: lines 207–208 (composite indexes)
   - `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`: lines 1–6 (DDL)
