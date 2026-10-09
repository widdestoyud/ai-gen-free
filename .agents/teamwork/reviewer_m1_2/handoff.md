# Review & Adversarial Challenge Report: Milestone 1 (Auth Concurrency & BFF Proxy Security)

**Reviewer Identity**: `teamwork_preview_reviewer` (Role: Reviewer M1-2 - Auth Concurrency & BFF Proxy Security)  
**Target Work Product**: Milestone 1 Implementation by `worker_m1`  
**Verdict**: **APPROVE**  
**Overall Risk Assessment**: **LOW**

---

## 1. Observation

Direct code examination and command verification of the assigned Milestone 1 files yielded the following findings:

1. **Strict Admin Session Separation**:
   - In `apps/api/src/routes/admin.ts` (lines 51–73), `requireAdmin` was refactored:
     ```ts
     const token =
       (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
       (typeof req.headers["x-session-token"] === "string" && (req.headers["x-session-token"] as string).trim().length > 0
         ? (req.headers["x-session-token"] as string).trim()
         : undefined) ??
       (typeof req.headers["authorization"] === "string" && (req.headers["authorization"] as string).toLowerCase().startsWith("bearer ")
         ? (req.headers["authorization"] as string).slice(7).trim()
         : undefined);

     const context = {
       ip: requestIp(req),
       userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
     };

     const session = await userFromCookie(token, "admin", context);

     if (!session || session.user.role !== "admin") {
       reply.status(401).send({
         error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
       });
       return null;
     }
     ```
     The fallback to `req.cookies?.sid` and fallback to `userFromCookie(token, "user")` were completely removed.
   - In `apps/api/src/auth/service.ts` (lines 1314–1343), `userFromCookie` strictly validates `session.kind === kind` and enforces `if (kind === "admin" && session.user.role !== "admin") return null;`. Expired sessions are lazily deleted.

2. **Atomic Single-Session Creation with Row-Level Lock**:
   - In `apps/api/src/auth/service.ts` (lines 66–116), `createSingleSession` implements pessimistic row locking:
     ```ts
     return await prisma.$transaction(async (tx) => {
       await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${opts.userId} FOR UPDATE`;
       await tx.session.deleteMany({
         where: {
           userId: opts.userId,
           kind: opts.kind,
         },
       });
       const session = await tx.session.create({
         data: {
           userId: opts.userId,
           kind: opts.kind,
           tokenHash: opts.tokenHash,
           expiresAt: new Date(Date.now() + SESSION_TTL_MS),
           ip: opts.ip,
           userAgent: opts.userAgent,
         },
       });
       ...
       return session;
     });
     ```
   - All session issuance sites (`loginUser` line 588, `validateOtp` line 830, `loginWithGoogle` line 1008, and `loginAdmin` line 1450) invoke `createSingleSession`.

3. **Password Complexity Validation Rule (No Raw Hex Bypass)**:
   - In `packages/core/src/auth/password.ts` (lines 18–29):
     ```ts
     export function validatePassword(password: unknown): { valid: boolean; message?: string } {
       if (typeof password !== "string" || password.length < 8) {
         return { valid: false, message: "Kata sandi minimal 8 karakter" };
       }
       if (!/[A-Z]/.test(password)) {
         return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 huruf kapital" };
       }
       if (!/[0-9]/.test(password)) {
         return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 angka" };
       }
       return { valid: true };
     }
     ```
     The previous bypass `if (isSha256Hex(password)) return { valid: true };` was deleted.
   - `packages/core/src/auth/auth.test.ts` lines 29–32 explicitly tests rejection of 64-character lowercase SHA-256 pre-hashes without uppercase/digits.

4. **BFF Basic Auth Credential Isolation**:
   - In `apps/web/app/api/[...path]/route.ts` (lines 56–66) and `apps/web/lib/bff-proxy.ts` (lines 41–50):
     ```ts
     const isAdmin = path[0] === "admin";
     if (isAdmin) {
       const session = await adminAuth();
       if (session?.sid) {
         headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
         for (const [key, value] of Object.entries(adminBasicHeaders())) {
           if (!headers.has(key)) headers.set(key, value);
         }
       }
     }
     ```
     `adminBasicHeaders()` is now isolated inside the `if (session?.sid)` block. Unauthenticated callers cannot trigger injection of admin Basic Auth headers.

5. **Edge-Compatible Constant-Time Comparison in Middleware**:
   - In `apps/web/middleware.ts` (lines 8–18), `safeCompare` is implemented using an XOR accumulator:
     ```ts
     function safeCompare(a: string, b: string): boolean {
       if (typeof a !== "string" || typeof b !== "string") return false;
       let mismatch = a.length === b.length ? 0 : 1;
       const len = Math.max(a.length, b.length);
       for (let i = 0; i < len; i++) {
         const charA = i < a.length ? a.charCodeAt(i) : 0;
         const charB = i < b.length ? b.charCodeAt(i) : 0;
         mismatch |= charA ^ charB;
       }
       return mismatch === 0;
     }
     ```
     Both `userValid = safeCompare(u, user)` and `passValid = safeCompare(p, pass)` run in constant time relative to length without early exit, avoiding timing side-channels and avoiding Node-only `crypto.timingSafeEqual` in Edge runtime.

6. **Cookie Sanitization**:
   - In `apps/web/lib/cookie-header.ts` (lines 4–27):
     `sanitizeCookie` strips any client-sent `sid` and `sid_admin` cookies regardless of casing or surrounding whitespace.
     `mergeCookie` cleans existing cookies before appending trusted session tokens.

7. **Structured 502 Error Handling**:
   - In `apps/web/app/api/[...path]/route.ts` (lines 92–115 and 150–173) and `apps/web/lib/bff-proxy.ts` (lines 75–93):
     Network failures in `fetch(target, init)` and body stream reading errors are caught and return:
     ```json
     {
       "error": {
         "code": "E001",
         "message": "Gagal terhubung ke layanan backend."
       }
     }
     ```
     with HTTP status 502 and `cache-control: no-store`.

8. **Tool Commands and Results Directly Observed**:
   - `pnpm --filter @ai-gen-free/api test`:
     `ℹ tests 102 | ℹ suites 0 | ℹ pass 102 | ℹ fail 0 | ℹ duration_ms 34021.34882` (Exit code: 0).
   - `pnpm --filter @ai-gen-free/web build`:
     `✓ Compiled successfully in 53s | ✓ Linting and checking validity of types | ✓ Collecting page data | ✓ Generating static pages (9/9) | Finalizing page optimization` (Exit code: 0).
   - `npx tsx --test packages/core/src/auth/auth.test.ts`:
     `ℹ tests 4 | ℹ pass 4 | ℹ fail 0` (Exit code: 0).

---

## 2. Logic Chain

1. *From observation of `requireAdmin` in `apps/api/src/routes/admin.ts` (lines 51–73):*
   Removing `req.cookies?.sid` and removing `userFromCookie(token, "user")` guarantees that only a valid token corresponding to a database session with `kind = "admin"` and `user.role = "admin"` can access admin endpoints. A user session cookie cannot escalate privileges.
2. *From observation of `createSingleSession` in `apps/api/src/auth/service.ts` (lines 66–116):*
   Executing `SELECT "id" FROM "User" WHERE "id" = $userId FOR UPDATE` inside an interactive Prisma transaction acquires a row-level exclusive lock. Concurrent login requests for the same user serialize sequentially. The subsequent `deleteMany` revokes any prior active session for that kind, ensuring strictly one active session per user per kind at all times without race conditions.
3. *From observation of `validatePassword` in `packages/core/src/auth/password.ts` (lines 18–29):*
   Removing the raw 64-character hex bypass requires all passwords to have at least 8 characters, at least 1 uppercase letter, and at least 1 digit. Normalizing plaintext in `hashPassword` and supporting backward-compatible verification in `verifyPassword` ensures that existing accounts remain functional while stopping weak hex strings from bypassing registration/reset rules.
4. *From observation of `adminBasicHeaders()` gating in `apps/web/app/api/[...path]/route.ts`:*
   Placing `adminBasicHeaders()` inside `if (session?.sid)` prevents unauthenticated proxy callers from inheriting backend basic credentials. Combined with `sanitizeCookie`, an attacker cannot supply a forged cookie or trick the BFF proxy into adding basic credentials.
5. *From observation of `safeCompare` in `apps/web/middleware.ts`:*
   The XOR character accumulator evaluates all characters without early branching, ensuring execution time does not reveal partial credential matches, while executing cleanly within Next.js Edge runtime.
6. *From observation of try/catch blocks in `apps/web/app/api/[...path]/route.ts` and `bff-proxy.ts`:*
   Network failures to `apiBase()` return a compliant `{ error: { code: "E001", message: "Gagal terhubung ke layanan backend." } }` response with status 502, honoring the contract defined in `PROJECT.md`.
7. *From observation of forensic integrity inspection:*
   No hardcoded test results, facade logic, or shortcuts were found. All tests and builds executed genuinely against the live codebase.

---

## 3. Caveats

1. **Out-of-Scope Files Legacy Admin Fallback (Coverage Gap)**:
   In `apps/api/src/routes/wallet.ts` (lines 75, 88–91) and `apps/api/src/routes/uploads.ts` (lines 98, 111–114), `requireAdmin` still contains the legacy fallback pattern (`req.cookies?.sid` and `userFromCookie(token, "user")`). These files belong to Milestone 2 (`routes/wallet.ts`) and Milestone 4 (`routes/uploads.ts`). Worker M1 strictly adhered to assigned file ownership, but this pattern must be updated during M2/M4 work.
2. **Postgres-Specific Row Locking**:
   The `SELECT ... FOR UPDATE` syntax is PostgreSQL-specific. The project uses PostgreSQL in development and production (`prisma/schema.prisma` datasource `postgresql`), so this is fully compatible.

---

## 4. Conclusion

The Milestone 1 work delivered by `worker_m1` is **CORRECT**, **ROBUST**, and **COMPLETE** within its assigned scope:
- Strict admin session isolation is enforced.
- Single-session concurrency is serialized using PostgreSQL row-level locks.
- Password complexity enforcement has zero bypasses.
- BFF proxy credential isolation and cookie sanitization are effective against privilege escalation and session forgery.
- Edge middleware performs constant-time comparisons.
- Structured 502 responses conform to the project error contract.
- Build and test suites pass with 0 regressions.

**Verdict**: **APPROVE**

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify API Unit & Integration Tests**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected Outcome*: 102 tests pass, 0 fail, exit code 0.

2. **Verify Next.js Production Build**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected Outcome*: Static generation and type checking succeed, exit code 0.

3. **Verify Password Policy Unit Tests**:
   ```bash
   npx tsx --test packages/core/src/auth/auth.test.ts
   ```
   *Expected Outcome*: 4 tests pass, exit code 0.

---

## Review Summary

**Verdict**: **APPROVE**

### Findings

#### [Minor] Finding 1: Coverage Gap on Out-of-Scope Routes (`wallet.ts` & `uploads.ts`)
- **What**: `requireAdmin` in `apps/api/src/routes/wallet.ts` (lines 88–91) and `apps/api/src/routes/uploads.ts` (lines 111–114) still falls back to `userFromCookie(token, "user")`.
- **Where**: `apps/api/src/routes/wallet.ts` and `apps/api/src/routes/uploads.ts`.
- **Why**: While `worker_m1` was constrained to M1 files and properly fixed `routes/admin.ts` and `routes/payment.ts`, these two routes should be updated during M2 (Wallet) and M4 (Uploads) to maintain consistent session separation across all admin routes.
- **Suggestion**: Inform Orchestrator to include this update in the task dispatch for `worker_m2` and `worker_m4`.

### Verified Claims

- Admin session kind separation in `routes/admin.ts` → verified via code inspection and `routes/auth.test.ts` → **PASS**
- Atomic single-session enforcement with `SELECT ... FOR UPDATE` in `service.ts` → verified via code inspection and transaction semantics → **PASS**
- Password complexity validation in `packages/core/src/auth/password.ts` → verified via `packages/core/src/auth/auth.test.ts` → **PASS**
- BFF Basic Auth credential isolation behind `session?.sid` in `route.ts` and `bff-proxy.ts` → verified via code inspection → **PASS**
- Constant-time comparison `safeCompare` in `middleware.ts` → verified via code inspection → **PASS**
- Cookie sanitization `sanitizeCookie` in `cookie-header.ts` → verified via code inspection → **PASS**
- Upstream network failure 502 E001 handling in BFF proxy → verified via code inspection → **PASS**

### Coverage Gaps

- `apps/api/src/routes/wallet.ts` & `apps/api/src/routes/uploads.ts` admin fallback — Risk level: Low for M1 (out-of-scope for M1, deferred to M2/M4) — Recommendation: Address during M2 and M4.

### Unverified Items

- None.

---

## Challenge Report (Adversarial Critic)

**Overall Risk Assessment**: **LOW**

### Challenges

#### [Low] Challenge 1: Single Session Kind Scoping
- **Assumption challenged**: User logging in as admin should invalidate user session or vice versa.
- **Attack scenario**: An administrator logs in as customer on device A, then logs in as admin on device B.
- **Analysis**: `createSingleSession` scopes session invalidation to `kind: opts.kind`. This allows an admin account to maintain an active customer session and an active admin session simultaneously if needed, while preventing concurrent sessions of the *same* kind. When changing password (`changeUserPassword`), ALL sessions for that user ID are deleted regardless of kind.
- **Blast radius**: Negligible. Admin and user sessions use different cookie names (`sid_admin` vs `sid`) and different authorization headers.
- **Mitigation**: Existing design is sound.

#### [Low] Challenge 2: Edge Middleware `safeCompare` Non-String Defensive Handling
- **Assumption challenged**: Inputs `u` and `p` to `safeCompare` in `middleware.ts` could be non-strings.
- **Attack scenario**: Malformed headers or unexpected runtime coercion.
- **Analysis**: `safeCompare` begins with `if (typeof a !== "string" || typeof b !== "string") return false;`, preventing runtime exceptions.
- **Mitigation**: Confirmed resilient.
