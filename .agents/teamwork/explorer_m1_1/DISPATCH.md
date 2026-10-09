# Dispatch: Explorer M1-1 (Fastify Server & Route Hardening)

Identity: teamwork_preview_explorer
Role: Fastify Server & Route Hardening Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 1 — Backend Security Hardening & Session Protection (R1).
Focus: Fastify Server Configuration, IP Resolution, Security Headers, and Route Schemas.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the precise implementation strategy for:
   - Enabling `trustProxy: true` in Fastify (`apps/api/src/index.ts`).
   - Unifying `requestIp` in `apps/api/src/http.ts` and `apps/api/src/routes/auth.ts`.
   - Registering `@fastify/helmet` with proper CSP, HSTS, and X-Content-Type-Options headers in `apps/api/src/index.ts`.
   - Defining Fastify input validation schemas (`{ schema: { body: ... } }`) for unvalidated routes in `routes/auth.ts`, `routes/jobs.ts`, and `routes/payment.ts`.
   - Fixing atomic Redis rate-limiting in `apps/api/src/auth/rate-limit.ts` (using atomic Lua script or multi/exec).
4. Verify compatibility with existing 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Deliver detailed actionable implementation specification in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1/handoff.md following the Handoff Protocol. Send a completion message when done.


## 2026-10-08T08:29:28Z
You are teamwork_preview_explorer (Role: Fastify Server & Route Hardening Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1/DISPATCH.md

You are an exploratory subagent. DO NOT modify any production source code directly. Read and analyze the codebase to produce an actionable implementation plan for Fastify server and route hardening:
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the exact code edits, imports, and schemas for:
   - Enabling `trustProxy: true` in Fastify (`apps/api/src/index.ts`).
   - Unifying `requestIp` in `apps/api/src/http.ts` and `apps/api/src/routes/auth.ts`.
   - Registering `@fastify/helmet` in `apps/api/src/index.ts`.
   - Defining Fastify input validation schemas across routes.
   - Atomic Redis rate-limiting script in `apps/api/src/auth/rate-limit.ts`.
4. Ensure full backward compatibility with the 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Maintain progress.md in your working directory.
6. Write your detailed implementation strategy to /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1/handoff.md following the Handoff Protocol.
7. Send a message to orchestrator upon completion.
