# Handoff Report: GET Route DB Write Isolation & Background Expiration Decoupling (M2 / Feature 12)

**Author:** teamwork_preview_explorer (Role: Route Decoupling & Background Isolation Explorer)  
**Date:** 2026-10-08T09:42:00Z  
**Target Milestone:** Milestone 2 — Performance & Query Optimization (R2)  
**Target Feature:** Feature 12 (GET Route DB Isolation: Decouple `autoExpireInvoices` from read routes)  
**Status:** Investigation & Implementation Strategy Complete (Read-Only)  

---

## 1. Observation

Direct observations from codebase inspection, schema analysis, and execution traces:

### A. Blocking Database Writes Inside Read-Only GET Endpoints
In `apps/api/src/wallet/service.ts`:
1. `getInvoiceForUser(userId: string, id: string)` (lines 139–144):
   ```typescript
   export async function getInvoiceForUser(userId: string, id: string) {
     await autoExpireInvoices();
     const invoice = await prisma.invoice.findFirst({ where: { id, userId } });
     if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
     return serializeInvoice(invoice, true);
   }
   ```
2. `listInvoicesForUser(userId: string, opts?: ...)` (lines 146–170):
   ```typescript
   export async function listInvoicesForUser(userId: string, opts?: { page?: number; limit?: number }) {
     await autoExpireInvoices();
     const page = Math.max(1, Number(opts?.page) || 1);
     const limit = Math.max(1, Math.min(100, Number(opts?.limit) || 10));
     const skip = (page - 1) * limit;

     const [total, rows] = await Promise.all([
       prisma.invoice.count({ where: { userId } }),
       prisma.invoice.findMany({
         where: { userId },
         orderBy: { createdAt: "desc" },
         skip,
         take: limit,
       }),
     ]);
   ```
3. `listAdminInvoices(opts?: ...)` (lines 186–195):
   ```typescript
   export async function listAdminInvoices(opts?: { ... }) {
     await autoExpireInvoices();
     ...
   ```
4. `listNotifications()` (lines 260–265):
   ```typescript
   export async function listNotifications() {
     await autoExpireInvoices();
     const whereReview = { status: "awaiting_review" as const };
     const whereOpen = { status: "unpaid" as const };
     ...
   ```

### B. Table-Wide Write Query in `autoExpireInvoices()`
In `apps/api/src/wallet/service.ts` (lines 171–184):
```typescript
export async function autoExpireInvoices() {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.invoice.updateMany({
    where: {
      status: "unpaid",
      OR: [
        { gatewayExpiredAt: { lte: now } },
        { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
      ],
    },
    data: { status: "expired" },
  });
}
```
`autoExpireInvoices()` executes an unconditional, table-wide `updateMany` mutation across the entire `Invoice` table. This write query acquires row/table locks and holds them inside read transactions triggered by GET routes.

### C. Corresponding Route Handlers in `apps/api/src/routes/wallet.ts`
All 4 read operations are mapped directly to HTTP GET routes:
- `GET /invoices/:id` (line 227) → calls `getInvoiceForUser(session.userId, id)`
- `GET /invoices` (line 217) → calls `listInvoicesForUser(session.userId, { page, limit })`
- `GET /admin/invoices` (line 366) → calls `listAdminInvoices(...)`
- `GET /admin/notifications` (line 360) → calls `listNotifications()`

No other GET route across `apps/api` executes database writes.

### D. Existing Dynamic Expiry Calculation in `serializeInvoice()`
In `apps/api/src/wallet/service.ts` (lines 693–704):
```typescript
  const amountIdr = asInt(invoice.amountIdr);
  const now = new Date();
  const manualExpiry = new Date(invoice.createdAt.getTime() + 60 * 60 * 1000);
  const isExpired =
    invoice.status === "expired" ||
    ((invoice.status === "unpaid" || invoice.status === "rejected") &&
      (invoice.gatewayExpiredAt
        ? new Date(invoice.gatewayExpiredAt) < now
        : manualExpiry < now));

  const effectiveStatus = isExpired ? "expired" : invoice.status;
```
`serializeInvoice()` ALREADY calculates `effectiveStatus` dynamically in memory for every invoice serialized. Even if a row has `status = "unpaid"` in the database, `serializeInvoice` returns `status: "expired"` and `statusLabel: "Kedaluwarsa"` if the cutoff has passed.

### E. Baseline Test Suite Verification
Command:
```bash
pnpm --filter @ai-gen-free/api test
```
Result:
```
ℹ tests 102
ℹ suites 0
ℹ pass 102
ℹ fail 0
ℹ duration_ms 13716.315823
```
Baseline suite passes with 102 passing tests.

---

## 2. Logic Chain

1. **Premise**: `autoExpireInvoices()` executes `prisma.invoice.updateMany` inside `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, and `listNotifications`.  
   **Inference**: Every GET read request to `/invoices`, `/invoices/:id`, `/admin/invoices`, and `/admin/notifications` initiates an exclusive database write transaction, violating RFC 9110 HTTP Safe/Idempotent semantics, preventing read replica offloading, and inducing write-lock contention against payment webhooks (`POST /webhooks/midtrans`) and checkout order creation (`POST /invoices`).

2. **Premise**: `serializeInvoice()` already contains in-memory dynamic expiry computation (`effectiveStatus = isExpired ? "expired" : invoice.status`), as observed in `apps/api/src/wallet/service.ts:696-704`.  
   **Inference**: Removing `await autoExpireInvoices()` from `getInvoiceForUser` and `listInvoicesForUser` leaves API response payloads 100% identical. The consumer (client/web frontend) receives `status: "expired"` immediately when an invoice reaches its cutoff, even if the database row has not yet been mutated.

3. **Premise**: In `listNotifications` and `listAdminInvoices`, active unpaid invoices need to be distinguished from expired unpaid invoices before database background sweeps run.  
   **Inference**: Modifying the SQL SELECT `where` condition to filter active unpaid invoices via:
   ```typescript
   whereOpen: {
     status: "unpaid",
     OR: [
       { gatewayExpiredAt: { gt: now } },
       { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } },
     ],
   }
   ```
   guarantees that `openCount` and `openRows` only count genuinely active invoices directly in SQL SELECT queries with ZERO database writes.

4. **Premise**: The database rows still need to eventually transition to `status: "expired"` for archival consistency and batch queries.  
   **Inference**: Encapsulating invoice expiration into a background interval scheduler (`startInvoiceExpirationScheduler`) started at API server initialization (`apps/api/src/index.ts`) with `.unref()` and registered teardown on graceful shutdown (`app.close()`) achieves background isolation with zero read latency overhead.

5. **Premise**: Mutating routes like `createInvoice` (POST) can safely trigger a non-blocking lazy background sweep (`triggerLazyAutoExpire`) via `setImmediate` with cooldown debouncing (30s).  
   **Inference**: This provides opportunistic cleanup on write paths while strictly protecting read paths from write operations.

---

## 3. Caveats

1. **Eventual DB State Consistency**: Invoices that reach their expiration timestamp between background sweeps will still have `status = "unpaid"` in the PostgreSQL table until the next periodic sweep runs (every 60s by default) or a mutation sweep runs. However, because `serializeInvoice()` and `listNotifications`/`listAdminInvoices` queries dynamically calculate expiration, neither end users nor admins will ever see an expired invoice as active.
2. **Clustered API Servers**: When running multiple API server replicas behind a reverse proxy (e.g. Docker Swarm or Kubernetes), each replica runs its own periodic timer. Since `prisma.invoice.updateMany` is idempotent (`status: "unpaid"` → `"expired"`), concurrent sweeps are safe. If enterprise clustering is desired, a Redis distributed lock (`redlock`) or a BullMQ repeatable job in `apps/worker` can coalesce sweeps into a single global worker task.
3. **Timer Unref in Node.js**: The background timer must use `.unref()` so it does not block the Node.js event loop from exiting in tests or during graceful shutdown.

---

## 4. Conclusion & Actionable Implementation Plan

### A. Summary of Changes
1. **Decouple `autoExpireInvoices()` from all read paths**:
   - Remove `await autoExpireInvoices();` from `getInvoiceForUser`
   - Remove `await autoExpireInvoices();` from `listInvoicesForUser`
   - Remove `await autoExpireInvoices();` from `listAdminInvoices`
   - Remove `await autoExpireInvoices();` from `listNotifications`
2. **Add SQL Query-Level Expiry Filtering**:
   - Update `listNotifications` to filter active unpaid invoices directly in SQL.
   - Update `listAdminInvoices` to support `status: "open"`, `status: "expired"`, and `status: "pending"` with non-expired / expired SQL conditions.
3. **Enhance `autoExpireInvoices()` & Add Background Scheduler**:
   - Return `{ count: number }` from `autoExpireInvoices()`.
   - Implement `startInvoiceExpirationScheduler(opts)` with graceful stop teardown.
   - Implement `triggerLazyAutoExpire()` for opportunistic non-blocking sweeps.
4. **Wire Scheduler into `apps/api/src/index.ts`**:
   - Start scheduler on app initialization.
   - Stop scheduler during graceful shutdown (`shutdown` function).
5. **Add Automated Unit Tests in `apps/api/src/wallet/wallet.test.ts`**:
   - Verify read endpoints execute 0 writes.
   - Verify dynamic status calculation.
   - Verify scheduler start/stop lifecycle.

---

### B. Precise Code Modifications

#### 1. Target File: `apps/api/src/wallet/service.ts`

##### Chunk 1.1: `getInvoiceForUser` and `listInvoicesForUser` (Lines 139–170)
**Before:**
```typescript
export async function getInvoiceForUser(userId: string, id: string) {
  await autoExpireInvoices();
  const invoice = await prisma.invoice.findFirst({ where: { id, userId } });
  if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  return serializeInvoice(invoice, true);
}

export async function listInvoicesForUser(userId: string, opts?: { page?: number; limit?: number }) {
  await autoExpireInvoices();
  const page = Math.max(1, Number(opts?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(opts?.limit) || 10));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    invoices: rows.map((row) => serializeInvoice(row, true)),
  };
}
```

**After:**
```typescript
export async function getInvoiceForUser(userId: string, id: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id, userId } });
  if (!invoice) throw new AuthError(ErrorCodes.NOT_FOUND, "Invoice tidak ditemukan", 404);
  return serializeInvoice(invoice, true);
}

export async function listInvoicesForUser(userId: string, opts?: { page?: number; limit?: number }) {
  const page = Math.max(1, Number(opts?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(opts?.limit) || 10));
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    invoices: rows.map((row) => serializeInvoice(row, true)),
  };
}
```

##### Chunk 1.2: `autoExpireInvoices`, `triggerLazyAutoExpire`, and `startInvoiceExpirationScheduler` (Lines 171–185)
**Before:**
```typescript
export async function autoExpireInvoices() {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.invoice.updateMany({
    where: {
      status: "unpaid",
      OR: [
        { gatewayExpiredAt: { lte: now } },
        { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
      ],
    },
    data: { status: "expired" },
  });
}
```

**After:**
```typescript
export async function autoExpireInvoices(): Promise<{ count: number }> {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const result = await prisma.invoice.updateMany({
    where: {
      status: "unpaid",
      OR: [
        { gatewayExpiredAt: { lte: now } },
        { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
      ],
    },
    data: { status: "expired" },
  });
  return { count: result.count };
}

let lastLazyAutoExpireAt = 0;
const LAZY_EXPIRE_COOLDOWN_MS = 30_000;

export function triggerLazyAutoExpire(): void {
  const now = Date.now();
  if (now - lastLazyAutoExpireAt < LAZY_EXPIRE_COOLDOWN_MS) return;
  lastLazyAutoExpireAt = now;
  setImmediate(() => {
    void autoExpireInvoices().catch(() => {});
  });
}

export interface InvoiceSchedulerOptions {
  intervalMs?: number;
  logger?: {
    info: (obj: Record<string, unknown>, msg?: string) => void;
    warn: (obj: Record<string, unknown>, msg?: string) => void;
    error: (obj: Record<string, unknown>, msg?: string) => void;
  };
}

export function startInvoiceExpirationScheduler(opts?: InvoiceSchedulerOptions): () => void {
  const intervalMs = opts?.intervalMs ?? Number(process.env.INVOICE_EXPIRY_INTERVAL_MS ?? 60_000);
  const logger = opts?.logger;

  // Run initial asynchronous sweep (non-blocking)
  void autoExpireInvoices()
    .then((res) => {
      if (res.count > 0 && logger) {
        logger.info({ event: "wallet.invoices_auto_expired", count: res.count, phase: "init" });
      }
    })
    .catch((err) => {
      logger?.warn?.({ event: "wallet.auto_expire_failed", error: String(err), phase: "init" });
    });

  const timer = setInterval(() => {
    void autoExpireInvoices()
      .then((res) => {
        if (res.count > 0 && logger) {
          logger.info({ event: "wallet.invoices_auto_expired", count: res.count, phase: "interval" });
        }
      })
      .catch((err) => {
        logger?.error?.({ event: "wallet.auto_expire_failed", error: String(err), phase: "interval" });
      });
  }, intervalMs).unref();

  return () => clearInterval(timer);
}
```

##### Chunk 1.3: `listAdminInvoices` (Lines 186–258)
**Before:**
```typescript
export async function listAdminInvoices(opts?: {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  q?: string;
}) {
  await autoExpireInvoices();

  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const skip = (page - 1) * limit;
  const sortOrder = opts?.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const sortBy = opts?.sortBy ?? "createdAt";

  const where: Prisma.InvoiceWhereInput = {};
  const status = opts?.status?.toLowerCase().trim();

  if (status === "pending") {
    where.status = { in: ["awaiting_review", "unpaid"] };
  } else if (status === "canceled") {
    where.status = { in: ["canceled", "rejected"] };
  } else if (status === "kurasi") {
    where.status = "awaiting_review";
  } else if (status === "open") {
    where.status = "unpaid";
  } else if (status && status !== "all") {
    where.status = status as any;
  }

  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    where.OR = [
      { uniqueCode: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ];
  }
```

**After:**
```typescript
export async function listAdminInvoices(opts?: {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  q?: string;
}) {
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 10));
  const skip = (page - 1) * limit;
  const sortOrder = opts?.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const sortBy = opts?.sortBy ?? "createdAt";

  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const andConditions: Prisma.InvoiceWhereInput[] = [];
  const status = opts?.status?.toLowerCase().trim();

  const notExpiredCondition: Prisma.InvoiceWhereInput = {
    OR: [
      { gatewayExpiredAt: { gt: now } },
      { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } },
    ],
  };

  const expiredCondition: Prisma.InvoiceWhereInput = {
    OR: [
      { status: "expired" },
      {
        status: "unpaid",
        OR: [
          { gatewayExpiredAt: { lte: now } },
          { gatewayExpiredAt: null, createdAt: { lte: manualCutoff } },
        ],
      },
    ],
  };

  if (status === "pending") {
    andConditions.push({
      OR: [
        { status: "awaiting_review" },
        {
          status: "unpaid",
          ...notExpiredCondition,
        },
      ],
    });
  } else if (status === "canceled") {
    andConditions.push({ status: { in: ["canceled", "rejected"] } });
  } else if (status === "kurasi") {
    andConditions.push({ status: "awaiting_review" });
  } else if (status === "open") {
    andConditions.push({
      status: "unpaid",
      ...notExpiredCondition,
    });
  } else if (status === "expired") {
    andConditions.push(expiredCondition);
  } else if (status && status !== "all") {
    andConditions.push({ status: status as any });
  }

  if (opts?.q && opts.q.trim()) {
    const q = opts.q.trim();
    andConditions.push({
      OR: [
        { uniqueCode: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.InvoiceWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};
```

##### Chunk 1.4: `listNotifications` (Lines 260–280)
**Before:**
```typescript
export async function listNotifications() {
  await autoExpireInvoices();
  const whereReview = { status: "awaiting_review" as const };
  const whereOpen = { status: "unpaid" as const };

  const [pendingCount, openCount, reviewRows, openRows] = await Promise.all([
    prisma.invoice.count({ where: whereReview }),
    prisma.invoice.count({ where: whereOpen }),
    prisma.invoice.findMany({
      where: whereReview,
      orderBy: { proofSubmittedAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
    prisma.invoice.findMany({
      where: whereOpen,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
  ]);
```

**After:**
```typescript
export async function listNotifications() {
  const now = new Date();
  const manualCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const whereReview: Prisma.InvoiceWhereInput = { status: "awaiting_review" };
  const whereOpen: Prisma.InvoiceWhereInput = {
    status: "unpaid",
    OR: [
      { gatewayExpiredAt: { gt: now } },
      { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } },
    ],
  };

  const [pendingCount, openCount, reviewRows, openRows] = await Promise.all([
    prisma.invoice.count({ where: whereReview }),
    prisma.invoice.count({ where: whereOpen }),
    prisma.invoice.findMany({
      where: whereReview,
      orderBy: { proofSubmittedAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
    prisma.invoice.findMany({
      where: whereOpen,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
  ]);
```

##### Chunk 1.5: `createInvoice` Lazy Trigger Hook (Line 135)
**After `void publishInvoiceEvent(invoice);`:**
```typescript
  void publishInvoiceEvent(invoice);
  triggerLazyAutoExpire();

  return serializeInvoice(invoice, true);
```

---

#### 2. Target File: `apps/api/src/index.ts`

##### Chunk 2.1: Import and Initialize Background Scheduler
```typescript
import { startInvoiceExpirationScheduler } from "./wallet/service.js";
```

##### Chunk 2.2: Register Scheduler and Teardown Hook
```typescript
const stopInvoiceScheduler = startInvoiceExpirationScheduler({
  logger: app.log,
});

const shutdown = async () => {
  stopInvoiceScheduler();
  await app.close();
  await queue.close();
  await queueConnection.quit();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};
```

---

#### 3. Target File: `apps/api/src/wallet/wallet.test.ts`

Add automated tests verifying:
1. `getInvoiceForUser` and `listInvoicesForUser` execute zero DB writes.
2. `listAdminInvoices` and `listNotifications` execute zero DB writes.
3. Expired invoices are dynamically serialized as `"expired"` even when DB row has `status: "unpaid"`.
4. `autoExpireInvoices()` successfully performs table-wide update and returns `{ count }`.
5. `startInvoiceExpirationScheduler()` starts and cleanly stops via teardown closure.

```typescript
test("Zero DB writes on GET invoice routes", async () => {
  let updateManyCallCount = 0;
  const origUpdateMany = prisma.invoice.updateMany;
  const origFindFirst = prisma.invoice.findFirst;
  const origFindMany = prisma.invoice.findMany;
  const origCount = prisma.invoice.count;

  (prisma.invoice as any).updateMany = async () => {
    updateManyCallCount++;
    return { count: 0 };
  };
  (prisma.invoice as any).findFirst = async () => ({
    id: "inv-read-test",
    userId: "user-1",
    amountIdr: 49000,
    points: 500,
    status: "unpaid",
    uniqueCode: "INV-READTEST",
    paidAt: null,
    createdAt: new Date(),
  });
  (prisma.invoice as any).findMany = async () => [];
  (prisma.invoice as any).count = async () => 0;

  try {
    await getInvoiceForUser("user-1", "inv-read-test");
    await listInvoicesForUser("user-1");
    await listAdminInvoices();
    await listNotifications();

    assert.equal(updateManyCallCount, 0, "Read routes must execute 0 DB updateMany write operations");
  } finally {
    prisma.invoice.updateMany = origUpdateMany;
    prisma.invoice.findFirst = origFindFirst;
    prisma.invoice.findMany = origFindMany;
    prisma.invoice.count = origCount;
  }
});

test("serializeInvoice dynamically marks expired unpaid invoices without DB mutation", async () => {
  const origFindFirst = prisma.invoice.findFirst;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  (prisma.invoice as any).findFirst = async () => ({
    id: "inv-expired-calc",
    userId: "user-1",
    amountIdr: 49000,
    points: 500,
    status: "unpaid", // Still unpaid in DB
    uniqueCode: "INV-EXPCALC",
    paidAt: null,
    createdAt: twoHoursAgo, // > 1 hour ago
    gatewayExpiredAt: null,
  });

  try {
    const res = await getInvoiceForUser("user-1", "inv-expired-calc");
    assert.equal(res.status, "expired");
    assert.equal(res.statusLabel, "Kedaluwarsa");
  } finally {
    prisma.invoice.findFirst = origFindFirst;
  }
});
```

---

## 5. Verification Method

### A. Independent Test Execution Command
Run the backend test suite:
```bash
pnpm --filter @ai-gen-free/api test
```
**Expected outcome:** All 102 baseline tests pass + new route isolation tests pass (100% exit code 0).

### B. Code Grep Invalidation Check
Run ripgrep across `apps/api/src/wallet/service.ts`:
```bash
grep -n "autoExpireInvoices" apps/api/src/wallet/service.ts
```
**Invalidation Condition:**
If `autoExpireInvoices` is called inside `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, or `listNotifications`, the decoupling is incomplete. The function MUST only appear at its declaration, within `triggerLazyAutoExpire`, and inside `startInvoiceExpirationScheduler`.

### C. Spy Verification Check
Run the newly added test `Zero DB writes on GET invoice routes`.
**Invalidation Condition:**
If `updateManyCallCount > 0`, the read path is executing blocking database writes and violates Milestone 2 specifications.
