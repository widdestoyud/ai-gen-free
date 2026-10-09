# Dispatch: Forensic Auditor M2 (Integrity Verification)

## Objective
Perform independent forensic integrity verification on all Milestone 2 code changes by worker_m2.

## Mandatory Checks
1. **Check A: No hardcoded test results or bypass strings**
   - Inspect all modified files: `apps/api/src/admin/service.ts`, `apps/api/src/jobs/service.ts`, `packages/wallet/src/ledger.ts`, `apps/api/src/wallet/service.ts`, `apps/api/src/routes/wallet.ts`, `apps/api/src/index.ts`, `apps/api/src/lib/cache.ts`, `apps/api/src/lib/redis-multiplexer.ts`, `prisma/schema.prisma`.
   - Verify there are no hardcoded mock returns, fake balance calculations, or bypassed query checks.
2. **Check B: No dummy or facade implementations**
   - Confirm genuine Prisma `groupBy` aggregation, genuine SQL pagination and pushdown, genuine Redis cache-aside implementation, genuine shared EventEmitter/subscriber multiplexer, and real database migration.
3. **Check C: No test weakening, deletion, or circumvention**
   - Verify no tests were modified, deleted, or skipped.
4. **Check D: Verification output integrity**
   - Independently run:
     - `pnpm --filter @ai-gen-free/api test` (must pass 102/102 baseline tests).
     - `pnpm test` (must pass 249/249 repo tests).
     - `pnpm --filter @ai-gen-free/web build` (must compile cleanly).

## Verdict
- Issue a binary verdict: **CLEAN** or **INTEGRITY VIOLATION**.
- Deliver report in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/auditor_m2_1/handoff.md`.

## 2026-10-08T10:09:06Z
You are teamwork_preview_auditor (Role: Forensic Auditor M2 - Integrity Verification).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/auditor_m2_1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
The worker handoff report is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m2/handoff.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/auditor_m2_1/DISPATCH.md

Perform independent forensic integrity verification on all Milestone 2 code changes by worker_m2:
1. Inspect all 10 modified/created files:
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
2. Run forensic checks:
   - Check A: No hardcoded test results, bypass constants, or fake returns.
   - Check B: No dummy or facade implementations (genuine groupBy aggregation, genuine SQL pushdown, real cache module, real multiplexer, real DDL).
   - Check C: No test weakening, deletion, or circumvention.
   - Check D: Re-run verification commands (`pnpm --filter @ai-gen-free/api test`, `pnpm test`, `pnpm --filter @ai-gen-free/web build`).
3. Issue a binary verdict: CLEAN or INTEGRITY VIOLATION.
4. Deliver your audit report in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/auditor_m2_1/handoff.md.
5. Send a completion message back to orchestrator.

