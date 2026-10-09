# Dispatch: Reviewer M2-2 (Redis Caching, SSE Multiplexing & Route Decoupling)

## Objective
Independently review the caching, SSE multiplexing, error handling, and route decoupling implementations in Milestone 2 by worker_m2.

## Key Files to Review
- `apps/api/src/lib/cache.ts`: Cache-aside implementation, TTLs (15m sessions, 1h catalog/settings), Date deserialization fidelity, and offline/error fallback.
- `apps/api/src/lib/redis-multiplexer.ts`: Shared subscriber connection, reference-counted subscriptions, clean teardown.
- `apps/api/src/routes/wallet.ts`: SSE multiplexing integration in `/invoices/events` and `/admin/invoices/events`.
- `apps/api/src/wallet/service.ts`: Decoupled `autoExpireInvoices()` from GET read routes (`getInvoiceForUser`, `listInvoicesForUser`, `listAdminInvoices`, `listNotifications`), unexpired SQL query filters, background scheduler.
- `apps/api/src/index.ts`: `.on("error")` on IORedis instances, invoice expiration scheduler lifecycle.

## Verification Commands
- `pnpm --filter @ai-gen-free/api test`: Verify 102 baseline tests pass.
- `pnpm --filter @ai-gen-free/web build`: Verify web app builds cleanly with zero errors.
- `pnpm test`: Verify repository tests pass.

## Output Requirements
- Deliver report in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_2/handoff.md` with explicit verdict: **APPROVE** or **REQUEST_CHANGES**.


## 2026-10-08T10:09:06Z
You are teamwork_preview_reviewer (Role: Reviewer M2-2 - Redis Caching & Route Decoupling).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_2
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
The worker handoff report is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m2/handoff.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_2/DISPATCH.md

Review the Milestone 2 caching, multiplexing, and route decoupling implementations by worker_m2:
1. Examine code changes in `apps/api/src/lib/cache.ts`, `apps/api/src/lib/redis-multiplexer.ts`, `apps/api/src/routes/wallet.ts`, `apps/api/src/wallet/service.ts`, and `apps/api/src/index.ts`.
2. Verify correctness, completeness, and robustness:
   - Cache-aside for sessions, catalog, and app settings with Date deserialization and error resilience.
   - Shared subscriber multiplexer in wallet events routes ($O(1)$ connections).
   - `.on("error")` handlers on IORedis instances.
   - Decoupled `autoExpireInvoices` from GET read endpoints, SQL unexpired filtering, background interval scheduler.
3. Run verification commands:
   - `pnpm --filter @ai-gen-free/web build` (must compile cleanly)
   - `pnpm --filter @ai-gen-free/api test`
   - `pnpm test`
4. Deliver your review report with explicit verdict (APPROVE or REQUEST_CHANGES) in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m2_2/handoff.md.
5. Send a completion message back to orchestrator.
