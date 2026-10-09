import test from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqual, createHash } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

function verifyAdminBasicAuth(
  header: string | null | undefined,
  adminUserEnv: string | undefined,
  adminPassEnv: string | undefined,
): { ok: boolean; status: number; message?: string } {
  const user = adminUserEnv ?? "";
  const pass = adminPassEnv ?? "";

  if (!header?.startsWith("Basic ")) {
    return { ok: false, status: 401, message: "Autentikasi admin diperlukan" };
  }

  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  } catch {
    decoded = "";
  }

  const i = decoded.indexOf(":");
  const u = i >= 0 ? decoded.slice(0, i) : "";
  const p = i >= 0 ? decoded.slice(i + 1) : "";

  if (!user || !pass) {
    return { ok: false, status: 401, message: "Autentikasi admin gagal" };
  }

  const userValid = safeCompare(u, user);
  const passValid = safeCompare(p, pass);

  if (!userValid || !passValid) {
    return { ok: false, status: 401, message: "Autentikasi admin gagal" };
  }

  return { ok: true, status: 200 };
}

test("safeCompare: returns true for identical strings", () => {
  assert.equal(safeCompare("admin", "admin"), true);
  assert.equal(safeCompare("secret-token-123", "secret-token-123"), true);
  assert.equal(safeCompare("", ""), true);
});

test("safeCompare: returns false for differing strings without throwing RangeError", () => {
  assert.equal(safeCompare("a", "b"), false);
  assert.equal(safeCompare("admin", "admin1"), false);
  assert.equal(safeCompare("short", "very-very-long-password-string-that-has-different-byte-length"), false);
  assert.equal(safeCompare("", "nonempty"), false);
});

test("verifyAdminBasicAuth: rejects missing or non-Basic authorization header", () => {
  const res1 = verifyAdminBasicAuth(null, "admin", "secret");
  assert.equal(res1.ok, false);
  assert.equal(res1.status, 401);
  assert.equal(res1.message, "Autentikasi admin diperlukan");

  const res2 = verifyAdminBasicAuth("Bearer token123", "admin", "secret");
  assert.equal(res2.ok, false);
  assert.equal(res2.status, 401);
  assert.equal(res2.message, "Autentikasi admin diperlukan");
});

test("verifyAdminBasicAuth: rejects when env credentials are not set", () => {
  const creds = Buffer.from("admin:secret").toString("base64");
  const res = verifyAdminBasicAuth(`Basic ${creds}`, "", "");
  assert.equal(res.ok, false);
  assert.equal(res.status, 401);
  assert.equal(res.message, "Autentikasi admin gagal");
});

test("verifyAdminBasicAuth: rejects invalid username or password in constant time", () => {
  const wrongUserCreds = Buffer.from("wronguser:secret").toString("base64");
  const res1 = verifyAdminBasicAuth(`Basic ${wrongUserCreds}`, "admin", "secret");
  assert.equal(res1.ok, false);
  assert.equal(res1.status, 401);
  assert.equal(res1.message, "Autentikasi admin gagal");

  const wrongPassCreds = Buffer.from("admin:wrongpass").toString("base64");
  const res2 = verifyAdminBasicAuth(`Basic ${wrongPassCreds}`, "admin", "secret");
  assert.equal(res2.ok, false);
  assert.equal(res2.status, 401);
  assert.equal(res2.message, "Autentikasi admin gagal");
});

test("verifyAdminBasicAuth: accepts correct credentials", () => {
  const validCreds = Buffer.from("admin:secret").toString("base64");
  const res = verifyAdminBasicAuth(`Basic ${validCreds}`, "admin", "secret");
  assert.equal(res.ok, true);
  assert.equal(res.status, 200);
});
