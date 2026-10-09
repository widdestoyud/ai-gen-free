# Handoff Report: Database Query Optimization Implementation Plan (M2-1)

**Author:** teamwork_preview_explorer (Role: Database Query Optimization Explorer)  
**Date:** 2026-10-08T09:38:00Z  
**Milestone:** Milestone 2 — Performance & Query Optimization (R2)  
**Status:** Investigation & Implementation Strategy Complete (Read-Only)  

---

## 1. Observation

Direct observations from codebase inspection, database schema analysis, and baseline test suite execution:

### A. Admin User Listing N+1 Query Loop (`apps/api/src/admin/service.ts`)
1. **Verbatim Code Location**: Lines 436–458 and 492–509 of `apps/api/src/admin/service.ts`:
   ```typescript
   async function serializeAdminUser(
     user: {
       id: string;
       email: string;
       role: string;
       nextGenerateAt: Date | null;
       createdAt: Date;
       emailVerifiedAt?: Date | null;
     },
     extra: { emailVerifiedAt?: boolean },
   ) {
     const bal = await computeBalance(user.id); // <--- Triggers full ledger scan per user
     return {
       id: user.id,
       email: user.email,
       role: user.role,
       nextGenerateAt: iso(user.nextGenerateAt),
       available: bal.available,
       held: bal.held,
       createdAt: user.createdAt.toISOString(),
       ...(extra.emailVerifiedAt ? { emailVerifiedAt: iso(user.emailVerifiedAt ?? null) } : {}),
     };
   }
   ```
   ```typescript
   const [total, rows] = await Promise.all([
     prisma.user.count({ where }),
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
       },
     }),
   ]);

   const users = await Promise.all(rows.map((row) => serializeAdminUser(row, {})));
   ```
2. **Performance Defect**:
   - `prisma.user.findMany` selects only scalar user fields and does not include the `wallet` relation.
   - For a standard page size of 100 users (`limit = 100`), `serializeAdminUser` triggers 100 concurrent asynchronous invocations of `computeBalance(user.id)`.
   - Each `computeBalance` fires a separate `prisma.ledgerEntry.findMany` query, creating 100 concurrent queries plus 2 initial queries (102 DB round-trips total).
   - The `Wallet` model already maintains `availableCached Decimal` on the database (`prisma/schema.prisma:147`), but is completely unutilized in this query path.

### B. In-Memory Filtering and Heap Bottleneck in Customer Library (`apps/api/src/jobs/service.ts`)
1. **Verbatim Code Location**: Lines 374–441 and 511–537 of `apps/api/src/jobs/service.ts`:
   ```typescript
   const jobWhere: Prisma.JobWhereInput = {
     userId: opts.userId,
     status: JobStatus.succeeded,
     ...spicyFilterCondition,
   };

   const [jobsCount, jobRows] = await Promise.all([
     prisma.job.count({ where: jobWhere }),
     prisma.job.findMany({
       where: jobWhere,
       orderBy: { createdAt: isAsc ? "asc" : "desc" },
       take: rawSort === "date" || rawSort === "created_at" ? fetchLimit : 100, // <--- Hardcoded 100 cap!
       include: outputInclude,
     }),
   ]);

   for (const row of jobRows) {
     const asset = row.assets[0];
     const isLive = asset ? isOutputAssetLive(asset, now) : false;
     // Filtered in Node.js memory instead of SQL:
     if (row.status !== JobStatus.succeeded || !asset || !isLive) {
       continue;
     }
     ...
     const itemKind: LibraryItemKind = isVideo ? "video" : "image";
     if (generatedKindFilter !== "all" && generatedKindFilter !== itemKind) {
       continue;
     }
     ...
   }
   ```
   ```typescript
   // Sorting and pagination executed on Node.js heap:
   combined.sort((a, b) => { ... });
   const total = search || rawType !== "all" ? combined.length : totalJobs + totalUploads;
   const items = combined.slice(offset, offset + limit);
   ```
2. **Performance Defect**:
   - `jobWhere` fails to push down live asset constraints (`assets.some: { kind: "output", purgedAt: null, expiresAt: { gt: now } }`), pulling expired or purged jobs into memory only to discard them in a JS `for` loop.
   - Kind filtering (`video` vs `image`) is evaluated in Node.js rather than pushing `mode: { in: [...] }` to PostgreSQL.
   - For custom sorts (name, size, cost), `take` is hard-capped at 100 (`take: 100`). Any user with >100 media assets experiences truncated results, broken sorting, and impossible pagination past 100 items.
   - In-memory `.slice(offset, offset + limit)` wastes database bandwidth and memory allocating objects that are never sent to the client.

### C. Full Ledger History Scans in `computeBalance` (`packages/wallet/src/ledger.ts`)
1. **Verbatim Code Location**: Lines 15–35 and 101–105 of `packages/wallet/src/ledger.ts`:
   ```typescript
   function balanceFromEntries(entries: LedgerLike[]) {
     let postedNet = 0;
     let held = 0;
     for (const e of entries) {
       const amt = asInt(e.amount);
       if (e.status === LedgerStatus.posted) {
         if (e.type === LedgerType.topup || e.type === LedgerType.refund) postedNet += amt;
         else if (e.type === LedgerType.capture) postedNet -= amt;
         else if (e.type === LedgerType.adjust) postedNet += amt;
       }
       if (e.type === LedgerType.hold && e.status === LedgerStatus.pending) {
         held += amt;
       }
     }
     return { available: postedNet - held, held, postedNet };
   }

   export async function computeBalance(userId: string) {
     const entries = await prisma.ledgerEntry.findMany({ where: { userId } });
     return balanceFromEntries(entries);
   }
   ```
   ```typescript
   // Inside adjustWallet:
   const entries = await tx.ledgerEntry.findMany({ where: { userId: opts.userId } });
   const bal = balanceFromEntries(entries);
   ```
2. **Performance Defect**:
   - `prisma.ledgerEntry.findMany({ where: { userId } })` loads the user's entire historical ledger timeline into Node.js process memory.
   - For active accounts with hundreds or thousands of transactions, memory consumption scales O(N) with every balance check.
   - Within `adjustWallet`, `computeBalance` / `findMany` is executed multiple times in a single operation.

### D. Missing Composite Database Indexes on `Job` (`prisma/schema.prisma`)
1. **Verbatim Code Location**: Lines 205–210 of `prisma/schema.prisma`:
   ```prisma
   model Job {
     ...
     @@unique([userId, idempotencyKey])
     @@index([userId, createdAt])
     @@index([status, createdAt])
     @@index([createdAt])
     @@index([mode, status, createdAt])
   }
   ```
2. **Performance Defect**:
   - Concurrency checking in `apps/api/src/jobs/service.ts:66` executes:
     `prisma.job.count({ where: { userId: opts.userId, status: { in: [JobStatus.queued, JobStatus.running] } } })`.
     Without `@@index([userId, status])`, PostgreSQL performs an index scan on `(userId, createdAt)` and re-checks status filtering per row.
   - Library and job list queries filtering by user and status ordered by date (`where: { userId, status: 'succeeded' }, orderBy: { createdAt: 'desc' }`) lack the composite index `@@index([userId, status, createdAt])`, forcing an index lookup followed by a separate sort step.

### E. Baseline Test Suite Verification
- Ran baseline test suite: `pnpm --filter @ai-gen-free/api test`.
  - **Result**: 102 passing tests, 0 failing, 0 regressions (Duration: 15.33s).
- Ran repository-wide test suite: `pnpm test`.
  - **Result**: 249 passing tests across 6 suites, 0 failing (Duration: 10.38s).

---

## 2. Logic Chain

1. **Premise**: In `apps/api/src/admin/service.ts`, `listAdminUsers` queries up to 100 users, and then iterates `rows.map((row) => serializeAdminUser(row, {}))` where `serializeAdminUser` performs `await computeBalance(user.id)`.  
   **Inference**: A page load of 100 users creates 102 distinct queries. Eager loading `wallet: { select: { availableCached: true } }` inside `prisma.user.findMany` provides the cached available balance directly from the user's row in PostgreSQL. Aggregating pending holds across all `userIds` on the page in a single `prisma.ledgerEntry.groupBy` query reduces the total DB round-trips from 102 to 3 (count, user findMany, and single hold groupBy).

2. **Premise**: In `apps/api/src/jobs/service.ts`, `listCustomerLibrary` fetches up to 100 rows into Node.js memory and performs post-query filtering (`!asset || !isLive`, `isVideo ? 'video' : 'image'`, `combined.slice`).  
   **Inference**: Pushing `assets: { some: { kind: 'output', purgedAt: null, expiresAt: { gt: now } } }` and `mode: { in: [...] }` down to Prisma `where` guarantees that PostgreSQL returns only valid, unexpired items. Pushing `skip: offset, take: limit` directly down to Prisma for single-table queries eliminates array slicing in Node.js, and using `take: offset + limit` for unified union queries guarantees pagination works reliably past 100 items without memory heap saturation.

3. **Premise**: `computeBalance(userId)` loads all historical records using `findMany`.  
   **Inference**: Balance calculation depends only on the aggregate sums of posted amounts and pending holds. In PostgreSQL, `prisma.ledgerEntry.groupBy({ by: ['type', 'status'], where: { userId, OR: [{ status: 'posted' }, { status: 'pending', type: 'hold' }] }, _sum: { amount: true } })` returns at most 6 small grouped records regardless of whether the user has 10 or 100,000 ledger entries. This transforms memory complexity from O(N) to O(1) and reduces data transfer from megabytes to bytes.

4. **Premise**: The `Job` table receives high-frequency lookups on `(userId, status)` for concurrency gating and `(userId, status, createdAt)` for library ordering.  
   **Inference**: Adding `@@index([userId, status])` and `@@index([userId, status, createdAt])` to `prisma/schema.prisma` enables PostgreSQL B-tree index seeks that satisfy filtering and sorting simultaneously with zero in-memory quicksort overhead.

---

## 3. Caveats

1. **Single User Balance in `getAdminUser`**: While `listAdminUsers` uses eager-loaded `availableCached` and batch-grouped holds, `getAdminUser(id)` should continue passing the fresh `computeBalance(user.id)` to guarantee that viewing an individual user's detail page reflects immediate real-time ledger accounting.
2. **Schema Path Discrepancy**: While the dispatch references `packages/db/prisma/schema.prisma`, the authoritative schema file is located at root `prisma/schema.prisma` (as declared in root `package.json:29` and confirmed by file search). Schema changes must be applied to `prisma/schema.prisma`.
3. **Database Migration Generation**: Adding composite indexes to `prisma/schema.prisma` requires generating the Prisma client (`pnpm db:generate`) and deploying/creating the migration (`prisma/migrations/20261008100000_job_composite_indexes/migration.sql`). In read-only mode, we provide the exact schema patch and SQL migration script.
4. **Combined Library Pagination**: When `rawType === 'all'` (fetching both `Job` and `Upload`), items originate from two disparate PostgreSQL tables. While individual single-source requests (`type: 'video'`, `type: 'upload'`, `type: 'generated'`) can be 100% paginated at the SQL engine level (`skip: offset, take: limit`), combined queries must fetch up to `take: offset + limit` from both tables before merging. Changing `take: 100` to `take: offset + limit` resolves the heap truncation bug without unbounded memory usage.

---

## 4. Conclusion & Actionable Code Edits

### Edit Plan 1: `apps/api/src/admin/service.ts` — Eliminate N+1 Query Loop
**File**: `/home/ubuntu/projects/ai-gen-free/apps/api/src/admin/service.ts`  
**Target Lines**: 436–522  

#### Proposed Code:
```typescript
async function serializeAdminUser(
  user: {
    id: string;
    email: string;
    role: string;
    nextGenerateAt: Date | null;
    createdAt: Date;
    emailVerifiedAt?: Date | null;
    wallet?: { availableCached: Prisma.Decimal | number } | null;
  },
  extra: { emailVerifiedAt?: boolean; balance?: { available: number; held: number } },
) {
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

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    nextGenerateAt: iso(user.nextGenerateAt),
    available: bal.available,
    held: bal.held,
    createdAt: user.createdAt.toISOString(),
    ...(extra.emailVerifiedAt ? { emailVerifiedAt: iso(user.emailVerifiedAt ?? null) } : {}),
  };
}

export async function listAdminUsers(opts: {
  q?: string;
  role?: string;
  page?: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  const page =
    opts.page && opts.page > 0
      ? opts.page
      : opts.offset !== undefined
        ? Math.floor(opts.offset / (opts.limit || 10)) + 1
        : 1;
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
  const skip = opts.offset !== undefined ? opts.offset : (page - 1) * limit;
  const sortOrder = opts.sortOrder === "asc" ? ("asc" as const) : ("desc" as const);
  const sortBy = opts.sortBy ?? "createdAt";

  const where: Prisma.UserWhereInput = {};
  if (opts.q && opts.q.trim()) {
    where.email = { contains: opts.q.trim(), mode: "insensitive" };
  }
  if (opts.role && opts.role !== "all") {
    where.role = opts.role;
  }

  let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: sortOrder };
  if (sortBy === "email") orderBy = { email: sortOrder };
  else if (sortBy === "role") orderBy = { role: sortOrder };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
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
    }),
  ]);

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

  const users = await Promise.all(
    rows.map((row) =>
      serializeAdminUser(row, {
        balance: {
          available: row.wallet ? Number(row.wallet.availableCached) : 0,
          held: heldByUserId.get(row.id) ?? 0,
        },
      }),
    ),
  );

  return {
    users,
    items: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: skip + limit < total,
      hasPrev: skip > 0,
    },
  };
}

export async function getAdminUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      nextGenerateAt: true,
      createdAt: true,
      emailVerifiedAt: true,
      wallet: {
        select: {
          availableCached: true,
        },
      },
    },
  });
  if (!user) throw new AppError(ErrorCodes.NOT_FOUND, "User tidak ditemukan", 404);
  const bal = await computeBalance(user.id);
  return serializeAdminUser(user, { emailVerifiedAt: true, balance: bal });
}
```

---

### Edit Plan 2: `apps/api/src/jobs/service.ts` — SQL Filtering & Pagination
**File**: `/home/ubuntu/projects/ai-gen-free/apps/api/src/jobs/service.ts`  
**Target Lines**: 340–544  

#### Proposed Code:
```typescript
  const now = new Date();
  const fetchLimit = offset + limit;

  let generatedItems: CustomerLibraryItem[] = [];
  let uploadItems: CustomerLibraryItem[] = [];
  let totalJobs = 0;
  let totalUploads = 0;

  // 1. Ambil Generated Media dari Job (hanya yang berhasil / succeeded dan memiliki live output)
  if (includeGenerated) {
    try {
      const shouldExcludeSpicy = !spicyModeEnabled || opts.isSpicy === false;
      const shouldOnlySpicy = spicyModeEnabled && opts.isSpicy === true;

      const spicyFilterCondition: Prisma.JobWhereInput = shouldExcludeSpicy
        ? {
            AND: [
              { modelId: { notIn: Array.from(spicyModelIds) } },
              { modelId: { not: { contains: "spicy" } } },
              { modelId: { not: { contains: "uncensored" } } },
            ],
          }
        : shouldOnlySpicy
          ? {
              OR: [
                { modelId: { in: Array.from(spicyModelIds) } },
                { modelId: { contains: "spicy" } },
                { modelId: { contains: "uncensored" } },
              ],
            }
          : {};

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

      let jobOrderBy: Prisma.JobOrderByWithRelationInput = { createdAt: isAsc ? "asc" : "desc" };
      if (rawSort === "name" || rawSort === "alias") {
        jobOrderBy = { alias: isAsc ? "asc" : "desc" };
      } else if (rawSort === "cost") {
        jobOrderBy = { cost: isAsc ? "asc" : "desc" };
      }

      // Jika hanya query generated jobs (bukan union dengan upload), dorong pagination langsung ke SQL
      const isJobOnly = !includeUploads;

      const [jobsCount, jobRows] = await Promise.all([
        prisma.job.count({ where: jobWhere }),
        prisma.job.findMany({
          where: jobWhere,
          orderBy: jobOrderBy,
          skip: isJobOnly ? offset : 0,
          take: isJobOnly ? limit : fetchLimit,
          include: outputInclude,
        }),
      ]);

      totalJobs = jobsCount;

      for (const row of jobRows) {
        const asset = row.assets[0];
        const isVideo =
          row.mode?.includes("video") ||
          row.mode === "t2v" ||
          row.mode === "i2v" ||
          (asset?.contentType?.startsWith("video/") ?? false);
        const itemKind: LibraryItemKind = isVideo ? "video" : "image";
        const url = `/api/customer/generated/${row.id}/file`;
        const mimeType = asset?.contentType || (isVideo ? "video/mp4" : "image/webp");

        generatedItems.push({
          id: row.id,
          type: "generated",
          kind: itemKind,
          alias: row.alias ?? null,
          prompt: row.prompt,
          model_id: row.modelId ?? null,
          cost: Number(row.cost),
          status: row.status,
          url,
          mime_type: mimeType,
          width: asset?.width ?? null,
          height: asset?.height ?? null,
          size_bytes: asset?.bytes ?? null,
          created_at: row.createdAt.toISOString(),
          expires_at: asset?.expiresAt ? asset.expiresAt.toISOString() : null,
          params: (row.params as Record<string, unknown>) ?? null,
          is_spicy: isJobSpicy(row),
        });
      }
    } catch {
      // Non-fatal if db offline
    }
  }

  // 2. Ambil Uploaded Media
  if (includeUploads) {
    try {
      const uploadWhere: Prisma.UploadWhereInput = {
        userId: opts.userId,
        actor: "customer",
        purgedAt: null,
        deletedAt: null,
        expiresAt: { gt: now },
      };

      if (search) {
        uploadWhere.OR = [
          { alias: { contains: search, mode: "insensitive" } },
          { id: { contains: search, mode: "insensitive" } },
        ];
      }

      let uploadOrderBy: Prisma.UploadOrderByWithRelationInput = { createdAt: isAsc ? "asc" : "desc" };
      if (rawSort === "name" || rawSort === "alias") {
        uploadOrderBy = { alias: isAsc ? "asc" : "desc" };
      } else if (rawSort === "size" || rawSort === "size_bytes") {
        uploadOrderBy = { bytes: isAsc ? "asc" : "desc" };
      }

      const isUploadOnly = !includeGenerated;

      const [uploadsCount, uploadRows] = await Promise.all([
        prisma.upload.count({ where: uploadWhere }),
        prisma.upload.findMany({
          where: uploadWhere,
          orderBy: uploadOrderBy,
          skip: isUploadOnly ? offset : 0,
          take: isUploadOnly ? limit : fetchLimit,
        }),
      ]);

      totalUploads = uploadsCount;

      for (const row of uploadRows) {
        uploadItems.push({
          id: row.id,
          type: "upload",
          kind: "image",
          alias: row.alias ?? null,
          prompt: null,
          model_id: null,
          cost: null,
          status: "ready",
          url: `/api/customer/uploads/${row.id}/file`,
          mime_type: (row.contentType as string) || "image/webp",
          width: row.width,
          height: row.height,
          size_bytes: row.bytes,
          created_at: row.createdAt.toISOString(),
          expires_at: row.expiresAt.toISOString(),
        });
      }
    } catch {
      // Non-fatal if db offline
    }
  }

  // 3. Gabungkan jika kedua jenis media diminta
  let combined = [...generatedItems, ...uploadItems];

  if (includeGenerated && includeUploads) {
    // Jalankan sorting gabungan
    combined.sort((a, b) => {
      let cmp = 0;
      if (rawSort === "name" || rawSort === "alias") {
        const nameA = (a.alias || a.prompt || a.id).toLowerCase();
        const nameB = (b.alias || b.prompt || b.id).toLowerCase();
        cmp = nameA.localeCompare(nameB);
      } else if (rawSort === "size" || rawSort === "size_bytes") {
        const sizeA = a.size_bytes ?? 0;
        const sizeB = b.size_bytes ?? 0;
        cmp = sizeA - sizeB;
      } else if (rawSort === "cost") {
        const costA = a.cost ?? 0;
        const costB = b.cost ?? 0;
        cmp = costA - costB;
      } else {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        cmp = timeA - timeB;
      }
      return isAsc ? cmp : -cmp;
    });

    const total = totalJobs + totalUploads;
    const items = combined.slice(offset, offset + limit);

    return {
      total,
      limit,
      offset,
      items,
    };
  }

  // Jika single-source, items sudah tepat sesuai pagination SQL
  return {
    total: includeGenerated ? totalJobs : totalUploads,
    limit,
    offset,
    items: combined,
  };
```

---

### Edit Plan 3: `packages/wallet/src/ledger.ts` — SQL Aggregation for `computeBalance`
**File**: `/home/ubuntu/projects/ai-gen-free/packages/wallet/src/ledger.ts`  
**Target Lines**: 30–35 and 100–105  

#### Proposed Code:
```typescript
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
And update line 101 within `adjustWallet`:
```typescript
// Replace:
// const entries = await tx.ledgerEntry.findMany({ where: { userId: opts.userId } });
// const bal = balanceFromEntries(entries);
// With:
const bal = await computeBalance(opts.userId, tx);
```

---

### Edit Plan 4: `prisma/schema.prisma` — Composite Indexes on `Job`
**File**: `/home/ubuntu/projects/ai-gen-free/prisma/schema.prisma`  
**Target Lines**: 205–211  

#### Proposed Code:
```prisma
model Job {
  ...
  @@unique([userId, idempotencyKey])
  @@index([userId, createdAt])
  @@index([userId, status])
  @@index([userId, status, createdAt])
  @@index([status, createdAt])
  @@index([createdAt])
  @@index([mode, status, createdAt])
}
```

#### Migration Script:
Create file `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`:
```sql
-- CreateIndex
CREATE INDEX "Job_userId_status_idx" ON "Job"("userId", "status");

-- CreateIndex
CREATE INDEX "Job_userId_status_createdAt_idx" ON "Job"("userId", "status", "createdAt");
```
Run command:
```bash
pnpm db:generate
```

---

## 5. Verification Method

### A. Automated Regression Testing
Execute the complete backend test suite to ensure all 102 baseline tests continue to pass:
```bash
pnpm --filter @ai-gen-free/api test
```
*Expected Result*: 102 pass, 0 fail.

Execute repository-wide tests:
```bash
pnpm test
```
*Expected Result*: 249 pass across 6 suites, 0 fail.

### B. Invalidation Conditions & Verification Checks
1. **N+1 Verification**:
   Inspect `apps/api/src/admin/service.ts:499-520`.
   - *Invalidation condition*: If `findMany` omits `wallet: { select: { availableCached: true } }` or calls `computeBalance` individually inside `rows.map`, the N+1 loop remains.
2. **Library Pagination Verification**:
   Inspect `apps/api/src/jobs/service.ts:380-465`.
   - *Invalidation condition*: If `take: 100` remains hardcoded for custom sorting or if `assets.some` is omitted from `jobWhere`, the memory bottleneck and pagination truncation remain.
3. **Ledger Aggregation Verification**:
   Inspect `packages/wallet/src/ledger.ts:32-35`.
   - *Invalidation condition*: If `findMany({ where: { userId } })` is executed to compute balances rather than `groupBy` with `_sum.amount`, the full history scan remains.
4. **Composite Index Verification**:
   Inspect `prisma/schema.prisma:205-212`.
   - *Invalidation condition*: If `@@index([userId, status])` or `@@index([userId, status, createdAt])` are absent from `Job`, composite index optimization is incomplete.
