import assert from "node:assert/strict";
import { test } from "node:test";
import { adjustIdempotencyKey } from "./ledger.js";

test("adjust idempotency key is adjust:{userId}:{clientKey}", () => {
  assert.equal(adjustIdempotencyKey("cluser1", "abc12345"), "adjust:cluser1:abc12345");
});
