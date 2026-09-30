import { test } from "node:test";
import assert from "node:assert/strict";
import { JobErrorCodes } from "@ai-gen-free/core";
import { mapFalStatus, parseFalProgress, isFalPolicyViolation, classifyFalHttpStatus } from "./map.js";

test("mapFalStatus maps queue lifecycle states", () => {
  assert.equal(mapFalStatus("IN_QUEUE"), "queued");
  assert.equal(mapFalStatus("IN_PROGRESS"), "running");
  assert.equal(mapFalStatus("COMPLETED"), "succeeded");
  assert.equal(mapFalStatus("FAILED"), "failed");
  assert.equal(mapFalStatus("UNKNOWN"), null);
});

test("parseFalProgress parses numeric and string percentages", () => {
  assert.equal(parseFalProgress(45), 45);
  assert.equal(parseFalProgress("75%"), 75);
  assert.equal(parseFalProgress("invalid"), undefined);
});

test("isFalPolicyViolation detects content policy failures", () => {
  assert.equal(isFalPolicyViolation("NSFW content detected"), true);
  assert.equal(isFalPolicyViolation("safety filter triggered"), true);
  assert.equal(
    isFalPolicyViolation([
      {
        loc: ["body"],
        msg: "The content could not be processed because it contained material flagged by a content checker.",
        type: "content_policy_violation",
      },
    ]),
    true,
  );
  assert.equal(isFalPolicyViolation("regular error"), false);
});

test("classifyFalHttpStatus categorizes status codes correctly", () => {
  assert.deepEqual(classifyFalHttpStatus(401), { retryable: false, errorCode: JobErrorCodes.PROVIDER_NOT_CONFIGURED });
  assert.deepEqual(classifyFalHttpStatus(429), { retryable: true, errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE });
  assert.deepEqual(classifyFalHttpStatus(500), { retryable: true, errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE });
  assert.deepEqual(classifyFalHttpStatus(422, "nsfw image"), { retryable: false, errorCode: JobErrorCodes.PROVIDER_POLICY });
  assert.deepEqual(classifyFalHttpStatus(400, "invalid size"), { retryable: false, errorCode: JobErrorCodes.PROVIDER_ERROR });
});
