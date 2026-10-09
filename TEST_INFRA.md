# E2E Test Infra: satulabs.id (ai-gen-free)

## Test Philosophy
- Opaque-box, requirement-driven. Validates platform reliability, security boundaries, and performance invariants.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial + Real-World Workload Testing.
- Standard runner: Native Node.js test runner (`node:test` + `node:assert/strict`) via `tsx --test`.

## Feature Inventory & Test Coverage
| # | Feature | Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|--------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | Authentication & Single-Session | R1 | 5 | 5 | ✓ | ✓ |
| 2 | Rate Limiting & Abuse Prevention | R1 | 5 | 5 | ✓ | ✓ |
| 3 | BFF Proxy Security & Credentials | R1 | 5 | 5 | ✓ | ✓ |
| 4 | Wallet Balance & Atomic Deduction | R2, R4 | 5 | 5 | ✓ | ✓ |
| 5 | AI Job Queueing & Lifecycle | R2, R4 | 5 | 5 | ✓ | ✓ |
| 6 | Upload Limits & Magic Byte Validation | R1, R4 | 5 | 5 | ✓ | ✓ |
| 7 | Query Performance & Pagination | R2 | 5 | 5 | ✓ | ✓ |
| 8 | Mantine UI & Zero Inline Styles | R3 | 5 | 5 | ✓ | ✓ |
| 9 | SSE Realtime vs Polling Elimination | R3 | 5 | 5 | ✓ | ✓ |
| 10 | TypeScript Clean Compilation & Build | Acceptance | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Runner**: `pnpm --filter @ai-gen-free/api test` and `npx tsx --test ...`
- **Pass/Fail Semantics**: 100% tests pass with exit code 0; 0 regressions on baseline 102 tests.
- **Directory Layout**:
  - `apps/api/src/**/*.test.ts`: Backend service unit and integration tests.
  - `apps/web/**/*.test.ts`: Frontend mapping and logic tests.
  - `packages/**/*.test.ts`: Core library and provider verification tests.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | User Registration -> OTP -> Login -> Single Session Enforce | F1, F2, F3 | High |
| 2 | Wallet Topup -> Point Hold -> AI Job Process -> Asset Proxy | F4, F5, F7 | High |
| 3 | Insufficient Points -> Rejection -> Webhook Credit -> Job Retry | F4, F5 | Medium |
| 4 | File Upload -> Magic Byte Check -> Aspect Ratio Scale -> Stream | F6, F7 | Medium |
| 5 | Concurrent Session Login on Multiple Devices | F1, F3 | High |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature
- Tier 3: Pairwise coverage across Auth x Wallet x AI Jobs
- Tier 4: ≥5 realistic end-to-end user journeys
