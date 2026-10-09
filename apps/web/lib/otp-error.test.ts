import test from "node:test";
import assert from "node:assert/strict";
import { parseAuthBridgeError } from "./otp-error.js";

test("parseAuthBridgeError handles standard OTP error codes", () => {
  const err = "A002||Kode salah||tx-12345||";
  const parsed = parseAuthBridgeError(err);
  assert.equal(parsed.code, "A002");
  assert.equal(parsed.message, "Kode salah");
  assert.equal(parsed.transaction_id, "tx-12345");
  assert.equal(parsed.requiresOtp, false);
});

test("parseAuthBridgeError handles OTP required flag", () => {
  const err = "A016||Kode OTP diperlukan||tx-999||OTP_REQUIRED";
  const parsed = parseAuthBridgeError(err);
  assert.equal(parsed.code, "A016");
  assert.equal(parsed.message, "Kode OTP diperlukan");
  assert.equal(parsed.transaction_id, "tx-999");
  assert.equal(parsed.requiresOtp, true);
});

test("parseAuthBridgeError masks internal database and Prisma errors with E001", () => {
  const dbError = `E002||\nInvalid \`prisma.user.findUnique()\` invocation in\n/app/apps/api/src/auth/service.ts:72:34\nError querying the database: FATAL: (ECIRCUITBREAKER) too many authentication failures||tx-muw0wyrv-7c70c0bc`;
  const parsed = parseAuthBridgeError(dbError);
  assert.equal(parsed.code, "E001");
  assert.equal(parsed.message, "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.");
  assert.equal(parsed.transaction_id, "tx-muw0wyrv-7c70c0bc");
});

test("parseAuthBridgeError masks raw Error instance with database message", () => {
  const rawErr = new Error("FATAL: connection pool exhausted from postgres database");
  const parsed = parseAuthBridgeError(rawErr);
  assert.equal(parsed.code, "E001");
  assert.equal(parsed.message, "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.");
});
