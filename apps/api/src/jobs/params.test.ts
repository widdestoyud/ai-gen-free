import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { parseGenerateParams } from "./params.js";

test("defaults aspectRatio 1:1 and drops unknown keys", () => {
  assert.deepEqual(parseGenerateParams({ foo: 1, cost: 999 }, "siray"), { aspectRatio: "1:1" });
});

test("keeps whitelist aspectRatio", () => {
  assert.deepEqual(parseGenerateParams({ aspectRatio: "16:9" }, "siray"), { aspectRatio: "16:9" });
});

test("rejects unknown aspectRatio", () => {
  assert.throws(
    () => parseGenerateParams({ aspectRatio: "21:9" }, "siray"),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("params.fail ignored unless dummy", () => {
  assert.deepEqual(parseGenerateParams({ fail: true }, "siray"), { aspectRatio: "1:1" });
  assert.deepEqual(parseGenerateParams({ fail: true }, "dummy"), { aspectRatio: "1:1", fail: true });
});
