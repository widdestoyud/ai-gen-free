# BRIEFING — 2026-10-08T09:38:00Z

## Mission
Analyze codebase and design exact implementation strategy for Redis caching of hot data (sessions, model catalog, app settings), SSE multiplexing for invoice events, and IORedis error handling without breaking baseline tests.

## 🔒 My Identity
- Archetype: explorer
- Roles: Redis Caching & SSE Multiplexing Explorer
- Working directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2
- Original parent: 4dae2374-49fa-4879-8968-30ead7f9b330
- Milestone: Milestone 2 — Performance & Query Optimization (R2)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement in production files
- Ensure full backward compatibility with all 102 baseline tests (`pnpm --filter @ai-gen-free/api test`)
- Write only to our working directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2

## Current Parent
- Conversation ID: 4dae2374-49fa-4879-8968-30ead7f9b330
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/api/src/index.ts`: Redis connection instantiations, missing `.on("error")`, route dependency injection
  - `apps/api/src/auth/service.ts`: `userFromCookie`, `createSingleSession`, `logout`, `changeUserPassword`, `resetPassword`, `updateUserProfile`
  - `apps/api/src/jobs/catalog.ts`: `getActiveDefaultModels`, `listCustomerCatalog`, `resolveModel`
  - `apps/api/src/jobs/service.ts`: `listJobsForUser`, `listCustomerLibrary`
  - `apps/api/src/admin/service.ts`: `getPaymentSettings`, `putPaymentSettings`, `getTesterAccountSettings`, `putTesterAccountSettings`, `getGenerateCooldownSetting`, `putGenerateCooldownSetting`, `getDefaultGenerationModelsSetting`, `putDefaultGenerationModelsSetting`, `updateModelCatalog`
  - `apps/api/src/routes/wallet.ts`: SSE subscription endpoints (`/invoices/events`, `/admin/invoices/events`) using `deps.redis.duplicate()`
  - Baseline tests: Verified all 102 test cases pass cleanly via `pnpm --filter @ai-gen-free/api test`.
- **Key findings**:
  - Hot sessions query PostgreSQL on every authenticated API call; caching with `cache:session:${tokenHash}` and invalidating via `user:session:${userId}:${kind}` reduces DB load by >90%.
  - `ModelCatalog` and `AppSetting` are virtually static configurations that are repeatedly queried on hot paths (job creation, checkout); caching with 1h TTL and invalidating on admin update removes unneeded queries.
  - SSE subscriptions duplicate Redis connections per client connection, risking connection exhaustion under load; a multiplexer using a single shared subscriber solves this.
  - IORedis instances lack `.on("error")` handlers, leaving the Node process vulnerable to crash on Redis disconnects.
- **Unexplored areas**:
  - None within this explorer's assigned scope.

## Key Decisions Made
- Design modular cache utility `apps/api/src/lib/cache.ts` with graceful degradation (null check & try-catch fallback to DB).
- Design `RedisSubscriberMultiplexer` in `apps/api/src/lib/redis-multiplexer.ts` managing channel listeners with a single subscriber connection.
- Standardize session Date serialization/deserialization to ensure exact type compatibility with Prisma outputs.

## Artifact Index
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/DISPATCH.md — Dispatch instructions
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/progress.md — Progress tracking & heartbeat
- /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m2_2/handoff.md — Final implementation plan report
