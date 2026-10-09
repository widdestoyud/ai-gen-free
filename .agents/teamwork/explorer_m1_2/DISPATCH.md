# Dispatch: Explorer M1-2 (Auth Service & Session Security)

Identity: teamwork_preview_explorer
Role: Auth Service & Session Security Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 1 — Backend Security Hardening & Session Protection (R1).
Focus: Authentication Services, Session Lifecycles, and Password Validation.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the precise implementation strategy for:
   - Enforcing strict session kind separation (`apps/api/src/routes/admin.ts` and `apps/api/src/auth/service.ts`): disallow fallback to customer session tokens for admin routes.
   - Enforcing atomic single-session validation and invalidation to eliminate race conditions in `loginUser` and `validateOtp`.
   - Fixing password complexity validation in `packages/core/src/auth/password.ts` to prevent bypass via 64-character hex strings without meeting length/uppercase/digit requirements.
   - Auditing session expiry and invalidation routines.
4. Verify compatibility with existing 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Deliver detailed actionable implementation specification in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/handoff.md following the Handoff Protocol. Send a completion message when done.
