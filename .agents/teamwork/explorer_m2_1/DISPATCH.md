# Dispatch: Explorer M2-1 (Database Query Optimization & N+1 Elimination)

Identity: teamwork_preview_explorer
Role: Database Query Optimization Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_1
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 2 — Performance & Query Optimization (R2).
Focus: Database queries, N+1 elimination, memory bottlenecks, and Prisma schema.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the precise implementation strategy for:
   - Eliminating the N+1 loop in `listAdminUsers` (`apps/api/src/admin/service.ts`): use `user.wallet.availableCached` (or eager load wallet) instead of running `computeBalance` for every user in `Promise.all`.
   - Fixing the in-memory pagination and heap bottleneck in `listCustomerLibrary` (`apps/api/src/jobs/service.ts`): push status filtering (`succeeded`), expiry filtering, sorting, and pagination down to SQL Prisma queries.
   - Database-side aggregation in `packages/wallet/src/ledger.ts`: optimize `computeBalance` using Prisma aggregate `_sum` or raw query instead of fetching all historical ledger rows into memory.
   - Adding composite indexes in `packages/db/prisma/schema.prisma`: `@@index([userId, status])` and `@@index([userId, status, createdAt])` on `Job`.
4. Ensure compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Deliver your actionable implementation report in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_1/handoff.md following the Handoff Protocol. Send a completion message when done.
