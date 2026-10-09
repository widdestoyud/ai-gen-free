# BRIEFING — 2026-10-08T08:41:00Z

## Mission
Investigate and formulate the exact code edits and implementation strategy for Next.js BFF proxy hardening, credential leak fix, cookie injection sanitization, and timing attack prevention.

## 🔒 My Identity
- Archetype: explorer
- Roles: BFF Proxy Hardening & Cookie Security Explorer
- Working directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3
- Original parent: 4dae2374-49fa-4879-8968-30ead7f9b330
- Milestone: Milestone 1 — Backend Security Hardening & Session Protection (R1)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do not modify production source code directly
- Write all findings, analyses, and implementation plan into working directory

## Current Parent
- Conversation ID: 4dae2374-49fa-4879-8968-30ead7f9b330
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `apps/web/app/api/[...path]/route.ts` (Next.js catch-all BFF proxy)
  - `apps/web/middleware.ts` (Admin Basic Auth edge middleware)
  - `apps/web/lib/cookie-header.ts` (Cookie merging and header composition)
  - `apps/web/lib/bff-proxy.ts` (Fastify proxy helper for ad-hoc routes)
  - `apps/web/lib/server-api.ts` (SSR API callers and Basic Auth header generator)
  - `apps/web/lib/otp-error.ts` (Structured error normalization and masking)
  - `apps/web/lib/create-auth.ts` (NextAuth v5 session strategy and cookie config)
- **Key findings**:
  - Unconditional injection of `adminBasicHeaders()` in `route.ts` line 55 exposes superuser credentials to any unauthenticated request hitting `/api/admin/*`.
  - Unauthenticated fallback to client-supplied `sid` / `sid_admin` cookies bypasses NextAuth validation and risks session spoofing.
  - Insecure cookie concatenation in `mergeCookie` appends client-supplied cookies, risking cookie pollution / parameter precedence attacks.
  - Naive string comparison in `middleware.ts` leaks Basic Auth credentials via timing side-channels.
  - Unhandled upstream fetch errors in `route.ts` crash with unhandled HTML 500 instead of returning contract `{ error: { code: "E001", message: "Gagal terhubung ke layanan backend." } }` with HTTP 502.
- **Unexplored areas**: None within M1-3 scope. All 4 target areas thoroughly analyzed and tested.

## Key Decisions Made
- Designed `sanitizeCookie` and `mergeCookie` in `cookie-header.ts` to strictly strip client `sid` and `sid_admin`.
- Designed `safeCompare` in `middleware.ts` utilizing SHA-256 pre-hashing and `timingSafeEqual` for constant-time comparison without `RangeError` length mismatch exceptions.
- Isolated `adminBasicHeaders()` strictly within verified `session?.sid` check in `route.ts` and `bff-proxy.ts`.
- Wrapped `fetch` and handler body reading in `route.ts` and `bff-proxy.ts` with structured 502/400 JSON error responses conforming to project contract.
- Validated all proposed logic via 15 unit tests executed cleanly via Node.js test runner (`tsx --test`).

## Artifact Index
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/DISPATCH.md` — Dispatch instructions
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/BRIEFING.md` — Working memory and identity
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/progress.md` — Progress and liveness heartbeat
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_cookie-header.ts` — Proposed replacement for `cookie-header.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_middleware.ts` — Proposed replacement for `middleware.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_route.ts` — Proposed replacement for `route.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_bff-proxy.ts` — Proposed replacement for `bff-proxy.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_cookie-header.test.ts` — Verified unit tests for cookie sanitization
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_middleware.test.ts` — Verified unit tests for timing-safe Basic Auth
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/cookie-header.patch` — Unified diff patch for `cookie-header.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/middleware.patch` — Unified diff patch for `middleware.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/route.patch` — Unified diff patch for `route.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/bff-proxy.patch` — Unified diff patch for `bff-proxy.ts`
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/handoff.md` — Final handoff report
