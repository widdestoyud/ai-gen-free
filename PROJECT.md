# Project: satulabs.id (ai-gen-free) Refactoring, Hardening, Optimization & Testing

## Architecture
- **Monorepo Structure (pnpm workspaces)**:
  - `apps/api`: Fastify 4 backend service providing customer & admin REST APIs, authentication, wallet ledger, job queues, asset streaming.
  - `apps/web`: Next.js 15 (React 19, Mantine 8, TanStack Query 5, NextAuth v5) web application with App Router and BFF proxy routes (`/api/...`).
  - `apps/worker`: BullMQ job execution worker interfacing with Siray, Fal, and Kelontong AI providers.
  - `apps/telemetry`: Telemetry and logging service.
  - `packages/*`: `@ai-gen-free/core`, `@ai-gen-free/db` (Prisma client), `@ai-gen-free/wallet`, `@ai-gen-free/providers-*`.
- **Data Flow**:
  - Web client -> Next.js BFF proxy (`apps/web/app/api/[...path]`) -> Fastify API (`apps/api`) -> PostgreSQL (Prisma) & Redis (IORedis).
  - Background AI processing: Fastify enqueues to BullMQ -> Worker picks job -> Dispatches to upstream provider -> Updates PostgreSQL & publishes Redis SSE event -> Client receives realtime update.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | TrustProxy & IP Resolution | Unify IP extraction across Fastify & auth; block spoofed headers | M1 | Survey Explorer 1 |
| 2 | Fastify Security Headers | Register `@fastify/helmet` with HSTS, CSP, X-Content-Type-Options | M1 | Survey Explorer 1 |
| 3 | BFF Credential Isolation | Prevent unauthenticated injection of `adminBasicHeaders()` in Next.js proxy | M1 | Survey Explorer 1 & 2 |
| 4 | Cookie Ingestion Sanitization | Sanitize client `Cookie` headers to prevent session tampering | M1 | Survey Explorer 1 & 2 |
| 5 | Strict Admin Session Kind | Enforce `admin` session separation; reject customer cookie on admin routes | M1 | Survey Explorer 1 |
| 6 | Input Validation Schemas | Add formal Fastify request validation schemas across routes | M1 | Survey Explorer 1 |
| 7 | Atomic Rate Limiting | Replace non-atomic `incr`/`expire` with atomic Redis script/pipeline | M1 | Survey Explorer 1 |
| 8 | Password Complexity Validation | Enforce 8+ chars, uppercase, digit; eliminate raw SHA-256 bypass | M1 | Survey Explorer 1 |
| 9 | Admin User List N+1 Elimination | Use `user.wallet.availableCached` instead of 100 historical queries | M2 | Survey Explorer 1 |
| 10 | Customer Library SQL Optimization | Push status filtering, sorting, and pagination down to PostgreSQL SQL queries | M2 | Survey Explorer 1 |
| 11 | Ledger Balance SQL Aggregation | Replace full table memory scans with SQL `SUM()` aggregation in wallet | M2 | Survey Explorer 1 |
| 12 | GET Route DB Isolation | Decouple `autoExpireInvoices` DB write transactions from read GET routes | M2 | Survey Explorer 1 |
| 13 | Redis Hot Data Caching | Cache authenticated sessions, ModelCatalog, and AppSetting in Redis with TTL | M2 | Survey Explorer 1 |
| 14 | Redis SSE Connection Multiplexing | Replace per-client Redis duplicate connection with shared subscriber | M2 | Survey Explorer 1 |
| 15 | Prisma Composite Indexes | Add `@@index([userId, status])` and `@@index([userId, status, createdAt])` | M2 | Survey Explorer 1 |
| 16 | Mantine 8 Component Standardization | Replace 126+ inline `style={{ ... }}` with style props and CSS modules | M3 | Survey Explorer 2 |
| 17 | Mantine Built-ins Adoption | Replace custom pill buttons with `<SegmentedControl>`, tabs with `<Tabs>` | M3 | Survey Explorer 2 |
| 18 | Frontend State Decoupling | Eliminate `localModels` and `jobs` state mirroring in `useGenerateStudio` | M3 | Survey Explorer 2 |
| 19 | Hook-as-Controller SoC Separation | Extract data queries from Billing and Order presentation components | M3 | Survey Explorer 2 |
| 20 | React Query Key Unification | Unify `catalogPackages` and `orderPackages`; fix cache synchronization | M3 | Survey Explorer 2 |
| 21 | React Query Invalidation Triggers | Invalidate `userStatus` and `customerProfile` on profile/spicy updates | M3 | Survey Explorer 2 |
| 22 | Elimination of setInterval Polling | Replace polling in Snap modal and job-client with SSE EventSource | M3 | Survey Explorer 2 |
| 23 | API TypeScript Compilation Fixes | Fix all 79 `tsc` errors in `@ai-gen-free/api` (IORedis types, requestIp, enums) | M4 | Survey Spec Miner 3 |
| 24 | API Build Script Addition | Add `"build": "tsc --noEmit"` in `apps/api/package.json` | M4 | Survey Spec Miner 3 |
| 25 | Hermetic Test Isolation & Speedup | Mock external Kelontong AI fetch in `routes/chat.test.ts` (71s -> <1s) | M4 | Survey Spec Miner 3 |
| 26 | Test Fixture Foreign Key Fix | Seed test user fixture in `uploads/uploads.test.ts` to eliminate FK warning | M4 | Survey Spec Miner 3 |
| 27 | Auth Test Suite Expansion | Add automated tests for registration, login, logout, single-session DB delete | M4 | Survey Spec Miner 3 |
| 28 | Wallet Test Suite Expansion | Add tests for hold/capture lifecycle, pessimistic locking concurrency | M4 | Survey Spec Miner 3 |
| 29 | AI Job Test Suite Expansion | Add tests for job submission, 402/409/429 codes, and status polling | M4 | Survey Spec Miner 3 |
| 30 | Uploads Test Suite Expansion | Add route-level multipart streaming and 5MB limit rejection tests | M4 | Survey Spec Miner 3 |
| 31 | Full E2E & System Acceptance | Run baseline 102 tests + expanded tests, web build, api build, Docker check | M-Final | Orchestrator Plan |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Security Hardening & Session Protection (R1) | Features 1–8: Fastify trustProxy, security headers, BFF Basic Auth isolation, cookie sanitization, strict admin session, input schemas, atomic rate limiting, password complexity | none | DONE |
| M2 | Performance & Query Optimization (R2) | Features 9–15: Admin N+1 query fix, library SQL pagination, SQL SUM balance aggregation, GET route DB isolation, Redis session/catalog caching, SSE multiplexing, Prisma indexes | M1 | PLANNED |
| M3 | Frontend Refactoring & Component Standardization (R3) | Features 16–22: Mantine 8 style props & CSS modules, SegmentedControl/Tabs, state deduplication, view-controller extraction, React Query cache unification, polling elimination | none | PLANNED |
| M4 | Automated Test Suite Expansion & Build Stabilization (R4) | Features 23–30: API TypeScript errors fix, API build script, test speedup & fixture fix, test expansion across Auth, Wallet, AI Jobs, Uploads | M1, M2, M3 | PLANNED |
| M-Final | Final Acceptance Verification & E2E Validation | Feature 31: 102 baseline tests pass + expanded tests pass, API build clean, Web build clean, Docker containers healthy, Forensic integrity audit CLEAN | M1, M2, M3, M4 | PLANNED |

## Interface Contracts
### BFF Proxy (`apps/web`) ↔ Fastify API (`apps/api`)
- **Authentication**: Forward `sid` (customer) or `sid_admin` (admin) cookie ONLY if authenticated by `auth()` / `adminAuth()`. Strip untrusted client cookies.
- **Admin Basic Auth**: Only attach `Authorization: Basic ...` if `adminAuth()` returns a valid active admin session.
- **Error Format**: On upstream network failure, BFF returns `{ error: { code: "E001", message: "Gagal terhubung ke layanan backend." } }` with HTTP 502/503.

### Wallet Ledger (`@ai-gen-free/wallet`) ↔ Database (`@ai-gen-free/db`)
- **Balance Aggregation**: `computeBalance(userId)` uses `prisma.ledgerEntry.groupBy` or raw SQL `SUM(amount)` where `status = 'posted'`, avoiding full record memory loading.
- **Concurrency**: `adjustWallet` uses pessimistic row locking or atomic balance updates on `Wallet` model.

### AI Job Lifecycle (`apps/api`) ↔ Worker (`apps/worker`)
- **Realtime Events**: Client listens to SSE `/api/generate/:id/events` or `/api/invoices/events`. No `setInterval` polling allowed on clients.

## Code Layout
- **Milestone 1 (M1)**:
  - `apps/api/src/index.ts`
  - `apps/api/src/http.ts`
  - `apps/api/src/routes/auth.ts`
  - `apps/api/src/auth/service.ts`
  - `apps/api/src/auth/rate-limit.ts`
  - `packages/core/src/auth/password.ts`
  - `apps/web/app/api/[...path]/route.ts`
  - `apps/web/lib/cookie-header.ts`
  - `apps/web/middleware.ts`
- **Milestone 2 (M2)**:
  - `apps/api/src/admin/service.ts`
  - `apps/api/src/jobs/service.ts`
  - `packages/wallet/src/ledger.ts`
  - `apps/api/src/wallet/service.ts`
  - `apps/api/src/routes/wallet.ts`
  - `packages/db/prisma/schema.prisma`
  - `packages/db/src/index.ts`
- **Milestone 3 (M3)**:
  - `apps/web/components/*`
  - `apps/web/views/*`
  - `apps/web/hooks/*`
  - `apps/web/lib/query-keys.ts`
- **Milestone 4 (M4)**:
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
  - `apps/api/src/*` (TypeScript type reconciliation)
  - `apps/api/src/routes/chat.test.ts`
  - `apps/api/src/uploads/uploads.test.ts`
  - `apps/api/src/**/*.test.ts` (New test suites for Auth, Wallet, Jobs, Uploads)
