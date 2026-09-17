import assert from "node:assert/strict";
import { test } from "node:test";
import { AppError, ErrorCodes } from "@ai-gen-free/core";
import { resolveSirayGenerateSlug, sirayGenerateParamsFromBody } from "./siray-generate.js";

test("known slugs map to catalog modelIds and modes", () => {
  assert.equal(resolveSirayGenerateSlug("gpt-image-2-t2i").modelId, "openai/gpt-image-2-t2i");
  assert.equal(resolveSirayGenerateSlug("gpt-image-2-t2i").mode, "t2i");
  assert.equal(resolveSirayGenerateSlug("gpt-image-2-edit").modelId, "openai/gpt-image-2-edit");
  assert.equal(resolveSirayGenerateSlug("gpt-image-2-edit").mode, "i2i");
  assert.equal(
    resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy").modelId,
    "bytedance/seedream-5.0-pro-t2i-spicy",
  );
  assert.equal(resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy").mode, "t2i");
  assert.equal(resolveSirayGenerateSlug("seedream-5.0-pro-t2i-spicy").defaultParams.size, "1024x1024");
  assert.equal(
    resolveSirayGenerateSlug("qwen-image-3-edit-spicy").modelId,
    "alibaba/qwen-image-3-edit-spicy",
  );
  assert.equal(resolveSirayGenerateSlug("qwen-image-3-edit-spicy").mode, "i2i");
  assert.equal(resolveSirayGenerateSlug("qwen-image-3-edit-spicy").defaultParams.size, "1k");
  assert.equal(
    resolveSirayGenerateSlug("seedance-2.5-i2v").modelId,
    "bytedance/seedance-2.5-i2v",
  );
  assert.equal(resolveSirayGenerateSlug("seedance-2.5-i2v").mode, "i2v");
  assert.equal(resolveSirayGenerateSlug("seedance-2.5-i2v").defaultParams.resolution, "480");
  assert.equal(resolveSirayGenerateSlug("seedance-2.5-i2v").defaultParams.duration, 6);
  assert.equal(
    resolveSirayGenerateSlug("seedance-2.0-i2v-spicy").modelId,
    "bytedance/seedance-2.0-i2v-spicy",
  );
  assert.equal(resolveSirayGenerateSlug("seedance-2.0-i2v-spicy").mode, "i2v");
  assert.equal(resolveSirayGenerateSlug("seedance-2.0-i2v-spicy").defaultParams.resolution, "480");
  assert.equal(resolveSirayGenerateSlug("seedance-2.0-i2v-spicy").defaultParams.duration, 6);
  assert.equal(
    resolveSirayGenerateSlug("wan-2.7-i2v-uncensored").modelId,
    "alibaba/wan-2.7-i2v-uncensored",
  );
  assert.equal(resolveSirayGenerateSlug("wan-2.7-i2v-uncensored").mode, "i2v");
  assert.equal(resolveSirayGenerateSlug("wan-2.7-i2v-uncensored").defaultParams.resolution, "480");
  assert.equal(resolveSirayGenerateSlug("wan-2.7-i2v-uncensored").defaultParams.duration, 6);
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

test("seedance i2v models resolve defaults and duration / resolution override", () => {
  const { defaultParams } = resolveSirayGenerateSlug("seedance-2.5-i2v");
  const params = sirayGenerateParamsFromBody(
    { prompt: "dance motion", image: "https://example.com/ref.webp", duration: "10s", resolution: "720p" },
    defaultParams,
  );
  assert.equal(params.duration, "10s");
  assert.equal(params.resolution, "720p");
  assert.equal(params.image, "https://example.com/ref.webp");
});

test("qwen edit spicy resolves defaults and image inputs", () => {
  const { defaultParams } = resolveSirayGenerateSlug("qwen-image-3-edit-spicy");
  const params = sirayGenerateParamsFromBody(
    { prompt: "ubah pakaian", image: "https://example.com/ref.webp" },
    defaultParams,
  );
  assert.equal(params.size, "1k");
  assert.equal(params.aspectRatio, "1:1");
  assert.equal(params.prompt_expansion_enable, true);
  assert.equal(params.image, "https://example.com/ref.webp");
});
