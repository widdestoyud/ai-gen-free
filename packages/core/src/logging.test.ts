import assert from "node:assert/strict";
import { test } from "node:test";
import { formatStructuredLog, redactSensitiveData } from "./logging.js";

test("redactSensitiveData redacts password, token, and otp keys", () => {
  const input = {
    email: "user@gmail.com",
    password: "SecretPassword123",
    otp: "123456",
    nested: {
      token: "secret-token-abc",
      safeKey: "safeValue",
    },
  };

  const output = redactSensitiveData(input) as Record<string, any>;
  assert.equal(output.email, "user@gmail.com");
  assert.equal(output.password, "[REDACTED]");
  assert.equal(output.otp, "[REDACTED]");
  assert.equal(output.nested.token, "[REDACTED]");
  assert.equal(output.nested.safeKey, "safeValue");
});

test("redactSensitiveData redacts huge base64 data URLs", () => {
  const largeBase64 = "data:image/png;base64," + "A".repeat(5000);
  const input = { image: largeBase64 };
  const output = redactSensitiveData(input) as Record<string, string>;
  assert.match(output.image, /^\[redacted_base64 length=5022 mime=image\/png\]$/);
});

test("formatStructuredLog produces valid NDJSON with correlation IDs", () => {
  const logStr = formatStructuredLog({
    level: "error",
    service: "worker",
    event: "job.failed",
    message: "Siray call failed",
    transactionId: "tx-test-1234",
    userId: "usr-4567",
    jobId: "job-8901",
    httpMethod: "POST",
    httpPath: "/v1/video/generations",
    httpStatus: 400,
    error: {
      password: "secret",
      code: "W002",
    },
  });

  const parsed = JSON.parse(logStr);
  assert.equal(parsed.level, "error");
  assert.equal(parsed.service, "worker");
  assert.equal(parsed.event, "job.failed");
  assert.equal(parsed.transaction_id, "tx-test-1234");
  assert.equal(parsed.user_id, "usr-4567");
  assert.equal(parsed.job_id, "job-8901");
  assert.equal(parsed.http.method, "POST");
  assert.equal(parsed.http.status_code, 400);
  assert.equal(parsed.error.password, "[REDACTED]");
  assert.equal(parsed.error.code, "W002");
});
