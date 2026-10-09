# Dispatch: Explorer M1-3 (BFF Proxy Hardening & Cookie Security)

Identity: teamwork_preview_explorer
Role: BFF Proxy Hardening & Cookie Security Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 1 — Backend Security Hardening & Session Protection (R1).
Focus: Next.js BFF Proxy, Credential Leak Prevention, and Cookie Security.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md and /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2/handoff.md.
3. Formulate the precise implementation strategy for:
   - Fixing BFF Basic Auth credential leak in `apps/web/app/api/[...path]/route.ts`: only attach `adminBasicHeaders()` if `adminAuth()` returns a valid, authenticated admin session (`session?.sid`).
   - Hardening `apps/web/middleware.ts` with constant-time comparison (`crypto.timingSafeEqual`) to prevent timing side-channels on admin Basic Auth.
   - Sanitizing cookie concatenation in `apps/web/lib/cookie-header.ts` (`mergeCookie`): strip any client-supplied `sid=` or `sid_admin=` cookies to prevent cookie injection/tampering.
   - Wrapping upstream fetch in `apps/web/app/api/[...path]/route.ts` with structured error handling on network disconnects.
4. Verify compatibility with `pnpm --filter @ai-gen-free/web build` and backend test suite.
5. Deliver detailed actionable implementation specification in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/handoff.md following the Handoff Protocol. Send a completion message when done.

## 2026-10-08T08:29:28Z
[Message] timestamp=2026-10-08T08:29:28Z sender=4dae2374-49fa-4879-8968-30ead7f9b330 priority=MESSAGE_PRIORITY_HIGH content=You are teamwork_preview_explorer (Role: BFF Proxy Hardening & Cookie Security Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/DISPATCH.md

You are an exploratory subagent. DO NOT modify any production source code directly. Read and analyze the codebase to produce an actionable implementation plan for BFF proxy hardening and cookie security:
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md and /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_2/handoff.md.
3. Formulate the exact code edits and logic for:
   - Fixing BFF Basic Auth credential leak in `apps/web/app/api/[...path]/route.ts`: only attach `adminBasicHeaders()` if `adminAuth()` returns a valid admin session (`session?.sid`).
   - Hardening `apps/web/middleware.ts` with constant-time comparison (`crypto.timingSafeEqual`).
   - Sanitizing cookie concatenation in `apps/web/lib/cookie-header.ts` (`mergeCookie`): strip any client-supplied `sid=` or `sid_admin=` cookies.
   - Wrapping upstream fetch in `apps/web/app/api/[...path]/route.ts` with structured error handling on network disconnects.
4. Ensure full compatibility with `pnpm --filter @ai-gen-free/web build` and backend tests.
5. Maintain progress.md in your working directory.
6. Write your detailed implementation strategy to /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/handoff.md following the Handoff Protocol.
7. Send a message to orchestrator upon completion.
