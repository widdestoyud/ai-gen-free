import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ASPECT_RATIO_CONFIGS,
  ASPECT_RATIO_SIZE_MAP,
  STUDIO_ASPECTS,
  getAspectMetadata,
  transformAspectRatioToSize,
} from "./aspect-ratio.js";

test("ASPECT_RATIO_SIZE_MAP maps ratios to specified dimensions", () => {
  assert.equal(ASPECT_RATIO_SIZE_MAP["2:3"], "1024x1536");
  assert.equal(ASPECT_RATIO_SIZE_MAP["3:2"], "1536x1024");
  assert.equal(ASPECT_RATIO_SIZE_MAP["1:1"], "1024x1024");
  assert.equal(ASPECT_RATIO_SIZE_MAP["9:16"], "768x1024");
  assert.equal(ASPECT_RATIO_SIZE_MAP["16:9"], "1024x768");
});

test("transformAspectRatioToSize transforms ratio with fallback", () => {
  assert.equal(transformAspectRatioToSize("2:3"), "1024x1536");
  assert.equal(transformAspectRatioToSize("3:2"), "1536x1024");
  assert.equal(transformAspectRatioToSize("1:1"), "1024x1024");
  assert.equal(transformAspectRatioToSize("9:16"), "768x1024");
  assert.equal(transformAspectRatioToSize("16:9"), "1024x768");
  assert.equal(transformAspectRatioToSize("unknown"), "1024x1024");
});

test("getAspectMetadata returns metadata with tierSize", () => {
  const meta = getAspectMetadata("16:9");
  assert.equal(meta.value, "16:9");
  assert.equal(meta.dimension, "1024x768");
  assert.equal(meta.tierSize, "1k");
  assert.equal(meta.width, 1024);
  assert.equal(meta.height, 768);
});

test("STUDIO_ASPECTS contains all 5 aspect ratios in order", () => {
  assert.equal(STUDIO_ASPECTS.length, 5);
  assert.deepEqual(
    STUDIO_ASPECTS.map((a) => a.value),
    ["2:3", "3:2", "1:1", "9:16", "16:9"]
  );
});
