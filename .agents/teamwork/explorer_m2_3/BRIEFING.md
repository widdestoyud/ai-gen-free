# BRIEFING — 2026-10-08T09:41:00Z

## Mission
Investigate and formulate exact code edits to decouple `autoExpireInvoices()` from GET endpoints, isolate invoice expiration from user read requests, and ensure read-only endpoints execute zero write transactions on the database while preserving all baseline tests.

## 🔒 My Identity
- Archetype: explorer
- Roles: Route Decoupling & Background Isolation Explorer
- Working directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3
- Original parent: 4dae2374-49fa-4879-8968-30ead7f9b330
- Milestone: Milestone 2 — Performance & Query Optimization (R2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in production code
- Decouple autoExpireInvoices() from GET endpoints in apps/api/src/wallet/service.ts and apps/api/src/routes/wallet.ts
- Isolate invoice expiration to async/lazy or background intervals, avoiding table-wide updateMany on reads
- Ensure read-only endpoints execute zero write transactions
- Maintain full backward compatibility with all 102 baseline tests

## Current Parent
- Conversation ID: 4dae2374-49fa-4879-8968-30ead7f9b330
- Updated: 2026-10-08T09:41:00Z

## Investigation State
- **Explored paths**:
  - `apps/api/src/wallet/service.ts` (lines 120-280, 670-744)
  - `apps/api/src/routes/wallet.ts` (all GET routes)
  - `apps/api/src/routes/payment.ts`
  - `apps/api/src/wallet/payment.ts`
  - `apps/api/src/wallet/wallet.test.ts`
  - `apps/api/src/index.ts` (startup and shutdown lifecycle)
  - `apps/worker/src/index.ts` (BullMQ workers, queues, cron intervals)
- **Key findings**:
  1. `autoExpireInvoices()` was solely invoked inside 4 GET functions in `apps/api/src/wallet/service.ts`: `getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, and `listNotifications`.
  2. `serializeInvoice()` already contains in-memory dynamic expiry computation (`effectiveStatus = isExpired ? "expired" : invoice.status`), so removing `autoExpireInvoices()` from read routes continues to present expired invoices as "expired" to all API callers with 0 DB writes.
  3. `listAdminInvoices` and `listNotifications` can use SQL `WHERE` conditions (`OR: [{ gatewayExpiredAt: { gt: now } }, { gatewayExpiredAt: null, createdAt: { gt: manualCutoff } }]`) to filter non-expired active invoices directly at the database read layer with zero write transactions.
  4. Background execution should be encapsulated in `startInvoiceExpirationScheduler` and started in `apps/api/src/index.ts` with graceful shutdown via `clearInterval`.
- **Unexplored areas**: None. All components identified and mapped to exact code edits.

## Key Decisions Made
- Architecture strategy: Full decoupling of `autoExpireInvoices` from GET endpoints; read routes become pure SELECT queries.
- Expiration synchronization: Dual-layer approach — in-memory dynamic calculation in `serializeInvoice`, query-level condition in admin filters, and periodic background sweeps via `startInvoiceExpirationScheduler`.

## Artifact Index
- DISPATCH.md — Task instructions
- BRIEFING.md — Working memory and context
- progress.md — Liveness heartbeat
- handoff.md — Final 5-component handoff report
