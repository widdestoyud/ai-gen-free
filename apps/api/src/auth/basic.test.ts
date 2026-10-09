import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBasicAuth, basicAuthorized } from "./basic.js";

test("parseBasicAuth parses valid Basic header", () => {
  const credentials = Buffer.from("admin:secret123").toString("base64");
  const parsed = parseBasicAuth(`Basic ${credentials}`);
  assert.deepEqual(parsed, { user: "admin", pass: "secret123" });
});

test("parseBasicAuth handles invalid headers gracefully", () => {
  assert.equal(parseBasicAuth(undefined), null);
  assert.equal(parseBasicAuth(""), null);
  assert.equal(parseBasicAuth("Bearer token123"), null);
  assert.equal(parseBasicAuth("Basic invalid-base64-no-colon"), null);
});

test("basicAuthorized validates matching credentials", () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "change-me";

  const validHeader = `Basic ${Buffer.from("admin:change-me").toString("base64")}`;
  assert.equal(basicAuthorized(validHeader), true);

  const invalidPass = `Basic ${Buffer.from("admin:wrong").toString("base64")}`;
  assert.equal(basicAuthorized(invalidPass), false);

  const invalidUser = `Basic ${Buffer.from("hacker:change-me").toString("base64")}`;
  assert.equal(basicAuthorized(invalidUser), false);

  assert.equal(basicAuthorized(undefined), false);
});
