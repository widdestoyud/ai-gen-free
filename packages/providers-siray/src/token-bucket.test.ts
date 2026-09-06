import assert from "node:assert/strict";
import { test } from "node:test";
import { TokenBucket } from "./token-bucket.js";

test("burst 3 then empty until refill", () => {
  let now = 1_000_000;
  const bucket = new TokenBucket({ ratePerSec: 1, burst: 3, now: () => now });
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), false);
  now += 1000;
  assert.equal(bucket.take(), true);
  assert.equal(bucket.take(), false);
});
