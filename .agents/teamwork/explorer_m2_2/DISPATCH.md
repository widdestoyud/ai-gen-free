# Dispatch: Explorer M2-2 (Redis Caching & SSE Multiplexing)

Identity: teamwork_preview_explorer
Role: Redis Caching & SSE Multiplexing Explorer
Working Directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2
Original Request: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
Project Document: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Parent: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/orchestrator_1

Task:
Milestone 2 — Performance & Query Optimization (R2).
Focus: Redis caching strategies, connection pooling, and SSE multiplexing.
1. Read /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md and /home/ubuntu/projects/ai-gen-free/PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the precise implementation strategy for:
   - Redis caching of hot data: cache authenticated user sessions (`userFromCookie`), Model Catalog (`ModelCatalog`), and App Settings (`AppSetting`) with sensible TTLs and invalidation on update.
   - Multiplexing Redis SSE subscriptions in `apps/api/src/routes/wallet.ts` (`/invoices/events`): replace per-client `deps.redis.duplicate()` with a shared subscriber multiplexer to prevent Redis connection exhaustion.
   - Adding `.on("error")` event handlers on IORedis client instances in `apps/api/src/index.ts` to prevent process termination on transient network glitches.
4. Ensure compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Deliver your actionable implementation report in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/handoff.md following the Handoff Protocol. Send a completion message when done.


## 2026-10-08T09:30:09Z
[Message] timestamp=2026-10-08T09:30:09Z sender=4dae2374-49fa-4879-8968-30ead7f9b330 priority=MESSAGE_PRIORITY_HIGH content=You are teamwork_preview_explorer (Role: Redis Caching & SSE Multiplexing Explorer).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/DISPATCH.md

You are an exploratory subagent. DO NOT modify any production source code directly. Read and analyze the codebase to produce an actionable implementation plan for Redis caching and SSE multiplexing:
1. Read ORIGINAL_REQUEST.md and PROJECT.md.
2. Read survey findings in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_survey_1/handoff.md.
3. Formulate the exact code edits for:
   - Redis caching of hot data: cache authenticated user sessions (`userFromCookie`), Model Catalog (`ModelCatalog`), and App Settings (`AppSetting`) with sensible TTLs and invalidation on update.
   - Multiplexing Redis SSE subscriptions in `apps/api/src/routes/wallet.ts` (`/invoices/events`): replace per-client `deps.redis.duplicate()` with a shared subscriber multiplexer to prevent connection sprawl.
   - Adding `.on("error")` event handlers on IORedis client instances in `apps/api/src/index.ts` to prevent uncaught exceptions.
4. Ensure full backward compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`).
5. Maintain progress.md in your working directory.
6. Write your detailed implementation strategy to /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/handoff.md following the Handoff Protocol.
7. Send a message to orchestrator upon completion.
