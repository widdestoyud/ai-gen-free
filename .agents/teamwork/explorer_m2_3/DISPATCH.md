# Dispatch: Explorer M2-3 (GET Route DB Write Isolation)

Identity: teamwork_preview_explorer
Role: Route Decoupling & Background Isolation Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 2 — Performance & Query Optimization (R2).
Focus: Removing blocking DB writes from read-only GET routes.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the precise implementation strategy for:
   - Decoupling `autoExpireInvoices()` from GET endpoints in `apps/api/src/wallet/service.ts` and `apps/api/src/routes/wallet.ts`.
   - Isolating invoice expiration to asynchronous/lazy or background intervals rather than executing table-wide `prisma.invoice.updateMany` inside user read requests.
   - Ensuring read-only endpoints execute zero write transactions on the database.
4. Ensure compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Deliver your actionable implementation report in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3/handoff.md following the Handoff Protocol. Send a completion message when done.

## 2026-10-08T09:30:09Z
You are teamwork_preview_explorer (Role: Route Decoupling & Background Isolation Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3/DISPATCH.md

You are an exploratory subagent. DO NOT modify any production source code directly. Read and analyze the codebase to produce an actionable implementation plan for removing DB writes from GET routes:
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the exact code edits for:
   - Decoupling `autoExpireInvoices()` from GET endpoints in `apps/api/src/wallet/service.ts` and `apps/api/src/routes/wallet.ts`.
   - Isolating invoice expiration to asynchronous/lazy or background intervals rather than executing table-wide `prisma.invoice.updateMany` inside user read requests.
   - Ensuring read-only endpoints execute zero write transactions on the database.
4. Ensure full backward compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Maintain progress.md in your working directory.
6. Write your detailed implementation strategy to /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_3/handoff.md following the Handoff Protocol.
7. Send a message to orchestrator upon completion.
