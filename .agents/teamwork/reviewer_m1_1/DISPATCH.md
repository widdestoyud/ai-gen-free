# Dispatch: Reviewer M1-1 (Backend Security & Fastify Hardening)

Identity: teamwork_preview_reviewer
Role: Reviewer M1-1 (Backend Security & Fastify Hardening)
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m1_1
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Worker Handoff: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1/handoff.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Independently review the Milestone 1 implementation by worker_m1.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md, /home/ubuntu/projects/ai-gen-free/PROJECT.md, and /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1/handoff.md.
2. Review Fastify server hardening:
   - Verify `trustProxy: true` in `apps/api/src/index.ts`.
   - Verify `@fastify/helmet` registration and CSP/CORP configuration.
   - Verify `requestIp` implementation in `apps/api/src/http.ts` and its usage in `apps/api/src/routes/auth.ts`.
   - Verify Fastify route validation schemas on all auth, jobs, and payment endpoints.
   - Verify atomic Redis rate-limiting Lua script in `apps/api/src/auth/rate-limit.ts`.
3. Run verification commands:
   - `pnpm --filter @ai-gen-free/api test` (must pass 102/102 with 0 regressions)
   - `pnpm test`
4. Deliver your review with explicit verdict (APPROVE or REQUEST_CHANGES) in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m1_1/handoff.md following the Handoff Protocol.
5. Send a completion message back to orchestrator.

## 2026-10-08T09:11:30Z
You are teamwork_preview_reviewer (Role: Reviewer M1-1 - Backend Security & Fastify Hardening).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m1_1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
The worker handoff report is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m1/handoff.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m1_1/DISPATCH.md

Review the Milestone 1 implementation by worker_m1:
1. Examine code changes in `apps/api/src/index.ts`, `apps/api/src/http.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/jobs.ts`, `apps/api/src/routes/payment.ts`, and `apps/api/src/auth/rate-limit.ts`.
2. Verify correctness, completeness, and interface conformance:
   - Fastify trustProxy and helmet CSP/CORP configuration.
   - Unified requestIp extraction.
   - Route validation schemas.
   - Atomic Redis rate-limiting Lua script.
3. Run verification commands:
   - `pnpm --filter @ai-gen-free/api test` (must pass 102/102 tests with 0 regressions)
   - `pnpm test`
4. Deliver your review report with explicit verdict (APPROVE or REQUEST_CHANGES) in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/reviewer_m1_1/handoff.md.
5. Send a completion message back to orchestrator.
