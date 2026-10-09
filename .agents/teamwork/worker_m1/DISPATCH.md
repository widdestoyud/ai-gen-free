# Dispatch: Milestone 1 Security & Hardening Worker

Identity: teamwork_preview_worker
Role: Milestone 1 Security & Hardening Worker
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Input Specifications (from M1 Explorers):
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1/handoff.md (Fastify trustProxy, helmet, unified requestIp, route schemas, atomic Redis rate limit)
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/handoff.md (Strict admin session separation, atomic single-session, password validation)
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/handoff.md (BFF credential isolation, timing-safe compare, cookie sanitization, upstream 502 handling)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusively Owned Files:
- apps/api/package.json
- apps/api/src/index.ts
- apps/api/src/http.ts
- apps/api/src/routes/auth.ts
- apps/api/src/routes/admin.ts
- apps/api/src/routes/jobs.ts
- apps/api/src/routes/payment.ts
- apps/api/src/auth/service.ts
- apps/api/src/auth/rate-limit.ts
- packages/core/src/auth/password.ts
- apps/web/app/api/[...path]/route.ts
- apps/web/middleware.ts
- apps/web/lib/cookie-header.ts
- apps/web/lib/bff-proxy.ts

Tasks:
1. Apply the detailed code implementations from explorer_m1_1, explorer_m1_2, and explorer_m1_3 handoffs.
2. Ensure `@fastify/helmet` is added and registered in Fastify.
3. Verify that `pnpm --filter @ai-gen-free/api test` passes with all 102 baseline tests intact (0 regressions).
4. Verify that `pnpm --filter @ai-gen-free/web build` passes cleanly.
5. Verify that `pnpm test` passes across the repository.
6. Record execution results in your progress.md and handoff.md.
7. Send completion message back to orchestrator.

## 2026-10-08T08:44:35Z
You are teamwork_preview_worker (Role: Milestone 1 Security & Hardening Worker).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1/DISPATCH.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

You have exclusive write ownership of these files:
- apps/api/package.json
- apps/api/src/index.ts
- apps/api/src/http.ts
- apps/api/src/routes/auth.ts
- apps/api/src/routes/admin.ts
- apps/api/src/routes/jobs.ts
- apps/api/src/routes/payment.ts
- apps/api/src/auth/service.ts
- apps/api/src/auth/rate-limit.ts
- packages/core/src/auth/password.ts
- apps/web/app/api/[...path]/route.ts
- apps/web/middleware.ts
- apps/web/lib/cookie-header.ts
- apps/web/lib/bff-proxy.ts

Read the handoff reports from the 3 Explorers:
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1/handoff.md
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/handoff.md
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/handoff.md

Execute the implementation:
1. Fastify Server & Route Hardening (explorer_m1_1):
   - Add `@fastify/helmet` to `apps/api/package.json` and install (`pnpm install`).
   - Enable `trustProxy: true` in `apps/api/src/index.ts`.
   - Register `@fastify/helmet` with proper CSP and `crossOriginResourcePolicy: { policy: "cross-origin" }`.
   - Unify `requestIp` in `apps/api/src/http.ts` and replace `clientIp` in `apps/api/src/routes/auth.ts`.
   - Add Fastify route validation schemas across routes in `auth.ts`, `jobs.ts`, `payment.ts`.
   - Implement atomic Redis rate limiting script in `apps/api/src/auth/rate-limit.ts` (with MockRedis fallback for tests).
2. Auth Service & Session Security (explorer_m1_2):
   - Enforce strict admin session kind in `routes/admin.ts` (remove fallback to customer user session).
   - Enforce atomic single-session validation and invalidation in `auth/service.ts`.
   - Correct password complexity validation in `packages/core/src/auth/password.ts` (no raw hex bypass without complexity).
3. BFF Proxy Hardening & Cookie Security (explorer_m1_3):
   - Isolate `adminBasicHeaders()` in `apps/web/app/api/[...path]/route.ts` to authenticated admin sessions only (`session?.sid`).
   - Use constant-time comparison in `apps/web/middleware.ts`.
   - Sanitize cookies in `apps/web/lib/cookie-header.ts` (`sanitizeCookie` / `mergeCookie`).
   - Add structured 502 error handling on upstream network errors in `apps/web/app/api/[...path]/route.ts`.
4. Verification:
   - Run `pnpm --filter @ai-gen-free/api test`: verify all 102 baseline tests pass with 0 regressions.
   - Run `pnpm --filter @ai-gen-free/web build`: verify Next.js builds cleanly with 0 errors.
   - Run `pnpm test`: verify repository tests pass.
5. Record your changes, command execution outputs, and verification results in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1/handoff.md`.
6. Send a completion message back to your orchestrator when finished.
