import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedEmailDomain } from "./email.js";
import { validatePassword, hashPassword, verifyPassword } from "./password.js";

test("isAllowedEmailDomain allows gmail, yahoo, and ymail only", () => {
  assert.equal(isAllowedEmailDomain("user@gmail.com"), true);
  assert.equal(isAllowedEmailDomain("user@googlemail.com"), true);
  assert.equal(isAllowedEmailDomain("user@yahoo.com"), true);
  assert.equal(isAllowedEmailDomain("user@yahoo.co.id"), true);
  assert.equal(isAllowedEmailDomain("user@ymail.com"), true);

  // Rejects fake, test, disposable or generic emails
  assert.equal(isAllowedEmailDomain("test@example.com"), false);
  assert.equal(isAllowedEmailDomain("admin@corp.id"), false);
  assert.equal(isAllowedEmailDomain("tester@tempmail.com"), false);
  assert.equal(isAllowedEmailDomain("fake@fakemail.org"), false);
  assert.equal(isAllowedEmailDomain("invalid-email"), false);
});

test("validatePassword enforces min 8 chars, 1 uppercase, 1 digit", () => {
  assert.equal(validatePassword("short1A").valid, false); // < 8
  assert.equal(validatePassword("alllowercase123").valid, false); // no uppercase
  assert.equal(validatePassword("ALLUPPERCASE").valid, false); // no digit
  assert.equal(validatePassword("ValidPass1").valid, true);
  assert.equal(validatePassword("MyStrongP@ss99").valid, true);
});

test("hashPassword and verifyPassword work correctly with scrypt", async () => {
  const plain = "SuperSecret123!";
  const hash = await hashPassword(plain);
  assert.ok(hash.includes(":"));

  const matched = await verifyPassword(plain, hash);
  assert.equal(matched, true);

  const mismatched = await verifyPassword("WrongPassword1!", hash);
  assert.equal(mismatched, false);
});
