# Survey Handoff Report: Test Baseline & Coverage Specification

## 1. Observation

### 1.1 Test Tooling, Runners, and Configuration
- **Test Runner Framework**: The repository uses Node.js native test runner (`node:test` and `node:assert/strict`) executed via `tsx --test`. Neither Vitest nor Jest is installed in any package or root workspace (`pnpm ls vitest jest` returned empty).
- **Workspace Test Scripts**:
  - `apps/api/package.json` (line 9):
    ```json
    "test": "tsx --test src/jobs/params.test.ts src/jobs/catalog.test.ts src/jobs/siray-generate.test.ts src/jobs/fal-generate.test.ts src/jobs/output.test.ts src/admin/parse.test.ts src/routes/empty-body.test.ts src/auth/auth-flow.test.ts src/auth/basic.test.ts src/http-rewrite.test.ts src/uploads/uploads.test.ts src/wallet/wallet.test.ts src/activity/activity.test.ts src/chat/kelontong.test.ts src/routes/chat.test.ts"
    ```
  - `apps/web/package.json`: No `"test"` script is defined.
  - Root `package.json` (line 17): `"test": "tsx --test packages/core/... apps/api/... apps/worker/... ..."` runs 42 test files.
- **Total Test Files Across Repository**: Exactly 50 `*.test.ts` files exist across `apps/` and `packages/` containing 285 passing unit tests when executed together (`npx tsx --test $(find . -name "*.test.ts" -not -path "*/node_modules/*")`).

### 1.2 Baseline 102 Backend Tests in `@ai-gen-free/api`
Running `pnpm --filter @ai-gen-free/api test` executed 15 test files with the following verbatim summary:
```
ℹ tests 102
ℹ suites 0
ℹ pass 102
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 76744.137334
```

#### Detailed Breakdown of the 15 Baseline Test Files (102 Tests):
1. **`apps/api/src/jobs/params.test.ts`** (5 tests):
   - `defaults aspectRatio 1:1 and drops unknown keys` (1.68ms)
   - `keeps whitelist aspectRatio` (0.19ms)
   - `rejects unknown aspectRatio` (0.46ms)
   - `params.fail ignored unless dummy` (0.21ms)
   - `preserves size, tierSize, seed, and prompt_expansion_enable` (0.16ms)
2. **`apps/api/src/jobs/catalog.test.ts`** (9 tests):
   - `omitted modelId uses the only enabled model` (1.03ms)
   - `explicit modelId must match an enabled row` (0.50ms)
   - `0 or >1 enabled models require modelId` (0.23ms)
   - `unsupported mode is VALIDATION_ERROR` (0.14ms)
   - `displayName fallback from map` (0.21ms)
   - `resolveVideoPointCost resolves all standard duration & resolution matrix tiers` (0.26ms)
   - `resolveVideoPointCost respects custom admin videoConfigPoints overrides` (0.18ms)
   - `toOpaqueModelId masks vendor and model names into opaque capability IDs` (0.21ms)
   - `getCustomerCatalogDefaults provides opaque model IDs for client consumption` (0.51ms)
3. **`apps/api/src/jobs/siray-generate.test.ts`** (5 tests):
   - `known slugs map to catalog modelIds and modes` (1.00ms)
   - `unknown slug is VALIDATION_ERROR` (0.44ms)
   - `body size overrides seedream default` (0.19ms)
   - `seedance i2v models resolve defaults and duration / resolution override` (0.14ms)
   - `qwen edit spicy resolves defaults and image inputs` (0.18ms)
4. **`apps/api/src/jobs/fal-generate.test.ts`** (2 tests):
   - `resolveFalGenerateSlug resolves krea and dynamic slugs` (2.81ms)
   - `falGenerateParamsFromBody extracts parameters correctly` (1.91ms)
5. **`apps/api/src/jobs/output.test.ts`** (10 tests):
   - `promptPreview trims and caps at 120` (1.28ms)
   - `live vs expired vs purged` (0.25ms)
   - `resolveJobOutput: not succeeded or no asset is null` (0.30ms)
   - `resolveJobOutput: live customer asset is app file path, never Siray` (0.73ms)
   - `resolveJobOutput: live asset without jobId is signed 600s` (0.57ms)
   - `resolveJobOutput: expired or purged or missing object → url null, not throw` (1.08ms)
   - `listCustomerLibrary: defaults to 20 items per page and returns unified structure` (269.26ms)
   - `listCustomerLibrary: respects custom limit, offset, and type filter` (14.67ms)
   - `listCustomerLibrary: supports sorting by name, size, date with order asc/desc and type video/image` (43.67ms)
   - `listCustomerLibrary: respects isSpicy filter and excludes spicy items when spicy is false` (27.69ms)
6. **`apps/api/src/admin/parse.test.ts`** (8 tests):
   - `parseLimitOffset defaults and caps` (1.83ms)
   - `parseJobStatus and parseJobMode handle values and all` (0.26ms)
   - `parseCooldownSecondsValue rejects string and out of range` (0.20ms)
   - `parseProviderParam trims and rejects empty` (0.35ms)
   - `asCooldownSeconds falls back to seed 43200` (0.20ms)
   - `parseAdjustBody requires integer amount and reason` (0.26ms)
   - `parseIdempotencyKey 8–128` (0.24ms)
   - `DEFAULT_FALLBACK_MODELS contains valid models for all modes` (0.15ms)
7. **`apps/api/src/routes/empty-body.test.ts`** (1 test):
   - `Fastify handles empty application/json body gracefully without FST_ERR_CTP_EMPTY_JSON_BODY` (103.38ms)
8. **`apps/api/src/auth/auth-flow.test.ts`** (10 tests):
   - `Domain Whitelist: only allows gmail, yahoo, ymail` (1.06ms)
   - `Password Rule: min 8 chars, 1 uppercase, 1 digit` (0.37ms)
   - `Rate Limit OTP Request: max 3 attempts per 30 minutes, 4th is locked` (0.43ms)
   - `Rate Limit OTP Validation: max 3 wrong attempts rule` (0.12ms)
   - `Centralized Response Configuration Integrity` (0.29ms)
   - `OTP TTL Configuration & Fallback` (0.15ms)
   - `Rate Limit password reset per IP: max 3 emails, 4th blocked` (0.34ms)
   - `Password reset durations are read from RateLimitConfig not literals in tests` (0.20ms)
   - `Upload Policy: error code and response definitions` (0.19ms)
   - `Tester Account Config: default values and security validations` (0.44ms)
9. **`apps/api/src/auth/basic.test.ts`** (3 tests):
   - `parseBasicAuth parses valid Basic header` (1.39ms)
   - `parseBasicAuth handles invalid headers gracefully` (0.21ms)
   - `basicAuthorized validates matching credentials` (0.40ms)
10. **`apps/api/src/http-rewrite.test.ts`** (6 tests):
    - `keeps /api/health` (1.12ms)
    - `strips /api prefix then maps legacy customer paths` (0.45ms)
    - `maps admin legacy paths` (0.21ms)
    - `preserves query string` (0.14ms)
    - `Fastify default 404 payload is rewritten to project error shape` (223.76ms)
    - `Fastify rewriteUrl routes legacy /api paths to canonical handlers` (40.85ms)
11. **`apps/api/src/uploads/uploads.test.ts`** (18 tests):
    - `UploadConfig: contains all required configuration attributes` (1.18ms)
    - `isAllowedMimeType: correctly validates allowed and disallowed mime types` (0.19ms)
    - `isImageBuffer: magic byte detection validates real images` (40.49ms)
    - `compressUploadImage: portrait image remains portrait and aspect ratio is strictly preserved` (17.04ms)
    - `compressUploadImage: landscape image remains landscape and aspect ratio is strictly preserved` (9.80ms)
    - `compressUploadImage: scales down oversized images while maintaining aspect ratio and orientation` (172.32ms)
    - `processUpload: customer upload saves to correct key and returns valid payload` (115.44ms)
    - `processUpload: admin upload saves to correct admin key path` (16.31ms)
    - `processUpload: rejects invalid mime type and oversized files` (1.29ms)
    - `checkUploadRateLimit: allows within limit and throws 429 when limit exceeded` (0.77ms)
    - `normalizeUploadError: maps ERR_STREAM_PREMATURE_CLOSE to E005 with clear Indonesian message` (38.16ms)
    - `normalizeUploadError: maps unsupported media type or invalid multipart to E002` (0.43ms)
    - `listCustomerUploads: pagination and structure verification` (50.42ms)
    - `listAdminUploads: pagination and structure verification` (17.04ms)
    - `syncUploadsFromStorage: handles storage listing and synchronization gracefully` (1.01ms)
    - `getUploadFileForUser: streams image bytes directly without exposing R2 URL` (16.98ms)
    - `softDeleteUploadForUser: rejects non-existent or already deleted image with NOT_FOUND` (16.51ms)
    - `updateUploadAliasForUser: rejects non-existent upload with NOT_FOUND` (15.78ms)
12. **`apps/api/src/wallet/wallet.test.ts`** (10 tests):
    - `Topup catalog: returns predefined packages` (1.82ms)
    - `cancelInvoiceForUser: throws NOT_FOUND when invoice does not exist` (0.89ms)
    - `cancelInvoiceForAdmin: throws NOT_FOUND when invoice does not exist` (0.37ms)
    - `createMidtransPaymentGateway: returns null when MIDTRANS_SERVER_KEY is not configured` (0.28ms)
    - `createMidtransPaymentGateway: returns instance when MIDTRANS_SERVER_KEY is configured` (0.23ms)
    - `Midtrans signature integration: correctly verifies payload` (0.32ms)
    - `createXenditPaymentGateway: returns null when XENDIT_API_KEY is not configured` (0.19ms)
    - `createXenditPaymentGateway: returns instance when XENDIT_API_KEY is configured` (0.24ms)
    - `Xendit callback token integration: correctly verifies valid and invalid tokens` (0.43ms)
    - `Manual vs Online invoice expiry calculation` (0.32ms)
13. **`apps/api/src/activity/activity.test.ts`** (5 tests):
    - `Client Info Extractor: Cloudflare headers extraction` (1.43ms)
    - `Client Info Extractor: X-Forwarded-For fallback and Mobile User-Agent` (0.51ms)
    - `Client Info Extractor: Local / Private IP detection` (0.41ms)
    - `User Agent Parser: Android Mobile` (0.24ms)
    - `User Agent Parser: macOS Safari` (0.23ms)
14. **`apps/api/src/chat/kelontong.test.ts`** (6 tests):
    - `buildKelontongPayload: creates payload with default model gpt-5.6-sol` (1.46ms)
    - `buildKelontongPayload: converts single prompt to user message` (0.19ms)
    - `buildKelontongPayload: respects custom model and temperature` (0.14ms)
    - `buildKelontongPayload: throws error if messages and prompt are missing` (0.49ms)
    - `sendKelontongChatCompletion: sends request with bearer token and parses response` (37.21ms)
    - `sendKelontongChatCompletion: throws AppError on provider error` (0.94ms)
15. **`apps/api/src/routes/chat.test.ts`** (4 tests):
    - `POST /generate/chat: rejects unauthenticated requests` (107.07ms)
    - `POST /generate/magic-prompt: rejects unauthenticated requests` (14.33ms)
    - `POST /chat/magic-prompt: rejects unauthenticated requests` (13.21ms)
    - `enhancePromptWithMagicPrompt unit test with [TEST:QA] prompt` (70888.37ms)

Total Backend Baseline: 5 + 9 + 5 + 2 + 10 + 8 + 1 + 10 + 3 + 6 + 18 + 10 + 5 + 6 + 4 = **102 tests**.

### 1.3 Test Suite Execution Flaws & Bottlenecks Observed
1. **Critical Latency Flaw in `routes/chat.test.ts`**:
   Line 73: `enhancePromptWithMagicPrompt unit test with [TEST:QA] prompt` took **70,888 ms (70.9 seconds)** out of a 76.7s total test run. This test invokes `enhancePromptWithMagicPrompt()` without a mocked `fetchFn`, triggering an outbound HTTP call to `https://api.kelontongai.id/v1/chat/completions` which times out or retries before returning.
2. **Database Violation in `uploads.test.ts`**:
   During `processUpload: customer upload saves to correct key and returns valid payload`, Prisma logs a foreign key violation:
   ```
   prisma:error Invalid prisma.upload.create() invocation in apps/api/src/uploads/service.ts:229:27
   Foreign key constraint violated on the constraint: Upload_userId_fkey
   ```
   The test passes only because `processUpload` silently catches and logs the error in its try-catch block.
3. **Database Dependency Leakage in Unit Tests**:
   Tests such as `listCustomerLibrary` in `jobs/output.test.ts` and `processUpload` in `uploads/uploads.test.ts` issue live queries to the remote PostgreSQL instance configured in `.env` (`pgsql-dbas-jkt1-005.sumobase.my.id:6432`). If internet connectivity is severed, these tests will fail.

### 1.4 Verification Scripts & Build Diagnostics
1. **Web Build (`pnpm --filter @ai-gen-free/web build`)**:
   - Status: **PASSED (Exit code 0)**.
   - Next.js 15.5.25 compiled successfully in 18.6s.
   - Typechecking and linting completed cleanly (`✓ Linting and checking validity of types`).
   - 9 static routes and all dynamic/BFF endpoints generated cleanly.
2. **API Build (`pnpm --filter @ai-gen-free/api build`)**:
   - Status: **FAILED (No build script)**.
   - Verbatim response: `None of the selected packages has a "build" script`.
   - `apps/api/package.json` contains only `"dev"`, `"start"`, and `"test"`.
   - In `apps/api/Dockerfile`, the start command is `CMD ["pnpm", "--filter", "@ai-gen-free/api", "start"]` which invokes `tsx src/index.ts` directly, bypassing compilation.
3. **API TypeScript Compilation Diagnostics (`tsc`)**:
   - Direct invocation of TypeScript compiler on `apps/api/src/index.ts` revealed **79 TypeScript compilation errors across 19 files**:
     - `apps/api/src/index.ts`: 12 errors (IORedis namespace usage, missing properties).
     - `apps/api/src/admin/service.ts`: 11 errors.
     - `apps/api/src/auth/service.ts`: 8 errors (`Cannot use namespace 'IORedis' as a type`).
     - `apps/api/src/activity/service.ts`: 8 errors.
     - `apps/api/src/jobs/fal-generate.ts`: 9 errors.
     - `apps/api/src/routes/auth.ts`: 4 errors.
     - `apps/api/src/routes/payment.ts`, `routes/uploads.ts`, `routes/wallet.ts`: `requestIp(req)` type mismatches.
     - `apps/api/src/wallet/payment.ts`: Type comparisons where `"unpaid" | "rejected"` does not overlap `"expired"`.
4. **Docker Compose Verification (`docker compose ps`)**:
   - Status: All 5 containers are actively running and healthy:
     - `ai-gen-free-api-1`: Up 24h, port `127.0.0.1:4000` (healthy).
     - `ai-gen-free-redis-1`: Up 2 days, port `127.0.0.1:6379` (healthy).
     - `ai-gen-free-telemetry-1`: Up 2 days, port `127.0.0.1:5050`.
     - `ai-gen-free-web-1`: Up 24h, port `127.0.0.1:3000`.
     - `ai-gen-free-worker-1`: Up 30h, health port 3002 (healthy).
   - Live health probe: `curl -s http://127.0.0.1:4000/api/health` returned `{"transaction_id":"tx-...","ok":true,"service":"api"}` (200 OK).

---

## 2. Logic Chain

1. **Test Runner Alignment**: The repository standardizes on Node's built-in `node:test` runner executed by `tsx --test`. Any expansion of tests must use `import { test } from "node:test"` and `import assert from "node:assert/strict"` to maintain 100% compatibility with the existing test execution runner and avoid introducing extraneous test frameworks.
2. **Baseline Determinism**: The user requirement states: "All 102 existing backend unit tests continue to pass with 0 regressions". We verified that `pnpm --filter @ai-gen-free/api test` executes precisely the 15 designated test files yielding 102 passes. Tests added to `@ai-gen-free/api` can either be placed into new test files included in the test runner or added to a separate integration test target so the core baseline check remains verifiable.
3. **Mocking Deficiency**: Because `apps/api/src/routes/chat.test.ts` connects to an external HTTP endpoint and `uploads.test.ts` / `jobs/output.test.ts` connect to the production PostgreSQL pooler, the unit test suite violates hermetic isolation principles. Mocking the HTTP transport and providing an in-memory or transactions-mocked Prisma fixture will reduce execution time from 76 seconds to under 2 seconds.
4. **TypeScript Build Gap**: Requirement R4 and Acceptance Criteria mandate "Zero TypeScript compilation errors across `@ai-gen-free/api` and `@ai-gen-free/web`" and "Production build ... succeeds cleanly". Since `@ai-gen-free/api` lacks a build script and has 79 compilation errors when checked via `tsc`, a package-level `tsconfig.json` and `"build": "tsc --noEmit"` script must be established, and type annotations (particularly `IORedis` namespace imports and `requestIp` parameters) must be reconciled.
5. **Coverage Gaps in Critical Business Logic**: As documented in the Gap Matrix below, core domain workflows—such as full login credential validation, single-session DB invalidation, credit deductions (`holdForJob` / `captureJob`), atomic race protection, job cancellation, and webhook balance topups—currently have zero automated tests.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth | Domain Whitelist | Validates email domain against allowed providers (gmail, yahoo, ymail) | `email: string` | `boolean` | Returns `false` for unauthorized domains | `packages/core/src/auth/auth.ts`, `apps/api/src/auth/auth-flow.test.ts` |
| 2 | Auth | Password Complexity | Enforces min 8 chars, 1 uppercase letter, 1 digit | `password: string` | `{ valid: boolean, message?: string }` | Returns `valid: false` with localized explanation | `packages/core/src/auth/password.ts`, `apps/api/src/auth/auth-flow.test.ts` |
| 3 | Auth | OTP Request Rate Limit | Limits OTP generation to max 3 attempts per 30 minutes per email | `redis, key, rule` | `{ allowed, remainingAttempts, retryAfterSeconds }` | Returns `allowed: false` on 4th attempt | `apps/api/src/auth/rate-limit.ts`, `apps/api/src/auth/auth-flow.test.ts` |
| 4 | Auth | OTP Validation Lockout | Locks OTP challenge permanently after 3 consecutive wrong attempts | `code: string` | `{ token, user, message }` | Throws `AuthError(A004, 429)` OTP_LOCKED | `apps/api/src/auth/service.ts:729`, `apps/api/src/auth/auth-flow.test.ts` |
| 5 | Auth | Single-Session Invalidation | Deletes existing sessions for user upon successful login from new or same device | `userId, deviceId, token` | Session row in DB, old sessions deleted | Concurrent session rejected with `A019` if token active | `apps/api/src/auth/service.ts:530, 782`, `ensureNotLoggedIn()` |
| 6 | Auth | Basic Auth Admin Guard | Validates HTTP Basic Authorization header for admin endpoints | `Authorization: Basic <base64>` | `boolean` | Returns `401 Unauthorized` | `apps/api/src/auth/basic.ts`, `apps/api/src/auth/basic.test.ts` |
| 7 | Auth | Session Binding & Fingerprint | Validates client IP subnet (/24 IPv4, /64 IPv6) and User-Agent fingerprint | `SessionBindingContext` | `boolean` | Invalidation if token used from automated scanner or different OS/browser | `packages/core/src/auth/session-security.ts` |
| 8 | Wallet | Topup Package Catalog | Lists active coin/sparks packages with IDR price, points, bonus | None | `TopupPackage[]` | Returns static packages if DB empty | `apps/api/src/wallet/service.ts`, `apps/api/src/wallet/wallet.test.ts` |
| 9 | Wallet | Atomic Ledger Adjustment | Idempotent ledger entry creation with `SELECT FOR UPDATE` pessimistic locking | `userId, amount, reason, clientKey` | `{ idempotent, available, held, entry }` | Throws `INSUFFICIENT_POINTS (402)` if balance + amount < 0 | `packages/wallet/src/ledger.ts:69` |
| 10 | Wallet | Job Point Hold | Creates pending hold on points when AI job is enqueued | `userId, jobId, amount` | LedgerEntry(type: hold, status: pending) | Fails if available balance < amount | `packages/wallet/src/ledger.ts:150` |
| 11 | Wallet | Job Point Capture | Converts pending hold to void and posts capture entry on successful generation | `userId, jobId, amount` | LedgerEntry(type: capture, status: posted) | Idempotent replay if already captured | `packages/wallet/src/ledger.ts:164` |
| 12 | Wallet | Job Point Release | Voids pending hold and restores points on job failure/timeout | `userId, jobId, amount` | LedgerEntry(type: release, status: posted) | Idempotent replay if already released | `packages/wallet/src/ledger.ts:198` |
| 13 | Billing | Midtrans Signature Verification | Computes and verifies SHA-512 signature for Midtrans Snap webhook notifications | `orderId, statusCode, grossAmount, serverKey` | `boolean` | Rejects tampered payloads or mismatched keys | `packages/providers-midtrans/src/signature.ts` |
| 14 | Billing | Xendit Callback Token Verification | Timing-safe verification of Xendit webhook callback token | `token, expectedToken` | `boolean` | Returns `false` on mismatched or empty token | `packages/providers-xendit/src/signature.ts` |
| 15 | Billing | DANA Webhook Signature | Builds canonical string and verifies SHA256withRSA signature | `httpMethod, endpointUrl, accessToken, timestamp, body` | `boolean` | Rejects invalid or expired timestamp signatures | `packages/providers-dana/src/signature.ts` |
| 16 | AI Jobs | Model Catalog Resolution | Maps public slug or opaque ID to model configuration, mode, and point cost | `mode, modelId, isSpicy` | `CatalogRow` | Throws `VALIDATION_ERROR` on invalid slug or mode | `apps/api/src/jobs/catalog.ts`, `apps/api/src/jobs/catalog.test.ts` |
| 17 | AI Jobs | Video Point Cost Matrix | Computes cost dynamically based on duration (6s/10s/15s) and resolution (480p/720p/1080p) | `duration, resolution, adminOverrides?` | `number (points)` | Falls back to default matrix if tier unconfigured | `apps/api/src/jobs/catalog.ts:25` |
| 18 | AI Jobs | Opaque Model ID Masking | Conceals AI vendor and underlying model names from clients | `mode, modelId, isSpicy` | `t2i-standard`, `t2i-spicy`, `video-standard`, etc. | Regex verification prevents vendor name leakage | `apps/api/src/jobs/catalog.ts:70` |
| 19 | AI Jobs | Job Submission & Queueing | Validates prompt, deducts points via hold, enforces single active job per user, enqueues to BullMQ | `userId, idempotencyKey, body` | `JobAcceptedResponse (202)` | Throws `409 JOB_IN_PROGRESS`, `402 INSUFFICIENT_POINTS`, `429 COOLDOWN` | `apps/api/src/jobs/service.ts:13` |
| 20 | AI Jobs | Provider Dispatch & Fallback | Worker picks job, resolves inputs to base64, dispatches to Siray, Fal, or Dummy provider | `jobId` | Output buffer / URL | CircuitBreaker trips on 3 consecutive failures | `apps/worker/src/process-job.ts:114` |
| 21 | AI Jobs | Asset Delivery Proxy | Proxies generated output files via `/customer/generated/:jobId/file` without exposing Cloudflare R2 | `jobId, userId` | WebP stream with cache headers | Returns 404 if expired or purged | `apps/api/src/jobs/output.ts:43` |
| 22 | AI Jobs | Kelontong AI Magic Prompt | Enhances prompt using Kelontong chat completion API (`gpt-5.6-sol`) | `{ prompt, style? }` | `{ enhancedPrompt, originalPrompt, model }` | Throws `VALIDATION_ERROR` if prompt empty | `apps/api/src/chat/magic-prompt.ts` |
| 23 | Uploads | Magic Byte Validation | Validates actual image buffers using file magic bytes (PNG, JPEG, WebP) | `Buffer / Uint8Array` | `boolean` | Rejects non-image files even if Content-Type is forged | `apps/api/src/uploads/service.ts:133`, `apps/api/src/uploads/uploads.test.ts` |
| 24 | Uploads | Sharp Image Compression | Compresses uploads to WebP, preserving orientation, scaling max dimension to 2048px | `imageBuffer` | `{ buffer, contentType, width, height, sizeBytes }` | Preserves exact aspect ratio | `apps/api/src/uploads/service.ts:80`, `apps/api/src/uploads/uploads.test.ts` |
| 25 | Uploads | Rate Limiting per Actor | Enforces max 10 uploads per window for customers | `redis, actor, actorId` | `void` | Throws `429 Batas frekuensi upload terlampaui` | `apps/api/src/uploads/service.ts:150` |
| 26 | Uploads | Direct Storage Streaming Proxy | Streams uploaded images directly to authenticated users via `/customer/uploads/:id/file` | `userId, uploadId` | Binary stream (`image/webp`) | Throws `404` if image not found or deleted | `apps/api/src/uploads/service.ts:323` |
| 27 | Routing | URL Rewrite & Backward Compatibility | Rewrites legacy `/api/*` endpoints to canonical `/customer/*` and `/admin/*` routes | `url, method` | Normalized URL path | Rewrites Fastify 404 payload to standard `{ error: { code: 'E003' } }` | `apps/api/src/http-rewrite.ts`, `apps/api/src/http-rewrite.test.ts` |
| 28 | Admin | Parameter Parsing & Audit | Validates pagination limits (cap 100), cooldown seconds, idempotency keys, and adjusts points | `req.query / req.body` | Validated types | Throws `VALIDATION_ERROR (400)` | `apps/api/src/admin/parse.ts`, `apps/api/src/admin/parse.test.ts` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Empty JSON Request Body | `POST /admin/logout` with `""`, `Buffer.alloc(0)`, or `content-length: 0` | Fastify custom parser avoids `FST_ERR_CTP_EMPTY_JSON_BODY` and injects empty object `{}` cleanly (`routes/empty-body.test.ts`). |
| 2 | Magic Prompt Network Timeout | `enhancePromptWithMagicPrompt({ prompt: "[TEST:QA] seekor kucing astronot" })` | Unmocked `fetch` attempts real connection to `https://api.kelontongai.id`, hanging unit test runner for 70,888 ms (`routes/chat.test.ts`). |
| 3 | Upload Database Foreign Key | `processUpload` with unseeded `actorId: "usr_cust123"` | Throws `Upload_userId_fkey` constraint violation in Prisma, swallowed by service catch-block (`uploads/uploads.test.ts`). |
| 4 | Asset Expiry & Purged Handling | `resolveJobOutput` with `expiresAt: past` or `purgedAt: now` | Returns `{ url: null, contentType: "image/png", availableUntil }` without throwing unhandled exceptions (`jobs/output.test.ts`). |
| 5 | Legacy URL Rewriting | `GET /api/me`, `POST /api/user/login`, `GET /api/jobs` | Strips `/api` prefix, maps to `/customer/profile`, `/customer/login`, `/customer/generated-lists` preserving query string (`http-rewrite.test.ts`). |
| 6 | Circuit Breaker State Transition | 3 consecutive failures to Siray provider | Transitions from `CLOSED` to `OPEN`, immediately fast-failing subsequent jobs in 0ms with error `W007`, then transitions to `HALF_OPEN` after cooldown (`packages/core/src/circuit-breaker.test.ts`). |
| 7 | Job Output De-duplication | Siray returns identical URL in `outputs` array and `fail_reason` string | `collectSirayOutputUrls` strips duplicate string entries and prevents duplicate asset creation (`packages/providers-siray/src/siray.test.ts`). |
| 8 | Aspect Ratio Oversized Scaling | `3000x1500` landscape JPEG image upload | Scaled down to `2048x1024`, preserving exact 2:1 landscape aspect ratio and WebP conversion (`uploads/uploads.test.ts`). |
| 9 | Single Session Conflict | Request carrying existing active session token calls login endpoint | Throws `AuthError(A019, 409)` `ALREADY_LOGGED_IN` to prevent session corruption (`auth/service.ts:120`). |
| 10 | Wallet Negative Balance Attempt | `adjustWallet` with amount greater than negative available balance | Rolls back transaction and throws `AppError(INSUFFICIENT_POINTS, 402)` (`packages/wallet/src/ledger.ts:104`). |

---

## 5. Critical Service Test Coverage Gap Matrix & Expansion Specifications

| Critical Domain | Sub-Feature | Current Test Status | Gap Description | Proposed Test Specification |
|---|---|---|---|---|
| **Authentication** | User Registration | ❌ Not tested in API suite | No automated tests for `registerUser` calling Prisma DB: password hashing, duplicate email rejection (`A014`), Google account collision (`A015`), mailer token creation. | Unit test `registerUser` with mock mailer and Prisma memory/transaction fixture verifying DB row creation and token generation. |
| **Authentication** | Customer Login Flow | ❌ Not tested in API suite | Only `isAllowedEmailDomain` and `validatePassword` tested. No test calls `loginUser` or `POST /customer/login`: password verification, unverified email rejection (`A013`), banned user check, first login vs known device OTP requirement. | End-to-end route test `app.inject({ method: "POST", url: "/customer/login" })` verifying 200 on correct credentials, 401 on bad password, and OTP challenge triggering on new device ID. |
| **Authentication** | Single-Session Enforcement | ❌ Not tested in API suite | Zero tests verifying that logging in on device B invalidates/deletes the session record on device A in Prisma `Session` table. | Concurrently log in user with token 1, then token 2; verify token 1 session is deleted in DB and subsequent API calls with token 1 return 401. |
| **Authentication** | Customer / Admin Logout | ❌ Not tested in API suite | Only empty body parsing on `/admin/logout` is tested. No test checks that session cookie is cleared (`Set-Cookie: max-age=0`) and session is deleted from Prisma. | Integration test `POST /customer/logout` and `POST /admin/logout` asserting session deletion in DB and expired cookie header. |
| **Authentication** | Password Reset Lifecycle | ⚠️ Core unit tests only | Core package has unit tests for `evaluatePasswordResetRequest`, but no tests verify `requestPasswordReset`, `validatePasswordResetToken`, and `confirmPasswordReset` against Fastify endpoints. | Test full cycle: `POST /auth/password-reset` -> check token generated in DB -> `POST /auth/password-reset-confirm` -> verify password updated and sessions revoked. |
| **Authentication** | Google OAuth Login | ❌ Not tested in API suite | `loginWithGoogle` in `apps/api/src/auth/service.ts` has no automated tests. | Mock `GoogleOAuthClient.verifyIdToken` returning valid payload; verify new user creation, wallet initialization, and single session creation. |
| **Wallet & Billing** | Hold / Capture Lifecycle | ⚠️ Tested in worker only | Worker has memory store test for job process, but `@ai-gen-free/wallet` functions `holdForJob`, `captureJob`, and `releaseJob` have no tests against Prisma. | Integration test verifying `holdForJob` decreases available balance; `captureJob` voids hold and posts capture; `releaseJob` restores available balance. |
| **Wallet & Billing** | Atomic Balance Protection & Concurrency | ❌ Not tested | No automated test verifies pessimistic locking (`SELECT FOR UPDATE`) under concurrent point deduction or hold operations. | Spawn 5 concurrent parallel deduction promises on a wallet with 10 points; assert exactly 1 succeeds and 4 throw 402 without negative balance. |
| **Wallet & Billing** | Idempotent Replays | ⚠️ Key helper only | Only string formatting `adjustIdempotencyKey` is tested. The actual replay behavior in `adjustWallet` is not verified. | Call `adjustWallet` twice with the same idempotency key; assert the second call returns `{ idempotent: true }` without incrementing points twice. |
| **Wallet & Billing** | Payment Webhook Credits | ⚠️ Signature math only | Midtrans and Xendit signature/token math is tested, but neither webhook handler (`/customer/payment/webhook` / `/payment/webhook`) is tested for crediting user wallet. | Integration test invoking Fastify payment webhook with valid signature; verify invoice status transitions to `paid` and topup ledger entry credits wallet. |
| **AI Job Lifecycle** | Job Submission (`submitJob`) | ❌ Not tested | Neither unit nor route tests execute `submitJob`. Cooldown enforcement (`429 COOLDOWN`), active job blocking (`409 JOB_IN_PROGRESS`), and wallet point checks are untested. | Route test `POST /jobs` testing: (a) insufficient points returns 402, (b) active queued job blocks duplicate with 409, (c) successful submission creates job & hold. |
| **AI Job Lifecycle** | Job Polling & Status Exposure | ❌ Not tested in API suite | `GET /customer/generated/:jobId` is never tested via Fastify route injection. Progress percentage calculation and error message masking are untested at route level. | Route test `GET /customer/generated/:jobId` returning queued, running (with progress percent), failed (with masked error message), and succeeded states. |
| **AI Job Lifecycle** | Job Cancellation | ❌ Not implemented / tested | System lacks explicit customer/admin cancellation endpoint with point refund. | Specify and test job cancellation route: marks job `canceled`, calls `releaseJob` to restore held points. |
| **AI Job Lifecycle** | Magic Prompt Hermetic Isolation | ❌ Live network call | `routes/chat.test.ts` connects to live `api.kelontongai.id` causing 71s delay. | Inject mocked `fetchFn` into `enhancePromptWithMagicPrompt` so unit test executes deterministically in <5ms without internet dependency. |
| **Uploads** | Multipart Streaming Route | ⚠️ Service function only | `processUpload` tested in memory, but Fastify multipart handling (`POST /customer/uploads`) via `@fastify/multipart` is not tested with stream payloads. | Fastify route integration test sending `multipart/form-data` with test image buffer; verify 201 response and returned upload metadata. |
| **Uploads** | Upload 5MB Limit Enforcement | ⚠️ Service validation only | Fastify request-level rejection of payloads >5MB (`FST_REQ_FILE_TOO_LARGE`) is not tested at the route level. | Test sending 5.5MB stream to `/customer/uploads`; assert Fastify aborts with 400/413 error and mapped Indonesian error message. |
| **Uploads** | Database Foreign Key Fix | ⚠️ Silent failure in test | `uploads/uploads.test.ts` logs foreign key violation because user `usr_cust123` is not created in DB before test runs. | Add test fixture to create temporary test user in DB (or mock `prisma.upload.create`) before running upload test. |

---

## 6. Caveats
1. **Remote Database State**: Unit tests in `@ai-gen-free/api` currently touch the remote PostgreSQL database specified in `.env`. Database latency and preexisting table state may slightly alter test execution times across runs.
2. **Missing `apps/api` Build Target**: Because `@ai-gen-free/api` has no `build` script in `package.json`, automated build verifiers like `pnpm --filter @ai-gen-free/api build` will report missing script until one is added.
3. **TypeScript Compilation Status**: The 79 TypeScript compilation errors identified in `@ai-gen-free/api` are masked when executing with `tsx` (which strips types at runtime without typechecking). They become visible only when `tsc` is explicitly run.
4. **No Test Framework Divergence**: Vitest or Jest should NOT be introduced arbitrarily; the repository has an established, working pattern using `node:test` via `tsx --test`.

---

## 7. Conclusion
- The automated testing baseline is **102 tests** in `@ai-gen-free/api` (all passing) across 15 test files.
- The repository contains **50 test files** with **285 passing tests** in total across core, providers, worker, telemetry, and web packages.
- `@ai-gen-free/web` builds cleanly with zero errors under Next.js 15, and has 10 unit tests across 3 files, though it currently lacks a `"test"` script in `package.json`.
- `@ai-gen-free/api` suffers from two major verification tooling defects: (1) no `"build"` script defined in `package.json`, and (2) 79 TypeScript compilation errors when checked with `tsc`.
- Unit test execution in `@ai-gen-free/api` is bottlenecked by an unmocked live network call in `routes/chat.test.ts` (taking ~70.9s), and leaks foreign-key errors against remote PostgreSQL in `uploads/uploads.test.ts`.
- Substantial coverage gaps exist across all four critical services: Auth (login, logout, single-session, Google OAuth), Wallet (ledger holds, captures, pessimistic concurrency, webhooks), AI Jobs (submission, queueing, polling, cancellation), and Uploads (Fastify multipart streaming routes).

---

## 8. Verification Method

To independently verify all findings and test baselines, execute the following commands:

1. **Verify Backend Baseline (102 passing tests)**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected outcome*: Exits code 0 with `ℹ tests 102`, `ℹ pass 102`, `ℹ fail 0`. Duration will reflect the ~71s delay in `chat.test.ts`.

2. **Verify All 285 Unit Tests Across the Repository**:
   ```bash
   npx tsx --test $(find . -name "*.test.ts" -not -path "*/node_modules/*" | sort)
   ```
   *Expected outcome*: Exits code 0 with `ℹ tests 285`, `ℹ pass 285`, `ℹ fail 0`.

3. **Verify Web Production Build**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected outcome*: Exits code 0, compiles Next.js in ~18s, validates types and lints with 0 errors.

4. **Verify API Build Absence**:
   ```bash
   pnpm --filter @ai-gen-free/api build
   ```
   *Expected outcome*: Exits code 0 with `None of the selected packages has a "build" script`.

5. **Verify API TypeScript Errors**:
   ```bash
   npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck apps/api/src/index.ts
   ```
   *Expected outcome*: Exits code 2 reporting `Found 79 errors in 19 files`.

6. **Verify Docker Container Health**:
   ```bash
   docker compose ps
   curl -s http://127.0.0.1:4000/api/health
   ```
   *Expected outcome*: 5 services up and healthy, API health returns `{"ok":true,"service":"api"}`.
