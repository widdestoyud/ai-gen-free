# Dispatch: Challenger M2-2 (Adversarial Redis Caching & SSE Multiplexing Verifier)

## Objective
Empirically and adversarially stress-test Redis caching, cache invalidation, and SSE multiplexer fanout implemented in Milestone 2.

## Areas to Adversarially Test
1. **Redis Cache-Aside & Date Reconstitution**:
   - Write test scripts testing `cache.ts`: verify that cached sessions correctly reconstitute native `Date` objects (`expiresAt`, `createdAt`).
   - Test cache invalidation: verify that logging out, revoking sessions, or changing passwords immediately purges cached sessions so stale tokens are rejected.
2. **Offline Redis Fallback**:
   - Verify that when Redis is disconnected, uninitialized, or throws errors, all operations fall back transparently to direct database queries without throwing exceptions.
3. **SSE Connection Multiplexing**:
   - Verify that multiple simulated subscribers on the same channel receive published events simultaneously through a single subscriber connection.
   - Verify that disconnecting all subscribers cleanly triggers unsubscription without dangling listeners.

## Output Requirements
- Deliver report in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/challenger_m2_2/handoff.md` with explicit verdict: **APPROVE** or **FAIL**.

## 2026-10-08T10:09:06Z
From: 4dae2374-49fa-4879-8968-30ead7f9b330
You are teamwork_preview_challenger (Role: Challenger M2-2 - Adversarial Redis & SSE Verifier).
Your working directory is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/challenger_m2_2
The authoritative user request is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/ORIGINAL_REQUEST.md
The project plan is: /home/ubuntu/projects/ai-gen-free/PROJECT.md
The worker handoff report is: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/worker_m2/handoff.md
Your dispatch instructions are at: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/challenger_m2_2/DISPATCH.md

Empirically and adversarially verify Milestone 2 Redis caching and SSE multiplexing:
1. Stress-test cache-aside deserialization: verify `expiresAt` and `createdAt` are genuine Date instances supporting `.getTime()` and `.toISOString()`.
2. Stress-test cache invalidation on logout, password change, and session revocation.
3. Stress-test offline/error resilience: simulate disconnected Redis and assert that requests succeed without crashing.
4. Stress-test SSE multiplexer subscription fan-out and unsubscription cleanup.
5. Execute empirical verification scripts via tsx/node:test.
6. Deliver your findings and verdict (APPROVE or FAIL) in /home/ubuntu/projects/ai-gen-free/.agents/teamwork/challenger_m2_2/handoff.md.
7. Send a completion message back to orchestrator.
