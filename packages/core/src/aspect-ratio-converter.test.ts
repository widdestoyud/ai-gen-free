import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ASPECT_RATIOS,
  SEEDREAM_ASPECT_PAYLOAD_MAP,
  GPT_IMAGE_ASPECT_PAYLOAD_MAP,
  FAL_ASPECT_PAYLOAD_MAP,
  WAN_VIDEO_ASPECT_MAP,
  detectModelFamily,
  normalizeCanonicalAspectRatio,
  convertAspectRatioPayload,
} from "./aspect-ratio-converter.js";

describe("aspect-ratio-converter", () => {
  it("has canonical definitions for all supported ratios", () => {
    assert.deepEqual(CANONICAL_ASPECT_RATIOS["1:1"].dimension, "1024x1024");
    assert.deepEqual(CANONICAL_ASPECT_RATIOS["9:16"].dimension, "576x1024");
    assert.deepEqual(CANONICAL_ASPECT_RATIOS["16:9"].dimension, "1024x576");
    assert.deepEqual(CANONICAL_ASPECT_RATIOS["2:3"].dimension, "1024x1536");
    assert.deepEqual(CANONICAL_ASPECT_RATIOS["3:2"].dimension, "1536x1024");
  });

  it("detects model families accurately", () => {
    assert.equal(detectModelFamily("fal-ai/krea-2/turbo/lora"), "fal-standard");
    assert.equal(detectModelFamily("fal-ai/seedvr/upscale/image"), "fal-upscaler");
    assert.equal(detectModelFamily("bytedance/seedream-3.0-t2i-spicy"), "siray-seedream");
    assert.equal(detectModelFamily("openai/gpt-image-2-t2i"), "siray-gpt");
    assert.equal(detectModelFamily("alibaba/qwen-image-2.0-t2i"), "siray-qwen");
    assert.equal(detectModelFamily("alibaba/wan-2.7-i2v-uncensored"), "siray-wan");
    assert.equal(detectModelFamily("bytedance/seedance-2.5-i2v-spicy"), "siray-seedance");
    assert.equal(detectModelFamily("black-forest-labs/flux-1.1-pro-t2i"), "siray-standard");
  });

  it("normalizes canonical aspect ratios safely", () => {
    assert.equal(normalizeCanonicalAspectRatio("9:16"), "9:16");
    assert.equal(normalizeCanonicalAspectRatio(" 16:9 "), "16:9");
    assert.equal(normalizeCanonicalAspectRatio("invalid"), "1:1");
    assert.equal(normalizeCanonicalAspectRatio(undefined), "1:1");
    assert.equal(normalizeCanonicalAspectRatio(null), "1:1");
  });

  describe("convertAspectRatioPayload", () => {
    it("converts payload for Fal.ai Krea 2 model (9:16 -> portrait_16_9)", () => {
      const payload = convertAspectRatioPayload("fal-ai/krea-2/turbo/lora", "9:16");
      assert.deepEqual(payload, {
        aspect_ratio: "9:16",
        image_size: "portrait_16_9",
      });
    });

    it("converts payload for Fal.ai (2:3 -> { width: 832, height: 1216 })", () => {
      const payload = convertAspectRatioPayload("fal-ai/krea-2/turbo/lora", "2:3");
      assert.deepEqual(payload, {
        aspect_ratio: "2:3",
        image_size: { width: 832, height: 1216 },
      });
    });

    it("converts payload for Fal Upscaler SeedVR", () => {
      const payload = convertAspectRatioPayload("fal-ai/seedvr/upscale/image", "1:1");
      assert.deepEqual(payload, {
        upscale_mode: "factor",
        target_resolution: "4K",
      });
    });

    it("converts payload for Siray Seedream (9:16 -> 800x1424, 16:9 -> 1424x800)", () => {
      const p916 = convertAspectRatioPayload("bytedance/seedream-3.0-t2i-spicy", "9:16");
      assert.deepEqual(p916, { size: "800x1424" });

      const p169 = convertAspectRatioPayload("bytedance/seedream-3.0-t2i-spicy", "16:9");
      assert.deepEqual(p169, { size: "1424x800" });
    });

    it("converts payload for Siray GPT Image (9:16 -> 1024x1536)", () => {
      const payload = convertAspectRatioPayload("openai/gpt-image-2-t2i", "9:16");
      assert.deepEqual(payload, { size: "1024x1536" });
    });

    it("converts payload for Siray Qwen (16:9 -> size: 1k, aspect_ratio: 16:9)", () => {
      const payload = convertAspectRatioPayload("alibaba/qwen-image-2.0-t2i", "16:9");
      assert.deepEqual(payload, {
        size: "1k",
        aspect_ratio: "16:9",
        prompt_expansion_enable: false,
      });
    });

    it("converts payload for Siray Wan Video (3:2 mapped to 16:9)", () => {
      const payload = convertAspectRatioPayload("alibaba/wan-2.7-i2v-uncensored", "3:2");
      assert.deepEqual(payload, {
        aspect_ratio: "16:9",
      });
    });

    it("converts payload for Siray Seedance Video", () => {
      const payload = convertAspectRatioPayload("bytedance/seedance-2.5-i2v-spicy", "9:16");
      assert.deepEqual(payload, {
        duration: 6,
        resolution: "480",
        aspect_ratio: "9:16",
      });
    });

    it("converts payload for Fal Flux Schnell (num_inference_steps: 4)", () => {
      const payload = convertAspectRatioPayload("fal-ai/flux/schnell", "16:9");
      assert.deepEqual(payload, {
        aspect_ratio: "16:9",
        image_size: "landscape_16_9",
        num_inference_steps: 4,
      });
    });

    it("converts payload for Fal Fast SVD Video (duration: 1, 14 frames, small resolution)", () => {
      const payload = convertAspectRatioPayload("fal-ai/fast-svd", "9:16");
      assert.deepEqual(payload, {
        duration: 1,
        num_frames: 14,
        fps: 14,
        aspect_ratio: "9:16",
        resolution: "384x640",
        width: 384,
        height: 640,
      });
    });

    it("converts payload for Fal Fast AnimateDiff Video (duration: 1, 16 frames)", () => {
      const payload = convertAspectRatioPayload("fal-ai/fast-animatediff/text-to-video", "1:1");
      assert.deepEqual(payload, {
        duration: 1,
        num_frames: 16,
        fps: 16,
        aspect_ratio: "1:1",
        resolution: "512x512",
        width: 512,
        height: 512,
      });
    });
  });
});
