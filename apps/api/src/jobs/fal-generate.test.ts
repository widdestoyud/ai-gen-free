import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFalGenerateSlug, falGenerateParamsFromBody } from "./fal-generate.js";

test("resolveFalGenerateSlug resolves krea and dynamic slugs", () => {
  const krea = resolveFalGenerateSlug("krea-v2-large-t2i");
  assert.equal(krea.modelId, "krea/v2/large/text-to-image");
  assert.equal(krea.mode, "t2i");

  const custom = resolveFalGenerateSlug("krea/v2/large/text-to-image");
  assert.equal(custom.modelId, "krea/v2/large/text-to-image");
  assert.equal(custom.mode, "t2i");
});

test("falGenerateParamsFromBody extracts parameters correctly", () => {
  const params = falGenerateParamsFromBody(
    { prompt: "test", aspectRatio: "16:9", seed: 99, creativity: 0.8 },
    { aspectRatio: "1:1" },
  );
  assert.equal(params.aspectRatio, "16:9");
  assert.equal(params.seed, 99);
  assert.equal(params.creativity, 0.8);
});
