# BRIEFING — 2026-10-08T08:42:30Z

## Mission
Investigate and formulate exact implementation specifications for Auth Service and Session Security:
1. Strict session kind separation in `apps/api/src/routes/admin.ts` and `apps/api/src/auth/service.ts` (disallowing customer token fallback).
2. Atomic single-session creation/invalidation eliminating race conditions in `loginUser` and `validateOtp`.
3. Password complexity enforcement in `packages/core/src/auth/password.ts` eliminating 64-char hex bypass.
4. Session expiry, token lookup, invalidation, and cleanup routines.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Auth Service & Session Security Explorer
- Working directory: /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2
- Original parent: 4dae2374-49fa-4879-8968-30ead7f9b330
- Milestone: M1 (Milestone 1 — Backend Security Hardening & Session Protection)

## 🔒 Key Constraints
- Read-only investigation — do NOT modify production source code directly
- Focus strictly on Auth Service, Session Security, and Password Validation
- All proposed solutions must maintain full backward compatibility with baseline 102 tests (`pnpm --filter @ai-gen-free/api test`)
- Write deliverables to `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/handoff.md`

## Current Parent
- Conversation ID: 4dae2374-49fa-4879-8968-30ead7f9b330
- Updated: 2026-10-08T08:42:30Z

## Investigation State
- **Explored paths**:
  - `apps/api/src/routes/admin.ts:47-78, 138-143, 177-181`
  - `apps/api/src/routes/wallet.ts:69-90`
  - `apps/api/src/routes/payment.ts:49-71`
  - `apps/api/src/routes/uploads.ts:92-115`
  - `apps/api/src/auth/service.ts:525-546, 781-801, 971-989, 1288-1319, 1419-1436, 1700-1814`
  - `packages/core/src/auth/password.ts:1-73`
  - `packages/core/src/auth/auth.test.ts:21-32`
  - `apps/api/src/auth/auth-flow.test.ts:61-66`
  - `apps/web/hooks/use-register.ts`, `apps/web/lib/crypto.ts`
- **Key findings**:
  1. `requireAdmin` in `admin.ts`, `wallet.ts`, `payment.ts`, `uploads.ts` all read `req.cookies?.sid` (customer cookie) and fall back to `userFromCookie(token, "user")`. Also `handleAdminLogin` and `handleAdminLogout` read `req.cookies?.sid`.
  2. Race condition in single-session enforcement: `deleteMany` followed by `create` allows two concurrent login/OTP transactions to commit both sessions simultaneously. Adding pessimistic row lock `SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE` in an interactive transaction guarantees strictly 1 active session.
  3. `validatePassword` in `packages/core/src/auth/password.ts` has `if (isSha256Hex(password)) return { valid: true };` which bypasses minimum 8 chars, uppercase, and digit rules for any 64-character hex string. Removing this bypass enforces uppercase and digit rules uniformly across all inputs.
  4. Expired sessions, OTP challenges, and verification tokens accumulate indefinitely without cleanup. Added `purgeExpiredAuthRecords` routine and session revocation on password change.

## Key Decisions Made
- Formulate precise before/after code blocks and diffs for each target file.
- Validate baseline tests (102 tests pass in API, 249 in root, web build clean).

## Artifact Index
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/DISPATCH.md` — Dispatch instructions
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/BRIEFING.md` — Persistent working memory
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/progress.md` — Liveness heartbeat
- `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_2/handoff.md` — Final handoff report
