import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import {
  asCooldownSeconds,
  GENERATE_COOLDOWN_DEFAULT,
  parseAdjustBody,
  parseCooldownSecondsValue,
  parseIdempotencyKey,
  parseJobStatus,
  parseLimitOffset,
} from "./parse.js";

function isValidation(err: unknown): boolean {
  return err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR;
}

test("parseLimitOffset defaults and caps", () => {
  assert.deepEqual(parseLimitOffset({}), { limit: 50, offset: 0 });
  assert.deepEqual(parseLimitOffset({ limit: "10", offset: "2" }), { limit: 10, offset: 2 });
  assert.throws(() => parseLimitOffset({ limit: 101 }), isValidation);
  assert.throws(() => parseLimitOffset({ offset: -1 }), isValidation);
});

test("parseCooldownSecondsValue rejects string and out of range", () => {
  assert.equal(parseCooldownSecondsValue(3600), 3600);
  assert.equal(parseCooldownSecondsValue(0), 0);
  assert.throws(() => parseCooldownSecondsValue("3600"), isValidation);
  assert.throws(() => parseCooldownSecondsValue(2_592_001), isValidation);
  assert.throws(() => parseCooldownSecondsValue(-1), isValidation);
  assert.throws(() => parseCooldownSecondsValue(1.5), isValidation);
});

test("asCooldownSeconds falls back to seed 43200", () => {
  assert.equal(asCooldownSeconds(undefined), GENERATE_COOLDOWN_DEFAULT);
  assert.equal(asCooldownSeconds(null), GENERATE_COOLDOWN_DEFAULT);
  assert.equal(asCooldownSeconds(0), 0);
  assert.equal(asCooldownSeconds(3600), 3600);
});

test("parseAdjustBody requires integer amount and reason", () => {
  assert.deepEqual(parseAdjustBody({ amount: 50, reason: "  koreksi topup ganda  " }), {
    amount: 50,
    reason: "koreksi topup ganda",
  });
  assert.throws(() => parseAdjustBody({ amount: 0, reason: "koreksi topup ganda" }), isValidation);
  assert.throws(() => parseAdjustBody({ amount: 50, reason: "ab" }), isValidation);
  assert.throws(() => parseAdjustBody({ amount: 50.5, reason: "koreksi topup ganda" }), isValidation);
  assert.throws(() => parseAdjustBody({ amount: "50", reason: "koreksi topup ganda" }), isValidation);
});

test("parseIdempotencyKey 8–128", () => {
  assert.equal(parseIdempotencyKey("abcd1234"), "abcd1234");
  assert.throws(() => parseIdempotencyKey("short"), isValidation);
  assert.throws(() => parseIdempotencyKey(undefined), isValidation);
});

test("parseJobStatus optional enum", () => {
  assert.equal(parseJobStatus(undefined), undefined);
  assert.equal(parseJobStatus("succeeded"), "succeeded");
  assert.throws(() => parseJobStatus("delayed"), isValidation);
});
