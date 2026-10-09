import test from "node:test";
import assert from "node:assert/strict";
import { middleware } from "./middleware";
import { NextRequest } from "next/server";

// Extract safeCompare implementation exactly as defined in middleware.ts
// to enable high-volume fuzzing and timing benchmark
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

test("safeCompare: returns true for strictly identical strings", () => {
  assert.equal(safeCompare("", ""), true);
  assert.equal(safeCompare("a", "a"), true);
  assert.equal(safeCompare("admin", "admin"), true);
  assert.equal(safeCompare("P@ssw0rd!#$123", "P@ssw0rd!#$123"), true);
  assert.equal(safeCompare("long_secret_token_".repeat(50), "long_secret_token_".repeat(50)), true);
});

test("safeCompare: returns false for differing lengths without RangeError", () => {
  assert.equal(safeCompare("", "a"), false);
  assert.equal(safeCompare("a", ""), false);
  assert.equal(safeCompare("admin", "admin1"), false);
  assert.equal(safeCompare("admin1", "admin"), false);
  assert.equal(safeCompare("short", "a".repeat(1000)), false);
  assert.equal(safeCompare("a".repeat(1000), "short"), false);
  assert.equal(safeCompare("a".repeat(5000), "a".repeat(5001)), false);
});

test("safeCompare: handles null bytes and control characters without error or false match", () => {
  assert.equal(safeCompare("test\0", "test\0"), true);
  assert.equal(safeCompare("test\0a", "test\0b"), false);
  assert.equal(safeCompare("test\0", "test"), false);
  assert.equal(safeCompare("test", "test\0"), false);
  assert.equal(safeCompare("\x00\x01\x02", "\x00\x01\x02"), true);
  assert.equal(safeCompare("\r\n\t", "\r\n\t"), true);
  assert.equal(safeCompare("\r\n\t", "\n\r\t"), false);
});

test("safeCompare: handles multi-byte unicode, emojis, and surrogate pairs", () => {
  assert.equal(safeCompare("🔒secure", "🔒secure"), true);
  assert.equal(safeCompare("🚀rocket🔥fire", "🚀rocket🔥fire"), true);
  assert.equal(safeCompare("🚀rocket🔥fire", "🚀rocket💧fire"), false);
  assert.equal(safeCompare("ユーザー名", "ユーザー名"), true);
  assert.equal(safeCompare("مرحبا", "مرحبا"), true);
  assert.equal(safeCompare("مرحبا", "مرحب"), false);
});

test("safeCompare: rejects non-string inputs safely without throwing", () => {
  assert.equal(safeCompare(null as any, "admin"), false);
  assert.equal(safeCompare("admin", null as any), false);
  assert.equal(safeCompare(undefined as any, undefined as any), false);
  assert.equal(safeCompare(123 as any, 123 as any), false);
  assert.equal(safeCompare({} as any, "admin"), false);
  assert.equal(safeCompare([] as any, [] as any), false);
  assert.equal(safeCompare(Buffer.from("admin") as any, "admin"), false);
});

test("safeCompare: fuzzing across 10,000 random string pairs", () => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`\0\r\n";
  function randomStr(len: number) {
    let s = "";
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    return s;
  }

  for (let iter = 0; iter < 10000; iter++) {
    const lenA = Math.floor(Math.random() * 64);
    const lenB = Math.random() > 0.5 ? lenA : Math.floor(Math.random() * 64);
    const strA = randomStr(lenA);
    const strB = lenA === lenB && Math.random() > 0.5 ? strA : randomStr(lenB);

    const expected = strA === strB;
    const actual = safeCompare(strA, strB);
    assert.equal(actual, expected, `Mismatch for iteration ${iter}: '${strA}' vs '${strB}'`);
  }
});

test("safeCompare: timing side-channel verification (no early-exit on first character mismatch)", () => {
  const base = "A".repeat(256);
  const mismatchFirst = "B" + "A".repeat(255);
  const mismatchMid = "A".repeat(128) + "B" + "A".repeat(127);
  const mismatchLast = "A".repeat(255) + "B";
  const matchFull = "A".repeat(256);

  // Warm up JIT
  for (let i = 0; i < 5000; i++) {
    safeCompare(base, mismatchFirst);
    safeCompare(base, mismatchMid);
    safeCompare(base, mismatchLast);
    safeCompare(base, matchFull);
  }

  const iterations = 50000;

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    safeCompare(base, mismatchFirst);
  }
  const t1 = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    safeCompare(base, mismatchLast);
  }
  const t2 = process.hrtime.bigint();

  const durFirstNs = Number(t1 - t0);
  const durLastNs = Number(t2 - t1);

  // In an early-return comparison (like str1 === str2), mismatchFirst would be ~250x faster than mismatchLast.
  // In a constant-time comparison, both loop through all 256 iterations, so ratio should be close to 1.0 (< 2.5x variance).
  const ratio = Math.max(durFirstNs, durLastNs) / Math.min(durFirstNs, durLastNs);
  assert.ok(
    ratio < 2.5,
    `Timing variance between first and last mismatch is too large (ratio: ${ratio.toFixed(2)}x, first: ${durFirstNs}ns, last: ${durLastNs}ns)`
  );
});

test("middleware: rejects unauthenticated requests to protected admin routes", () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "secret_password_123";

  const reqNoAuth = new NextRequest("http://localhost:3000/admin");
  const resNoAuth = middleware(reqNoAuth);
  assert.equal(resNoAuth.status, 401);
  assert.equal(resNoAuth.headers.get("www-authenticate"), 'Basic realm="admin"');

  const reqBearer = new NextRequest("http://localhost:3000/api/admin/users", {
    headers: { authorization: "Bearer some_jwt_token" },
  });
  const resBearer = middleware(reqBearer);
  assert.equal(resBearer.status, 401);
});

test("middleware: rejects invalid credentials and malformed headers", () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "secret_password_123";

  // Invalid base64
  const reqBadB64 = new NextRequest("http://localhost:3000/admin", {
    headers: { authorization: "Basic !!!invalid_base64!!!" },
  });
  assert.equal(middleware(reqBadB64).status, 401);

  // Missing colon
  const reqNoColon = new NextRequest("http://localhost:3000/admin", {
    headers: { authorization: `Basic ${btoa("adminpassword")}` },
  });
  assert.equal(middleware(reqNoColon).status, 401);

  // Wrong username
  const reqWrongUser = new NextRequest("http://localhost:3000/admin", {
    headers: { authorization: `Basic ${btoa("wronguser:secret_password_123")}` },
  });
  assert.equal(middleware(reqWrongUser).status, 401);

  // Wrong password
  const reqWrongPass = new NextRequest("http://localhost:3000/admin", {
    headers: { authorization: `Basic ${btoa("admin:wrongpassword")}` },
  });
  assert.equal(middleware(reqWrongPass).status, 401);
});

test("middleware: allows valid admin credentials", () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "secret_password_123";

  const reqValid = new NextRequest("http://localhost:3000/admin", {
    headers: { authorization: `Basic ${btoa("admin:secret_password_123")}` },
  });
  const resValid = middleware(reqValid);
  // Next.js NextResponse.next() returns a response with status 200 or x-middleware-next header
  assert.ok(resValid.status === 200 || resValid.headers.has("x-middleware-next"));
});

test("middleware: rejects when environment credentials are unset", () => {
  const origUser = process.env.ADMIN_BASIC_USER;
  const origPass = process.env.ADMIN_BASIC_PASSWORD;
  delete process.env.ADMIN_BASIC_USER;
  delete process.env.ADMIN_BASIC_PASSWORD;

  try {
    const req = new NextRequest("http://localhost:3000/admin", {
      headers: { authorization: `Basic ${btoa("admin:secret")}` },
    });
    assert.equal(middleware(req).status, 401);
  } finally {
    process.env.ADMIN_BASIC_USER = origUser;
    process.env.ADMIN_BASIC_PASSWORD = origPass;
  }
});
