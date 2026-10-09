import assert from "node:assert/strict";
import { test } from "node:test";
import { isSafePublicUrl, resolveInputImages } from "./resolve-inputs.js";
import type { ObjectStorage } from "@ai-gen-free/core";

test("isSafePublicUrl blocks localhost, private IPv4 subnets, internal hosts, and metadata", () => {
  // Localhost & loopback
  assert.equal(isSafePublicUrl("http://localhost:3000"), false);
  assert.equal(isSafePublicUrl("http://127.0.0.1/evil"), false);
  assert.equal(isSafePublicUrl("https://sub.localhost"), false);

  // Cloud metadata IP
  assert.equal(isSafePublicUrl("http://169.254.169.254/latest/meta-data/"), false);

  // Private subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  assert.equal(isSafePublicUrl("http://10.0.0.5/image.png"), false);
  assert.equal(isSafePublicUrl("http://172.17.0.2/image.png"), false);
  assert.equal(isSafePublicUrl("http://192.168.1.1/secret"), false);

  // Internal Docker hostnames
  assert.equal(isSafePublicUrl("http://redis:6379"), false);
  assert.equal(isSafePublicUrl("http://api:4000/internal"), false);
  assert.equal(isSafePublicUrl("http://postgres:5432"), false);

  // Valid public URLs
  assert.equal(isSafePublicUrl("https://fal.media/files/monkey/sample.png"), true);
  assert.equal(isSafePublicUrl("https://images.unsplash.com/photo-1234"), true);
});

test("resolveInputImages extracts both image and mask references safely", async () => {
  const dummyStorage: any = {
    get: async () => null,
    put: async () => ({ key: "ok" }),
    delete: async () => {},
    signGetUrl: async (key: string) => `https://storage.local/${key}`,
  };

  const dummyFetchBytes = async () => ({
    body: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), // PNG header
    contentType: "image/png",
  });

  // Test resolving with mask parameter
  const result = await resolveInputImages({
    userId: "user-123",
    jobId: "job-abc",
    params: {
      image: "https://fal.media/image.png",
      mask: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
    storage: dummyStorage,
    fetchBytes: dummyFetchBytes,
  });

  assert.ok(result.mask);
  assert.ok(result.mask.includes("temp/jobs/job-abc/mask.png") || result.mask.startsWith("data:image/png;base64,"));
  assert.ok(result.tempStorageKeys.length > 0);
  assert.equal(result.tempStorageKeys[0], "temp/jobs/job-abc/mask.png");
});
