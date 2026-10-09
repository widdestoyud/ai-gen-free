# Dispatch: Reviewer M2-1 (Database Query Optimizations)

## Objective
Independently review the database query optimizations implemented in Milestone 2 by worker_m2.

## Key Files to Review
- `apps/api/src/admin/service.ts`: Verify eager loading `wallet.availableCached` and batch `groupBy` query for holds in `listAdminUsers`. Confirm complete elimination of per-user `computeBalance` calls in the loop.
- `apps/api/src/jobs/service.ts`: Verify live output asset filtering, mode kind filtering, and SQL pagination pushdown. Confirm removal of the hardcoded 100-item cutoff.
- `packages/wallet/src/ledger.ts`: Verify SQL `groupBy` aggregation in `computeBalance(userId, tx?)`.
- `prisma/schema.prisma`: Verify composite indexes `[userId, status]` and `[userId, status, createdAt]`.
- `prisma/migrations/20261008100000_job_composite_indexes/migration.sql`: Verify migration DDL.

## Verification Commands
- `pnpm --filter @ai-gen-free/api test`: Verify all 102 baseline tests pass with 0 regressions.
- `pnpm test`: Verify repository tests pass.

## Output Requirements
- Deliver report in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_1/handoff.md` with explicit verdict: **APPROVE** or **REQUEST_CHANGES**.


## 2026-10-08T10:09:06Z
You are teamwork_preview_reviewer (Role: Reviewer M2-1 - Database Query Optimizations).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
The worker handoff report is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m2/handoff.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_1/DISPATCH.md

Review the Milestone 2 database optimizations implemented by worker_m2:
1. Examine code changes in `apps/api/src/admin/service.ts`, `apps/api/src/jobs/service.ts`, `packages/wallet/src/ledger.ts`, and `prisma/schema.prisma`.
2. Verify correctness, completeness, and interface conformance:
   - Eager-loading `wallet.availableCached` + single groupBy for pending holds in `listAdminUsers`.
   - Pushing live output assets, mode kind filtering, search, and SQL pagination to PostgreSQL in `listCustomerLibrary`.
   - SQL `groupBy` aggregation with `_sum: { amount: true }` in `computeBalance`.
   - Composite indexes on `Job`.
3. Run verification commands:
   - `pnpm --filter @ai-gen-free/api test` (must pass 102/102 tests with 0 regressions)
   - `pnpm test`
4. Deliver your review report with explicit verdict (APPROVE or REQUEST_CHANGES) in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_1/handoff.md.
5. Send a completion message back to orchestrator.
