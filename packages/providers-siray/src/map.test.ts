import assert from "node:assert/strict";
import { test } from "node:test";
import { JobErrorCodes } from "@ai-gen-free/core";
import {
  classifySirayFailure,
  classifySirayHttpStatus,
  isPolicyFailCode,
  mapSirayStatus,
  parseSirayProgress,
} from "./map.js";

test("maps Siray lifecycle to port states", () => {
  assert.equal(mapSirayStatus("NOT_START"), "queued");
  assert.equal(mapSirayStatus("SUBMITTED"), "queued");
  assert.equal(mapSirayStatus("QUEUED"), "queued");
  assert.equal(mapSirayStatus("IN_PROGRESS"), "running");
  assert.equal(mapSirayStatus("SUCCESS"), "succeeded");
  assert.equal(mapSirayStatus("FAILURE"), "failed");
  assert.equal(mapSirayStatus("nope"), null);
});

test("parses progress percent strings", () => {
  assert.equal(parseSirayProgress("50%"), 50);
  assert.equal(parseSirayProgress(100), 100);
  assert.equal(parseSirayProgress("x"), undefined);
});

test("policy fail codes vs other 4xx", () => {
  assert.equal(isPolicyFailCode("SensitiveContentDetected"), true);
  assert.equal(isPolicyFailCode("ImageSensitiveContentDetected"), true);
  assert.equal(isPolicyFailCode("InvalidParameter"), true);
  assert.equal(isPolicyFailCode("ContentPolicyViolation"), true);
  assert.equal(isPolicyFailCode("AccountOverdue"), false);
  assert.equal(classifySirayFailure("SensitiveContentDetected"), JobErrorCodes.PROVIDER_POLICY);
  assert.equal(classifySirayFailure("ModelNotFound"), JobErrorCodes.PROVIDER_ERROR);
});

test("HTTP classification: auth terminal, 429 retryable", () => {
  assert.deepEqual(classifySirayHttpStatus(401), {
    retryable: false,
    errorCode: JobErrorCodes.PROVIDER_NOT_CONFIGURED,
  });
  assert.deepEqual(classifySirayHttpStatus(429), {
    retryable: true,
    errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE,
  });
  assert.deepEqual(classifySirayHttpStatus(503), {
    retryable: true,
    errorCode: JobErrorCodes.PROVIDER_UNAVAILABLE,
  });
  assert.deepEqual(classifySirayHttpStatus(400, "SensitiveContentDetected"), {
    retryable: false,
    errorCode: JobErrorCodes.PROVIDER_POLICY,
  });
});
