import test, { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import IORedis from "ioredis";
import {
  validatePassword,
  hashPassword,
  verifyPassword,
  hashSecret,
  randomToken,
  RateLimitRule,
  ErrorCodes,
} from "@ai-gen-free/core";
import { prisma } from "@ai-gen-free/db";
import {
  createSingleSession,
  userFromCookie,
  changeUserPassword,
  purgeExpiredAuthRecords,
} from "../apps/api/src/auth/service.js";
import { enforceRateLimit } from "../apps/api/src/auth/rate-limit.js";
import { sanitizeCookie, mergeCookie } from "../apps/web/lib/cookie-header.js";
import { registerAdminRoutes } from "../apps/api/src/routes/admin.js";

const APP_SECRET = process.env.SESSION_SECRET ?? "change-me-to-32-bytes-min";
const rawRedisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const REDIS_URL = rawRedisUrl.replace("://redis:", "://127.0.0.1:");

describe("Milestone 1 Adversarial Challenge & Concurrency Verification", () => {
  let redis: IORedis;

  before(async () => {
    redis = new IORedis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
    await redis.connect();
  });

  after(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  // =========================================================================
  // CHALLENGE 1: Password Complexity Validation
  // =========================================================================
  describe("Challenge 1: Password Complexity & Edge Cases", () => {
    it("rejects non-string types safely without throwing", () => {
      const nonStrings = [
        null,
        undefined,
        0,
        12345678,
        true,
        false,
        {},
        [],
        () => "Password123",
        Symbol("pwd"),
      ];
      for (const val of nonStrings) {
        const res = validatePassword(val);
        assert.equal(res.valid, false, `Expected ${String(val)} to be invalid`);
        assert.equal(res.message, "Kata sandi minimal 8 karakter");
      }
    });

    it("rejects strings shorter than 8 characters regardless of complexity", () => {
      const shortInputs = ["", "a", "1", "A1!", "Ab1", "Abcde1", "Abcde12"];
      for (const val of shortInputs) {
        const res = validatePassword(val);
        assert.equal(res.valid, false, `Expected length ${val.length} to be invalid`);
        assert.equal(res.message, "Kata sandi minimal 8 karakter");
      }
    });

    it("rejects passwords lacking uppercase letters", () => {
      const lackingUppercase = [
        "abcdefgh",
        "alllowercase123",
        "1234567890",
        "password_with_numbers_12345",
        "lowercase!@#$%^&*()123",
      ];
      for (const val of lackingUppercase) {
        const res = validatePassword(val);
        assert.equal(res.valid, false, `Expected '${val}' to fail uppercase check`);
        assert.equal(res.message, "Kata sandi harus mengandung setidaknya 1 huruf kapital");
      }
    });

    it("rejects passwords lacking digits", () => {
      const lackingDigits = [
        "ABCDEFGH",
        "AllLettersNoDigits",
        "NO_DIGITS_HERE!",
        "SpecialOnly!@#$%^&*",
        "UpperAndLowerOnlyWithoutNumbers",
      ];
      for (const val of lackingDigits) {
        const res = validatePassword(val);
        assert.equal(res.valid, false, `Expected '${val}' to fail digit check`);
        assert.equal(res.message, "Kata sandi harus mengandung setidaknya 1 angka");
      }
    });

    it("ADVERSARIAL: rejects 64-char hex SHA-256 strings that lack complexity requirements", () => {
      // 1. Raw lowercase 64-char hex with digits (the previous bypass vector)
      const lowercaseHexWithDigits = "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
      assert.equal(lowercaseHexWithDigits.length, 64);
      const res1 = validatePassword(lowercaseHexWithDigits);
      assert.equal(res1.valid, false, "64-char lowercase hex MUST be rejected (no uppercase)");
      assert.equal(res1.message, "Kata sandi harus mengandung setidaknya 1 huruf kapital");

      // 2. 64-char lowercase hex without digits (all 'a'-'f')
      const lowercaseHexNoDigits = "abcdef".repeat(10) + "abcd";
      assert.equal(lowercaseHexNoDigits.length, 64);
      const res2 = validatePassword(lowercaseHexNoDigits);
      assert.equal(res2.valid, false, "64-char hex with no digits/uppercase MUST be rejected");

      // 3. 64-char uppercase hex without digits (all 'A'-'F')
      const uppercaseHexNoDigits = "ABCDEF".repeat(10) + "ABCD";
      assert.equal(uppercaseHexNoDigits.length, 64);
      const res3 = validatePassword(uppercaseHexNoDigits);
      assert.equal(res3.valid, false, "64-char uppercase hex with no digits MUST be rejected");
      assert.equal(res3.message, "Kata sandi harus mengandung setidaknya 1 angka");

      // 4. 64-char hex that explicitly meets BOTH uppercase and digit requirements
      const compliantHex = "5E884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
      assert.equal(compliantHex.length, 64);
      const res4 = validatePassword(compliantHex);
      assert.equal(res4.valid, true, "64-char hex WITH uppercase and digit MUST be accepted");
    });

    it("ADVERSARIAL: validates international / unicode boundaries", () => {
      // Non-ASCII uppercase (Cyrillic) without ASCII [A-Z] -> should NOT satisfy ASCII [A-Z] requirement
      const cyrillicUpper = "ПРИВЕТ1234";
      const res1 = validatePassword(cyrillicUpper);
      assert.equal(res1.valid, false, "Cyrillic uppercase must not bypass ASCII [A-Z] policy");
      assert.equal(res1.message, "Kata sandi harus mengandung setidaknya 1 huruf kapital");

      // Valid unicode password containing ASCII uppercase and digit
      const validUnicode = "ValidP@ss123 🚀";
      const res2 = validatePassword(validUnicode);
      assert.equal(res2.valid, true, "Valid password with unicode character must be accepted");
    });

    it("ADVERSARIAL: ReDoS resilience against 100,000-character input", () => {
      const hugeInput = "a".repeat(100000) + "A1";
      const startTime = performance.now();
      const res = validatePassword(hugeInput);
      const duration = performance.now() - startTime;
      assert.equal(res.valid, true);
      assert.ok(duration < 50, `Validation took ${duration}ms, potential ReDoS detected`);
    });

    it("scrypt password hashing and constant-time verification roundtrip", async () => {
      const plaintext = "M1SecureSecret99#";
      const hash = await hashPassword(plaintext);
      assert.ok(hash.includes(":"), "Hash format must be salt:hash");

      // Correct verification
      const ok = await verifyPassword(plaintext, hash);
      assert.equal(ok, true);

      // Wrong password
      const wrong = await verifyPassword("WrongM1Secret99#", hash);
      assert.equal(wrong, false);

      // Pre-hashed verification compatibility
      const sha = "5E884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8";
      const shaHash = await hashPassword(sha);
      assert.equal(await verifyPassword(sha, shaHash), true);
      assert.equal(await verifyPassword("5E884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d9", shaHash), false);
    });
  });

  // =========================================================================
  // CHALLENGE 2: Single-Session Concurrency & Pessimistic Row Locking
  // =========================================================================
  describe("Challenge 2: Single-Session Concurrency & Row Locking", () => {
    const testUserId = `test-user-m1-${Date.now()}`;
    const testEmail = `challenger-m1-${Date.now()}@gmail.com`;

    before(async () => {
      // Seed dedicated test user in Postgres
      await prisma.user.create({
        data: {
          id: testUserId,
          email: testEmail,
          role: "user",
        },
      });
    });

    after(async () => {
      // Teardown test user and related sessions
      await prisma.session.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    });

    it("ADVERSARIAL: 20 simultaneous concurrent logins strictly serialize to ONE active session", async () => {
      const CONCURRENCY_COUNT = 20;
      const tokens: { raw: string; hash: string }[] = [];

      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        const raw = randomToken(32);
        const hash = hashSecret(APP_SECRET, raw);
        tokens.push({ raw, hash });
      }

      // Fire 20 concurrent session creation requests simultaneously
      const results = await Promise.allSettled(
        tokens.map((t, idx) =>
          createSingleSession({
            userId: testUserId,
            kind: "user",
            tokenHash: t.hash,
            ip: `10.0.0.${idx + 1}`,
            userAgent: `Challenger-Load-Agent/${idx + 1}`,
          }),
        ),
      );

      // Verify that none of the transactions failed with a deadlock or unhandled crash
      for (const res of results) {
        assert.equal(res.status, "fulfilled", "All transactions under FOR UPDATE should serialize cleanly");
      }

      // Query database for all active sessions for this user
      const dbSessions = await prisma.session.findMany({
        where: { userId: testUserId, kind: "user" },
      });

      // STRICT CRITICAL INVARIANT: Exactly 1 session may exist! Dual active sessions cannot coexist!
      assert.equal(
        dbSessions.length,
        1,
        `Expected exactly 1 active session in DB, found ${dbSessions.length}! Dual active sessions detected!`,
      );

      const survivingSession = dbSessions[0];
      const winningToken = tokens.find((t) => t.hash === survivingSession.tokenHash);
      assert.ok(winningToken, "The surviving session must match one of the executed token hashes");

      // Verify userFromCookie with the winning token succeeds
      const validSession = await userFromCookie(winningToken.raw, "user");
      assert.ok(validSession, "Surviving session must be successfully authenticated by userFromCookie");
      assert.equal(validSession.id, survivingSession.id);

      // Verify that all superseded (revoked) tokens return null
      const supersededTokens = tokens.filter((t) => t.hash !== survivingSession.tokenHash);
      assert.equal(supersededTokens.length, CONCURRENCY_COUNT - 1);

      for (const superseded of supersededTokens) {
        const revoked = await userFromCookie(superseded.raw, "user");
        assert.equal(
          revoked,
          null,
          "Revoked session token must return null from userFromCookie (no ghost sessions)",
        );
      }
    });

    it("ADVERSARIAL: sequential login revokes previous active session immediately", async () => {
      const token1 = randomToken(32);
      const hash1 = hashSecret(APP_SECRET, token1);

      const s1 = await createSingleSession({
        userId: testUserId,
        kind: "user",
        tokenHash: hash1,
        ip: "192.168.1.10",
      });
      assert.ok(s1);

      // Confirm session 1 is valid
      const verified1 = await userFromCookie(token1, "user");
      assert.ok(verified1);
      assert.equal(verified1.id, s1.id);

      // Login again from a new device/browser
      const token2 = randomToken(32);
      const hash2 = hashSecret(APP_SECRET, token2);

      const s2 = await createSingleSession({
        userId: testUserId,
        kind: "user",
        tokenHash: hash2,
        ip: "192.168.1.20",
      });
      assert.ok(s2);

      // Old session 1 MUST be revoked immediately
      const revoked1 = await userFromCookie(token1, "user");
      assert.equal(revoked1, null, "First session must be invalid after second login");

      // New session 2 MUST be valid
      const verified2 = await userFromCookie(token2, "user");
      assert.ok(verified2);
      assert.equal(verified2.id, s2.id);

      const totalActive = await prisma.session.count({ where: { userId: testUserId, kind: "user" } });
      assert.equal(totalActive, 1);
    });

    it("ADVERSARIAL: password change immediately revokes all active sessions across all devices", async () => {
      // Setup user with an initial password hash
      const initialPassword = "OldPassword123!";
      const initialHash = await hashPassword(initialPassword);
      await prisma.user.update({
        where: { id: testUserId },
        data: { passwordHash: initialHash },
      });

      // Create an active session
      const activeToken = randomToken(32);
      await createSingleSession({
        userId: testUserId,
        kind: "user",
        tokenHash: hashSecret(APP_SECRET, activeToken),
        ip: "10.0.0.99",
      });

      // Verify session is active before password change
      const sessionBefore = await userFromCookie(activeToken, "user");
      assert.ok(sessionBefore, "Session must be active before password change");

      // Execute password change
      const newPassword = "NewStrongPassword456#";
      await changeUserPassword({
        userId: testUserId,
        currentPasswordRaw: initialPassword,
        newPasswordRaw: newPassword,
      });

      // All sessions MUST be revoked immediately
      const sessionAfter = await userFromCookie(activeToken, "user");
      assert.equal(sessionAfter, null, "Active session MUST be revoked after password change");

      const remainingSessions = await prisma.session.count({ where: { userId: testUserId } });
      assert.equal(remainingSessions, 0, "All sessions must be wiped in DB on password change");
    });

    it("ADVERSARIAL: banned user cannot authenticate via active session token", async () => {
      // Create session for user
      const token = randomToken(32);
      await createSingleSession({
        userId: testUserId,
        kind: "user",
        tokenHash: hashSecret(APP_SECRET, token),
        ip: "10.0.0.50",
      });

      // Confirm authenticated
      const s1 = await userFromCookie(token, "user");
      assert.ok(s1);

      // Ban user
      await prisma.user.update({
        where: { id: testUserId },
        data: { bannedAt: new Date() },
      });

      // Attempt authentication while banned
      const bannedAuth = await userFromCookie(token, "user");
      assert.equal(bannedAuth, null, "Banned user session MUST be rejected immediately");

      // Unban for teardown
      await prisma.user.update({
        where: { id: testUserId },
        data: { bannedAt: null },
      });
    });

    it("ADVERSARIAL: expired session is rejected and lazily purged from database", async () => {
      const expiredToken = randomToken(32);
      const expiredHash = hashSecret(APP_SECRET, expiredToken);

      // Create artificially expired session in the past
      const created = await prisma.session.create({
        data: {
          userId: testUserId,
          kind: "user",
          tokenHash: expiredHash,
          expiresAt: new Date(Date.now() - 10000), // 10 seconds ago
          ip: "127.0.0.1",
        },
      });

      // Attempt authentication with expired token
      const authResult = await userFromCookie(expiredToken, "user");
      assert.equal(authResult, null, "Expired session must return null");

      // Wait 100ms for lazy delete promise to settle
      await new Promise((resolve) => setTimeout(resolve, 150));

      const inDb = await prisma.session.findUnique({ where: { id: created.id } });
      assert.equal(inDb, null, "Expired session must be lazily deleted from database");
    });
  });

  // =========================================================================
  // CHALLENGE 3: Strict Admin Session Isolation
  // =========================================================================
  describe("Challenge 3: Strict Admin Session Isolation & BFF Sanitization", () => {
    const customerUserId = `cust-isolation-${Date.now()}`;
    const adminUserId = `admin-isolation-${Date.now()}`;
    let customerToken: string;
    let adminToken: string;
    let app: ReturnType<typeof Fastify>;

    before(async () => {
      // Create regular customer user
      await prisma.user.create({
        data: {
          id: customerUserId,
          email: `customer-${Date.now()}@gmail.com`,
          role: "user",
        },
      });

      // Create admin user
      await prisma.user.create({
        data: {
          id: adminUserId,
          email: `admin-${Date.now()}@admin.local`,
          role: "admin",
        },
      });

      // Create customer session (kind: "user")
      customerToken = randomToken(32);
      await createSingleSession({
        userId: customerUserId,
        kind: "user",
        tokenHash: hashSecret(APP_SECRET, customerToken),
        ip: "127.0.0.1",
      });

      // Create admin session (kind: "admin")
      adminToken = randomToken(32);
      await createSingleSession({
        userId: adminUserId,
        kind: "admin",
        tokenHash: hashSecret(APP_SECRET, adminToken),
        ip: "127.0.0.1",
      });

      // Setup Fastify app with admin routes
      app = Fastify();
      await app.register(cookie);
      await registerAdminRoutes(app, { storage: null as any, redis });
      await app.ready();
    });

    after(async () => {
      await app.close();
      await prisma.session.deleteMany({ where: { userId: { in: [customerUserId, adminUserId] } } });
      await prisma.user.deleteMany({ where: { id: { in: [customerUserId, adminUserId] } } }).catch(() => {});
    });

    it("userFromCookie rejects customer token when kind='admin'", async () => {
      // Customer token evaluated as admin must be rejected
      const attemptAsAdmin = await userFromCookie(customerToken, "admin");
      assert.equal(attemptAsAdmin, null, "Customer token cannot authenticate as admin");

      // Admin token evaluated as admin must succeed
      const validAdmin = await userFromCookie(adminToken, "admin");
      assert.ok(validAdmin, "Admin token must authenticate as admin");
      assert.equal(validAdmin.user.role, "admin");

      // Admin token evaluated as user must be rejected
      const attemptAsUser = await userFromCookie(adminToken, "user");
      assert.equal(attemptAsUser, null, "Admin session cannot authenticate as user");
    });

    it("ADVERSARIAL: GET /admin/me rejects requests without admin credentials (401)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
      });
      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.error?.code, ErrorCodes.UNAUTHENTICATED);
    });

    it("ADVERSARIAL: GET /admin/me rejects customer cookie sid=<customer_token> (401)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
        headers: {
          cookie: `sid=${customerToken}`,
        },
      });
      assert.equal(res.statusCode, 401, "Customer cookie 'sid' must be ignored on admin route");
      const body = JSON.parse(res.payload);
      assert.equal(body.error?.code, ErrorCodes.UNAUTHENTICATED);
    });

    it("ADVERSARIAL: GET /admin/me rejects forged sid_admin=<customer_token> (401)", async () => {
      // Attacker attempts privilege escalation by putting customer token into sid_admin cookie
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
        headers: {
          cookie: `sid_admin=${customerToken}`,
        },
      });
      assert.equal(res.statusCode, 401, "Forged sid_admin with customer token must be rejected (session.kind mismatch)");
      const body = JSON.parse(res.payload);
      assert.equal(body.error?.code, ErrorCodes.UNAUTHENTICATED);
    });

    it("ADVERSARIAL: GET /admin/me rejects customer token in x-session-token header (401)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
        headers: {
          "x-session-token": customerToken,
        },
      });
      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.error?.code, ErrorCodes.UNAUTHENTICATED);
    });

    it("ADVERSARIAL: GET /admin/me rejects customer token in Authorization Bearer header (401)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
        headers: {
          authorization: `Bearer ${customerToken}`,
        },
      });
      assert.equal(res.statusCode, 401);
      const body = JSON.parse(res.payload);
      assert.equal(body.error?.code, ErrorCodes.UNAUTHENTICATED);
    });

    it("GET /admin/me accepts valid admin session cookie sid_admin (200)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/admin/me",
        headers: {
          cookie: `sid_admin=${adminToken}`,
        },
      });
      assert.equal(res.statusCode, 200);
      const body = JSON.parse(res.payload);
      assert.equal(body.user.id, adminUserId);
      assert.equal(body.user.role, "admin");
    });

    it("BFF cookie sanitization strips untrusted client-supplied sid and sid_admin", () => {
      // Test basic stripping
      assert.equal(
        sanitizeCookie("sid=attack1; other=value123"),
        "other=value123",
      );
      assert.equal(
        sanitizeCookie("sid_admin=attack2; theme=dark"),
        "theme=dark",
      );
      assert.equal(
        sanitizeCookie("sid=attack1; sid_admin=attack2; token=abc"),
        "token=abc",
      );

      // Case-insensitivity check
      assert.equal(
        sanitizeCookie("SID=bad1; SID_ADMIN=bad2"),
        "",
      );

      // Non-target cookies preserved
      assert.equal(
        sanitizeCookie("my_sid=ok; session_id=ok2; sid_cookie=ok3"),
        "my_sid=ok; session_id=ok2; sid_cookie=ok3",
      );

      // mergeCookie strips client sid and injects trusted cookie
      const merged = mergeCookie("sid=forged_token; pref=1", `sid=trusted_token`);
      assert.equal(merged, "pref=1; sid=trusted_token");
    });
  });

  // =========================================================================
  // CHALLENGE 4: Atomic Rate Limiting Under Concurrency & TTL Preservation
  // =========================================================================
  describe("Challenge 4: Atomic Rate Limiting & Concurrency Stress", () => {
    it("ADVERSARIAL: 50 concurrent requests serialize atomically with zero lost increments", async () => {
      const testKey = `test:rl:adversarial:burst:${randomBytes(8).toString("hex")}`;
      const rule: RateLimitRule = {
        windowSeconds: 60,
        maxAttempts: 5,
        lockoutSeconds: 120,
        message: "Terlalu banyak permintaan.",
      };

      try {
        // Send 50 simultaneous requests against live Redis
        const results = await Promise.all(
          Array.from({ length: 50 }).map(() => enforceRateLimit(redis, testKey, rule)),
        );

        // Verification 1: Exactly 5 requests allowed
        const allowedCount = results.filter((r) => r.allowed).length;
        const rejectedCount = results.filter((r) => !r.allowed).length;
        assert.equal(allowedCount, 5, `Expected exactly 5 allowed requests, got ${allowedCount}`);
        assert.equal(rejectedCount, 45, `Expected exactly 45 rejected requests, got ${rejectedCount}`);

        // Verification 2: Counter values are strictly 1..50 with zero duplicate or skipped values
        const attempts = results.map((r) => r.currentAttempts).sort((a, b) => a - b);
        for (let i = 0; i < 50; i++) {
          assert.equal(attempts[i], i + 1, `Expected attempt ${i + 1}, got ${attempts[i]}`);
        }

        // Verification 3: Key in Redis has exact count 50
        const finalValue = await redis.get(testKey);
        assert.equal(Number(finalValue), 50, "Final counter in Redis must equal 50 (no lost updates)");

        // Verification 4: Key has valid lockout TTL
        const ttl = await redis.ttl(testKey);
        assert.ok(ttl > 0 && ttl <= 120, `TTL must be within lockout range (0, 120], got ${ttl}`);
      } finally {
        await redis.del(testKey);
      }
    });

    it("ADVERSARIAL: sliding/fixed window TTL is preserved and not reset by non-exceeded requests", async () => {
      const testKey = `test:rl:adversarial:ttl:${randomBytes(8).toString("hex")}`;
      const rule: RateLimitRule = {
        windowSeconds: 60,
        maxAttempts: 10,
        lockoutSeconds: 120,
        message: "Rate limit.",
      };

      try {
        // Request 1: initializes key and sets TTL to 60
        const r1 = await enforceRateLimit(redis, testKey, rule);
        assert.equal(r1.currentAttempts, 1);
        assert.ok(r1.retryAfterSeconds <= 60 && r1.retryAfterSeconds >= 59);

        // Wait 1.5 seconds
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Request 2: should NOT reset TTL back to 60
        const r2 = await enforceRateLimit(redis, testKey, rule);
        assert.equal(r2.currentAttempts, 2);
        // TTL should have decremented to ~58
        assert.ok(
          r2.retryAfterSeconds <= 59 && r2.retryAfterSeconds >= 57,
          `TTL should not reset to 60 on subsequent requests. Got ${r2.retryAfterSeconds}`,
        );
      } finally {
        await redis.del(testKey);
      }
    });
  });
});
