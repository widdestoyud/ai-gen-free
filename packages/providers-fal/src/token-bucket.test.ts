import { test } from "node:test";
import assert from "node:assert/strict";
import { TokenBucket } from "./token-bucket.js";

test("TokenBucket allows burst and enforces limits", () => {
  const bucket = new TokenBucket(3, 1);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), false);
});
