import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { resolveSirayGenerateSlug, sirayGenerateParamsFromBody } from "./siray-generate.js";

test("known slugs map to catalog modelIds", () => {
  assert.equal(resolveSirayGenerateSlug("gpt-image-2-t2i").modelId, "openai/gpt-image-2-t2i");
  assert.equal(
    resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy").modelId,
    "bytedance/seedream-5.0-pro-t2i-spicy",
  );
  assert.equal(resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy").defaultParams.size, "1024x1024");
});

test("unknown slug is VALIDATION_ERROR", () => {
  assert.throws(
    () => resolveSirayGenerateSlug("not-a-model"),
    (err: unknown) => err instanceof AppError && err.code === ErrorCodes.VALIDATION_ERROR,
  );
});

test("body size overrides seedream default", () => {
  const { defaultParams } = resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy");
  const params = sirayGenerateParamsFromBody({ prompt: "x", size: "2048x2048" }, defaultParams);
  assert.equal(params.size, "2048x2048");
  assert.equal(params.output_format, "png");
});
