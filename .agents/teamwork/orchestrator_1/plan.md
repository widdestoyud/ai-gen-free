# Orchestration Plan: satulabs.id (ai-gen-free) Refactoring & Hardening

## Overview
Comprehensive codebase refactoring, security hardening, performance optimization, and automated test suite expansion across the Fastify API and Next.js Web applications.

## Phases

### Phase 0: Survey & Codebase Exploration
- Dispatch 3 parallel survey subagents:
  1. `explorer_survey_1`: Backend security, Fastify auth/session lifecycle, single-session enforcement, input validation, rate limiting, Prisma schema & queries, Redis caching.
  2. `explorer_survey_2`: Frontend Next.js web application, Mantine component patterns, BFF proxy endpoints, React Query caching, state management, render bottlenecks.
  3. `spec_miner_survey_3`: Baseline test suite (102 tests), test runner setup, coverage analysis across auth, wallet/billing, AI job lifecycle, uploads, and acceptance criteria verification.
- Synthesize reports into `PROJECT.md § Feature Inventory`.

### Phase 1: Milestone Decomposition & Architecture Specification
- Finalize `PROJECT.md` with Feature Inventory, Milestones, Interface Contracts, and Code Layout.
- Define Dual Track: Implementation Milestones + E2E Testing Track.

### Phase 2: Milestone Execution & Verification Loop
- For each milestone:
  - Spawn 3 Explorers -> 1 Worker -> 2 Reviewers -> 2 Challengers -> 1 Forensic Auditor
  - Gate evaluation: strict AND (build/test pass, all reviewers APPROVE, challengers verify, auditor CLEAN).
  - Target Milestones:
    - M1: R1 Backend Security & Hardening (Auth, sessions, single-session, rate limiting, BFF proxies)
    - M2: R2 Performance & Query Optimization (Prisma queries/indexes, Redis caching, cold paths)
    - M3: R3 Frontend Refactoring & Component Standardization (Mantine, React Query, state cleanup)
    - M4: R4 Automated Test Suite Expansion (Auth, wallet/billing, AI jobs, uploads)

### Phase 3: Final Acceptance & System Health Verification
- Verification criteria:
  - 102 baseline tests pass with 0 regressions + new tests pass
  - TypeScript build succeeds with 0 errors across API and Web
  - Production builds succeed cleanly
  - Single-session, OTP rate limits, wallet/sparks balances intact
  - Forensic audit confirms CLEAN with no shortcuts or dummy implementations
- Report back to parent Sentinel with comprehensive completion summary.
