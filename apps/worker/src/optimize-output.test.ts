import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { optimizeOutputImage } from "./optimize-output.js";

test("1024x768 PNG crops to 3:2 WebP and shrinks bytes", async () => {
  const png = await sharp({
    create: { width: 1024, height: 768, channels: 3, background: { r: 40, g: 80, b: 120 } },
  })
    .png()
    .toBuffer();
  const out = await optimizeOutputImage({ body: new Uint8Array(png), contentType: "image/png" });
  assert.equal(out.contentType, "image/webp");
  assert.equal(out.aspectRatio, "3:2");
  assert.ok(Math.abs(out.width / out.height - 3 / 2) < 0.02);
  assert.ok(out.body.byteLength < png.byteLength);
  const meta = await sharp(out.body).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, out.width);
  assert.equal(meta.height, out.height);
});

test("square image stays 1:1 WebP", async () => {
  const png = await sharp({
    create: { width: 256, height: 256, channels: 3, background: { r: 10, g: 10, b: 10 } },
  })
    .png()
    .toBuffer();
  const out = await optimizeOutputImage({ body: new Uint8Array(png), contentType: "image/png" });
  assert.equal(out.aspectRatio, "1:1");
  assert.equal(out.width, out.height);
});
