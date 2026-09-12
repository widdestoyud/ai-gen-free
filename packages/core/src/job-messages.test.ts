import assert from "node:assert/strict";
import { test } from "node:test";
import { jobClientErrorMessage } from "./job-messages.js";

test("W002 is content policy copy for the client, not HTTP 4xx", () => {
  const msg = jobClientErrorMessage("W002");
  assert.ok(msg);
  assert.match(msg, /kebijakan konten/i);
  assert.match(msg, /Poin dikembalikan/i);
});

test("null code has no client message", () => {
  assert.equal(jobClientErrorMessage(null), null);
});
