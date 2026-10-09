# Handoff Report: Auth Service & Session Security Implementation Plan (M1-2)

**Author:** teamwork_preview_explorer (Role: Auth Service & Session Security Explorer)  
**Date:** 2026-10-08T08:43:00Z  
**Target Milestone:** M1 (Milestone 1 — Backend Security Hardening & Session Protection)  
**Target Features:** Feature 5 (Strict Admin Session Kind), Feature 8 (Password Complexity Validation), Single-Session Enforcement & Session Lifecycles  
**Status:** Complete Specification (Read-Only)

---

## 1. Observation

Direct observations from codebase inspection, schema analysis, and baseline test execution:

### A. Session Kind Fallback and Cookie Leak on Admin Routes
1. **`requireAdmin` in `apps/api/src/routes/admin.ts` (lines 47–78)**:
   ```typescript
   async function requireAdmin(
     req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
     reply: { status: (n: number) => { send: (b: unknown) => unknown } },
   ) {
     const token =
       (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
       (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
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

     let session = await userFromCookie(token, "admin", context);
     if (!session) {
       session = await userFromCookie(token, "user", context);
     }

     if (!session || session.user.role !== "admin") {
       reply.status(401).send({
         error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
       });
       return null;
     }
     return session;
   }
   ```
   - Line 53 reads `req.cookies?.sid` (the customer session cookie).
   - Lines 67–69 explicitly fall back to `userFromCookie(token, "user", context)`. If a user with `role === "admin"` logs in as a regular customer (creating a session with `kind: "user"`), they can access all administrative `/admin/*` endpoints using their customer cookie, directly bypassing session separation.
2. **`handleAdminLogin` and `handleAdminLogout` in `apps/api/src/routes/admin.ts`**:
   - `handleAdminLogin` (lines 141–142):
     ```typescript
     req.cookies?.sid_admin ??
     req.cookies?.sid ??
     ```
   - `handleAdminLogout` (lines 179–180):
     ```typescript
     req.cookies?.sid_admin ??
     req.cookies?.sid ??
     ```
   - Both handlers fall back to reading `req.cookies?.sid`.
3. **Corresponding Leaks in Other Admin Endpoints**:
   - `apps/api/src/routes/wallet.ts` lines 75 & 90: `requireAdmin` reads `req.cookies?.sid` and falls back to `userFromCookie(token, "user")`.
   - `apps/api/src/routes/payment.ts` lines 55 & 69: `requireAdmin` reads `req.cookies?.sid` and falls back to `userFromCookie(token, "user")`.
   - `apps/api/src/routes/uploads.ts` lines 98 & 113: `requireAdmin` reads `req.cookies?.sid` and falls back to `userFromCookie(token, "user")`.

### B. Single-Session Enforcement Concurrency Race Conditions
1. **`loginUser` in `apps/api/src/auth/service.ts` (lines 529–545)**:
   ```typescript
   await prisma.$transaction([
     prisma.session.deleteMany({ where: { userId: user.id, kind: "user" } }),
     prisma.session.create({
       data: {
         userId: user.id,
         kind: "user",
         tokenHash,
         expiresAt: new Date(Date.now() + SESSION_TTL_MS),
         ip: opts.ip,
         userAgent: opts.userAgent,
       },
     }),
     prisma.user.update({
       where: { id: user.id },
       data: { lastLoginAt: new Date() },
     }),
   ]);
   ```
2. **`validateOtp` in `apps/api/src/auth/service.ts` (lines 781–801)**:
   ```typescript
   await prisma.$transaction([
     prisma.session.deleteMany({ where: { userId: user.id, kind } }),
     prisma.session.create({
       data: {
         userId: user.id,
         kind,
         tokenHash,
         expiresAt: new Date(Date.now() + SESSION_TTL_MS),
         ip: opts.ip,
         userAgent: opts.userAgent,
       },
     }),
     prisma.user.update({
       where: { id: user.id },
       data: {
         lastDeviceId: deviceId,
         lastLoginAt: new Date(),
         emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
       },
     }),
   ]);
   ```
3. **`loginWithGoogle` in `apps/api/src/auth/service.ts` (lines 971–989)**:
   ```typescript
   const [session] = await prisma.$transaction([
     prisma.session.create({
       data: {
         userId: user.id,
         kind: "user",
         tokenHash,
         expiresAt: new Date(Date.now() + SESSION_TTL_MS),
         ip: opts.ip,
         userAgent: opts.userAgent,
       },
     }),
     prisma.session.deleteMany({
       where: {
         userId: user.id,
         kind: "user",
         tokenHash: { not: tokenHash },
       },
     }),
   ]);
   ```
4. **Analysis of the Race Condition**:
   - In PostgreSQL default read-committed isolation, `prisma.$transaction([ ... ])` batch arrays execute without locking the `User` row prior to mutation.
   - If two concurrent login or OTP requests (A and B) arrive for the same user simultaneously:
     - Request A runs `deleteMany` (deletes 0 or existing session).
     - Request B runs `deleteMany` (deletes 0 or existing session).
     - Request A inserts `Session A`.
     - Request B inserts `Session B`.
     - Both transactions commit.
     - **Result:** Two concurrent sessions exist in the database for the user, violating single-session enforcement.
   - Furthermore, `loginWithGoogle` executes in the reverse order (`create` then `deleteMany`), creating inconsistency across authentication providers.

### C. Password Complexity Validation Bypass via 64-Character Hex Strings
1. **`packages/core/src/auth/password.ts` (lines 19–33)**:
   ```typescript
   export function validatePassword(password: unknown): { valid: boolean; message?: string } {
     if (typeof password !== "string" || password.length < 8) {
       return { valid: false, message: "Kata sandi minimal 8 karakter" };
     }
     if (isSha256Hex(password)) {
       return { valid: true };
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
   - Lines 23–25 unconditionally return `{ valid: true }` if `isSha256Hex(password)` evaluates to true.
   - Any 64-character lowercase hexadecimal string (such as `5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8`, which is the SHA-256 hash of `"password"`, or `"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"`) completely bypasses the uppercase (`/[A-Z]/`) and digit (`/[0-9]/`) requirements.
   - An attacker can register or reset a password with any weak, dictionary-based password simply by sending its 64-character SHA-256 hash or an arbitrary hex string.
2. **Current Test in `packages/core/src/auth/auth.test.ts` (lines 29–32)**:
   ```typescript
   test("validatePassword accepts 64-character hex SHA-256 pre-hash", () => {
     const sha256Hex = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
     assert.equal(validatePassword(sha256Hex).valid, true);
   });
   ```
   - This test codified the bypass, which was flagged for elimination in M1 Feature 8.

### D. Session Expiry, Token Lookup, and Invalidation Routines
1. **`userFromCookie` in `apps/api/src/auth/service.ts` (lines 1288–1312)**:
   - Validates `session.expiresAt.getTime() < Date.now()`.
   - Never cleans up or deletes expired session rows from the database.
   - Does not verify that `session.user.role === "admin"` when `kind === "admin"`.
2. **`changeUserPassword` in `apps/api/src/auth/service.ts` (lines 1799–1805)**:
   - Updates `passwordHash` and `passwordChangedAt`.
   - Does not revoke active sessions for the user; compromised session tokens remain valid until expiration.
3. **Challenge and Token Lifecycles**:
   - `OtpChallenge`, `PasswordResetToken`, and `EmailVerificationToken` models do not have any automated TTL cleanup; expired rows accumulate indefinitely.

### E. Baseline Test and Build Status
1. **API Baseline Tests**:
   - Command: `pnpm --filter @ai-gen-free/api test`
   - Result: 102 passed, 0 failed (duration: 44.4s).
2. **Root Workspace Tests**:
   - Command: `pnpm test`
   - Result: 249 passed, 0 failed (duration: 11.2s).
3. **Web Build**:
   - Command: `pnpm --filter @ai-gen-free/web build`
   - Result: Exit code 0, 9 static pages + dynamic routes compiled cleanly.

---

## 2. Logic Chain

1. **Premise**: Fastify `/admin/*` routes (`apps/api/src/routes/admin.ts:53, 68`) read customer cookie `sid` and fall back to `userFromCookie(token, "user", context)`.  
   **Inference**: When an admin user signs in through the customer login flow, they obtain a session of `kind: "user"` stored in cookie `sid`. If this cookie is presented to `/admin/*`, `requireAdmin` accepts it. This violates strict privilege separation between customer and administrative surfaces (ADR 0010, M5 Contract). Disallowing `req.cookies?.sid` and removing the fallback to `kind: "user"` guarantees that admin endpoints are accessible ONLY with an active `kind: "admin"` session stored in `sid_admin` (or administrative Bearer/session headers).

2. **Premise**: `apps/api/src/auth/service.ts` executes `deleteMany` and `create` inside non-locking transactions for `loginUser` and `validateOtp`.  
   **Inference**: Two concurrent login requests from the same user can interleave their `deleteMany` queries before either creates their respective session, leaving both new sessions alive in the database. Utilizing an interactive Prisma transaction with `SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE` serializes concurrent login requests per user at the PostgreSQL row lock level. The second transaction must wait until the first commits, at which point its `deleteMany` cleanly purges the session created by the first, ensuring strictly ONE active session exists per user at all times.

3. **Premise**: `packages/core/src/auth/password.ts:23-25` immediately returns `{ valid: true }` if `isSha256Hex(password)` is true.  
   **Inference**: This short-circuit completely bypasses the length (min 8), uppercase (`/[A-Z]/`), and digit (`/[0-9]/`) requirements. Removing this short-circuit ensures that ALL password strings (whether plaintext or hexadecimal) must satisfy the required complexity constraints. Since standard lowercase SHA-256 strings have no uppercase characters, weak passwords cannot be laundered through raw SHA-256 hashing.

4. **Premise**: `userFromCookie` and `changeUserPassword` do not clean up expired or revoked sessions.  
   **Inference**: Implementing lazy deletion of expired sessions upon lookup, revoking other sessions during `changeUserPassword`, and introducing a dedicated `purgeExpiredAuthRecords` routine prevents database bloat and ensures immediate containment if user credentials change.

---

## 3. Caveats

1. **Client-Side SHA-256 Hashing (`apps/web`)**: In `apps/web/hooks/use-register.ts` and `use-reset-password.ts`, `hashPasswordClient` produces a lowercase SHA-256 hex string. Once the backend enforces `/[A-Z]/` on all inputs, client registrations via `useRegister` will require sending plaintext passwords over TLS (or the frontend hooks must be aligned in M1/M3). In API tests, passwords tested are already plaintext (`ValidPass123`), preserving 100% test compatibility.
2. **Database Migration Requirement**: The single-session enforcement logic implemented via `SELECT ... FOR UPDATE` is fully compatible with the existing Prisma schema and PostgreSQL database without requiring schema changes or DDL migrations.
3. **No Breaking Changes to Baseline Tests**: None of the 102 baseline tests in `@ai-gen-free/api` utilize customer cookies for admin endpoints or test 64-char hex bypass in `auth-flow.test.ts`. All 102 baseline tests will continue to pass seamlessly.

---

## 4. Conclusion

We provide the complete, concrete implementation specifications across all target files:

### Target 1: Enforce Strict Session Kind Separation on Admin Routes

#### File: `apps/api/src/routes/admin.ts`

**Edit A: Lines 47–78 (`requireAdmin`)**
- Remove `req.cookies?.sid` from token extraction.
- Remove fallback `userFromCookie(token, "user", context)`.

```typescript
<<<< BEFORE
async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
  const token =
    (typeof req.cookies?.sid_admin === "string" && req.cookies.sid_admin.trim().length > 0 ? req.cookies.sid_admin.trim() : undefined) ??
    (typeof req.cookies?.sid === "string" && req.cookies.sid.trim().length > 0 ? req.cookies.sid.trim() : undefined) ??
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

  let session = await userFromCookie(token, "admin", context);
  if (!session) {
    session = await userFromCookie(token, "user", context);
  }

  if (!session || session.user.role !== "admin") {
    reply.status(401).send({
      error: { code: ErrorCodes.UNAUTHENTICATED, message: "Silakan masuk sebagai admin" },
    });
    return null;
  }
  return session;
}
==== AFTER
async function requireAdmin(
  req: { cookies: Record<string, string | undefined>; headers: Record<string, unknown> },
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
) {
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
  return session;
}
>>>>
```

**Edit B: Lines 138–144 (`handleAdminLogin`)**
- Remove `req.cookies?.sid ??` from session token resolution.

```typescript
<<<< BEFORE
      const sessionToken =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);
==== AFTER
      const sessionToken =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);
>>>>
```

**Edit C: Lines 176–182 (`handleAdminLogout`)**
- Remove `req.cookies?.sid ??` from token resolution.

```typescript
<<<< BEFORE
      const token =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
        req.cookies?.sid ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);
==== AFTER
      const token =
        (typeof body.token === "string" && body.token.trim().length > 0 ? body.token.trim() : undefined) ??
        (typeof body.sessionToken === "string" && body.sessionToken.trim().length > 0 ? body.sessionToken.trim() : undefined) ??
        req.cookies?.sid_admin ??
        (typeof req.headers["x-session-token"] === "string" ? req.headers["x-session-token"] : undefined);
>>>>
```

#### Files: `apps/api/src/routes/wallet.ts`, `apps/api/src/routes/payment.ts`, `apps/api/src/routes/uploads.ts`
Apply the same `requireAdmin` cleanup across:
- `apps/api/src/routes/wallet.ts:69-92`: Remove `req.cookies?.sid` and fallback `userFromCookie(token, "user", context)`.
- `apps/api/src/routes/payment.ts:49-72`: Remove `req.cookies?.sid` and fallback `userFromCookie(token, "user", context)`.
- `apps/api/src/routes/uploads.ts:92-115`: Remove `req.cookies?.sid` and fallback `userFromCookie(token, "user", context)`.

---

### Target 2: Enforce Atomic Single-Session Validation and Invalidation

#### File: `apps/api/src/auth/service.ts`

**Step 1: Introduce `createSingleSession` Helper**
Add this function to `apps/api/src/auth/service.ts`:

```typescript
/**
 * Atomic single-session creation & invalidation.
 * Enforces strictly ONE active session per user for the given kind:
 * 1. Acquires a pessimistic lock on the User row via SELECT ... FOR UPDATE.
 * 2. Revokes/deletes all prior sessions for that (userId, kind).
 * 3. Creates the new session record with tokenHash and TTL.
 * 4. Updates User metadata (lastLoginAt, lastDeviceId, emailVerifiedAt).
 */
export async function createSingleSession(opts: {
  userId: string;
  kind: SessionKind;
  tokenHash: string;
  ip: string;
  userAgent?: string;
  deviceId?: string;
  markEmailVerified?: boolean;
}): Promise<Session> {
  return await prisma.$transaction(async (tx) => {
    // Pessimistic row-lock ensures concurrent logins serialize strictly
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${opts.userId} FOR UPDATE`;
    
    // Atomically purge any existing sessions of this kind
    await tx.session.deleteMany({
      where: {
        userId: opts.userId,
        kind: opts.kind,
      },
    });

    // Create the single active session
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

    const updateData: Record<string, unknown> = {
      lastLoginAt: new Date(),
    };
    if (opts.deviceId) {
      updateData.lastDeviceId = opts.deviceId;
    }
    if (opts.markEmailVerified) {
      updateData.emailVerifiedAt = new Date();
    }

    await tx.user.update({
      where: { id: opts.userId },
      data: updateData,
    });

    return session;
  });
}
```

**Step 2: Refactor `loginUser` (lines 525–546)**
```typescript
<<<< BEFORE
  // Jika device sama -> langsung masuk, cabut semua sesi lama (single session)
  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind: "user" } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind: "user",
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
  ]);
==== AFTER
  // Jika device sama -> langsung masuk, cabut semua sesi lama (single session)
  const token = randomToken();
  const tokenHash = hashSecret(appSecret(), token);

  await createSingleSession({
    userId: user.id,
    kind: "user",
    tokenHash,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
>>>>
```

**Step 3: Refactor `validateOtp` (lines 781–801)**
```typescript
<<<< BEFORE
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind,
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        lastDeviceId: deviceId,
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      },
    }),
  ]);
==== AFTER
  await createSingleSession({
    userId: user.id,
    kind,
    tokenHash,
    ip: opts.ip,
    userAgent: opts.userAgent,
    deviceId,
    markEmailVerified: !user.emailVerifiedAt,
  });
>>>>
```

**Step 4: Refactor `loginWithGoogle` (lines 971–989)**
```typescript
<<<< BEFORE
  const [session] = await prisma.$transaction([
    prisma.session.create({
      data: {
        userId: user.id,
        kind: "user",
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.session.deleteMany({
      where: {
        userId: user.id,
        kind: "user",
        tokenHash: { not: tokenHash },
      },
    }),
  ]);
==== AFTER
  const session = await createSingleSession({
    userId: user.id,
    kind: "user",
    tokenHash,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
>>>>
```

**Step 5: Refactor `loginAdmin` (lines 1419–1436)**
```typescript
<<<< BEFORE
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id, kind: "admin" } }),
    prisma.session.create({
      data: {
        userId: user.id,
        kind: "admin",
        tokenHash,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        ip: opts.ip,
        userAgent: opts.userAgent,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastDeviceId: deviceId },
    }),
  ]);
==== AFTER
  await createSingleSession({
    userId: user.id,
    kind: "admin",
    tokenHash,
    ip: opts.ip,
    userAgent: opts.userAgent,
    deviceId,
  });
>>>>
```

---

### Target 3: Password Complexity Validation in `packages/core/src/auth/password.ts`

#### File: `packages/core/src/auth/password.ts`

**Edit: Lines 19–33 (`validatePassword`)**
- Remove the raw `isSha256Hex` bypass.
- Require `password.length >= 8`, `/[A-Z]/`, and `/[0-9]/` uniformly across all passwords.

```typescript
<<<< BEFORE
export function validatePassword(password: unknown): { valid: boolean; message?: string } {
  if (typeof password !== "string" || password.length < 8) {
    return { valid: false, message: "Kata sandi minimal 8 karakter" };
  }
  if (isSha256Hex(password)) {
    return { valid: true };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 huruf kapital" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Kata sandi harus mengandung setidaknya 1 angka" };
  }
  return { valid: true };
}
==== AFTER
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
>>>>
```

#### File: `packages/core/src/auth/auth.test.ts`

**Edit: Lines 29–32**
- Update the test to verify that 64-char lowercase hex without uppercase/digit is rejected:

```typescript
<<<< BEFORE
test("validatePassword accepts 64-character hex SHA-256 pre-hash", () => {
  const sha256Hex = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
  assert.equal(validatePassword(sha256Hex).valid, true);
});
==== AFTER
test("validatePassword rejects 64-character hex SHA-256 pre-hash without uppercase/digits", () => {
  const sha256Hex = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
  assert.equal(validatePassword(sha256Hex).valid, false);
});
>>>>
```

---

### Target 4: Session Expiry, Invalidation, and Cleanup Routines

#### File: `apps/api/src/auth/service.ts`

**Edit A: Lines 1288–1312 (`userFromCookie`)**
- Enforce that if `kind === "admin"`, the user MUST have `user.role === "admin"`.
- Add lazy deletion for expired sessions encountered during lookup:

```typescript
<<<< BEFORE
  if (!session || session.kind !== kind || session.expiresAt.getTime() < Date.now()) {
    return null;
  }
  if (session.user.bannedAt) return null;
==== AFTER
  if (!session || session.kind !== kind || session.expiresAt.getTime() < Date.now()) {
    if (session && session.expiresAt.getTime() < Date.now()) {
      // Lazy cleanup of expired session
      void prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  if (session.user.bannedAt) return null;
  if (kind === "admin" && session.user.role !== "admin") return null;
>>>>
```

**Edit B: Lines 1796–1814 (`changeUserPassword`)**
- Revoke all other sessions when user changes password:

```typescript
<<<< BEFORE
  const newPasswordHash = await hashPassword(opts.newPasswordRaw as string);
  const now = new Date();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newPasswordHash,
      passwordChangedAt: now,
    },
  });
==== AFTER
  const newPasswordHash = await hashPassword(opts.newPasswordRaw as string);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: now,
      },
    }),
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
  ]);
>>>>
```

**Edit C: Add `purgeExpiredAuthRecords` Routine**
Add at the end of `apps/api/src/auth/service.ts`:

```typescript
/**
 * Maintenance routine to purge expired sessions, challenges, and tokens.
 * Can be run periodically via BullMQ worker or scheduled cron job.
 */
export async function purgeExpiredAuthRecords(now: Date = new Date()): Promise<{
  sessionsPurged: number;
  otpChallengesPurged: number;
  passwordResetTokensPurged: number;
  emailTokensPurged: number;
}> {
  const [sessions, otps, passwordTokens, emailTokens] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: { expiresAt: { lt: now } },
    }),
    prisma.otpChallenge.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
      },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }],
      },
    }),
  ]);

  return {
    sessionsPurged: sessions.count,
    otpChallengesPurged: otps.count,
    passwordResetTokensPurged: passwordTokens.count,
    emailTokensPurged: emailTokens.count,
  };
}
```

---

## 5. Verification Method

### A. Automated Test Commands
1. **API Baseline Tests (Must pass 102/102)**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected outcome:* Exit code 0, 102 tests pass, 0 fail.

2. **Root Workspace Tests (Must pass 249/249)**:
   ```bash
   pnpm test
   ```
   *Expected outcome:* Exit code 0, all core, web, provider, and api tests pass.

3. **Web Production Build**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected outcome:* Exit code 0, next build compiles cleanly without errors.

### B. Specific Invalidation Conditions
1. **Session Kind Separation**:
   Inspect `apps/api/src/routes/admin.ts:47-78`.
   *Invalidation condition:* If `requireAdmin` checks `req.cookies?.sid` or invokes `userFromCookie(token, "user")`, session kind separation is violated.
2. **Atomic Single Session**:
   Inspect `apps/api/src/auth/service.ts:createSingleSession`.
   *Invalidation condition:* If session creation does not hold `SELECT ... FOR UPDATE` row lock on `User`, concurrent login race conditions exist.
3. **Password Complexity**:
   Inspect `packages/core/src/auth/password.ts:23-25`.
   *Invalidation condition:* If `isSha256Hex(password)` returns `{ valid: true }` prior to uppercase and digit regex checks, raw SHA-256 bypass exists.
