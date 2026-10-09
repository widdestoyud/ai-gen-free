# Original User Request

## 2026-10-08T08:04:51Z

Perform comprehensive codebase refactoring, security hardening, performance optimization, and test suite expansion for the satulabs.id (ai-gen-free) platform.

Working directory: /home/ubuntu/projects/ai-gen-free
Integrity mode: benchmark

## Requirements

### R1. Backend Security & Hardening
Audit and harden authentication, session token lifecycles, single-session enforcement, input sanitization, and rate-limiting policies across Fastify backend routes and Next.js BFF proxies. Ensure robust protection against unauthorized access and privilege escalation.

### R2. Performance & Query Optimization
Optimize database queries and indexes in Prisma, streamline Redis caching strategies, reduce cold-path query bottlenecks, and minimize latency across API and BFF endpoints.

### R3. Frontend Refactoring & Component Standardization
Refactor frontend codebase to standardize Mantine component patterns, clean up duplicate state management logic, optimize React Query cache synchronization, and eliminate unnecessary re-renders.

### R4. Automated Test Suite & Verification Expansion
Expand unit and integration test coverage across all critical services (auth, wallet/billing, AI job lifecycle, uploads) ensuring all edge cases are verified programmatically.

## Verification Resources
- Backend Test Suite: `pnpm --filter @ai-gen-free/api test` (current baseline: 102 passing tests)
- Web Build Verification: `pnpm --filter @ai-gen-free/web build`
- API Build Verification: `pnpm --filter @ai-gen-free/api build`
- Docker Health Checks: `docker compose ps` / `docker compose up -d --build`

## Acceptance Criteria

### Security & Functional Reliability
- [ ] All 102 existing backend unit tests continue to pass with 0 regressions.
- [ ] Single-session enforcement, OTP rate limits, and wallet/sparks balance protections remain fully intact.
- [ ] No unauthorized access or privilege bypass on admin/customer endpoints.

### Code Quality & Compilation
- [ ] Zero TypeScript compilation errors across `@ai-gen-free/api` and `@ai-gen-free/web`.
- [ ] Production build (`next build` and Fastify build) succeeds cleanly without warnings or errors.

### Testing Coverage
- [ ] Newly refactored or enhanced modules have corresponding automated tests.
- [ ] All automated test commands exit with code 0.
