import assert from "node:assert/strict";
import { test } from "node:test";
import { centerCropBox, nearestOutputAspect } from "./aspect-ratio.js";

test("nearest aspect maps common generate sizes", () => {
  assert.equal(nearestOutputAspect(1024, 1024).id, "1:1");
  assert.equal(nearestOutputAspect(1024, 768).id, "3:2");
  assert.equal(nearestOutputAspect(768, 1024).id, "2:3");
  assert.equal(nearestOutputAspect(1920, 1080).id, "16:9");
  assert.equal(nearestOutputAspect(1080, 1920).id, "9:16");
});

test("4:3 landscape snaps to 3:2 not 16:9", () => {
  assert.equal(nearestOutputAspect(1024, 768).id, "3:2");
});

test("center crop 1024x768 to 3:2 trims height", () => {
  const aspect = nearestOutputAspect(1024, 768);
  const box = centerCropBox(1024, 768, aspect);
  assert.equal(box.width, 1024);
  assert.equal(box.left, 0);
  assert.equal(box.height, Math.round(1024 / (3 / 2)));
  assert.ok(box.top > 0);
  assert.ok(box.top + box.height <= 768);
  assert.ok(Math.abs(box.width / box.height - 3 / 2) < 0.02);
});

test("already 1:1 is a no-op crop", () => {
  assert.deepEqual(centerCropBox(512, 512, nearestOutputAspect(512, 512)), {
    left: 0,
    top: 0,
    width: 512,
    height: 512,
  });
});
