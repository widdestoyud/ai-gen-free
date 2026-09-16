import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { UploadConfig } from "@ai-gen-free/core";
import {
  compressUploadImage,
  isAllowedMimeType,
  isImageBuffer,
  processUpload,
  checkUploadRateLimit,
} from "./service.js";

// Helper dummy memory storage for tests
function createTestStorage() {
  const store = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    driver: "memory",
    async put(input: { key: string; body: Uint8Array; contentType: string }) {
      store.set(input.key, { body: input.body, contentType: input.contentType });
    },
    async get(key: string) {
      const item = store.get(key);
      if (!item) throw new Error("Not found");
      return { key, ...item };
    },
    async delete(key: string) {
      store.delete(key);
    },
    async signGetUrl(key: string, _expiresSeconds = 600) {
      return `https://storage.local/${key}`;
    },
    _store: store,
  };
}

// Helper dummy redis for rate limit testing
function createTestRedis() {
  const kv = new Map<string, { val: number; expireAt: number }>();
  return {
    async incr(key: string) {
      const now = Date.now();
      const existing = kv.get(key);
      if (!existing || existing.expireAt <= now) {
        kv.set(key, { val: 1, expireAt: now + 60000 });
        return 1;
      }
      existing.val += 1;
      return existing.val;
    },
    async expire(key: string, seconds: number) {
      const existing = kv.get(key);
      if (existing) {
        existing.expireAt = Date.now() + seconds * 1000;
      }
      return 1;
    },
  } as any;
}

test("UploadConfig: contains all required configuration attributes", () => {
  assert.equal(UploadConfig.limits.maxSizeBytes, 5 * 1024 * 1024);
  assert.equal(UploadConfig.limits.maxFiles, 1);
  assert.ok(UploadConfig.allowedMimeTypes.includes("image/png"));
  assert.ok(UploadConfig.allowedMimeTypes.includes("image/jpeg"));
  assert.ok(UploadConfig.allowedMimeTypes.includes("image/webp"));
  assert.equal(UploadConfig.retention.ttlSeconds, 24 * 60 * 60);
  assert.equal(UploadConfig.compression.format, "webp");
  assert.equal(UploadConfig.compression.maxDimension, 2048);
  assert.ok(UploadConfig.compression.quality >= 80);
});

test("isAllowedMimeType: correctly validates allowed and disallowed mime types", () => {
  assert.equal(isAllowedMimeType("image/png"), true);
  assert.equal(isAllowedMimeType("image/jpeg"), true);
  assert.equal(isAllowedMimeType("image/jpg"), true);
  assert.equal(isAllowedMimeType("image/webp"), true);
  assert.equal(isAllowedMimeType("image/gif"), false);
  assert.equal(isAllowedMimeType("application/pdf"), false);
  assert.equal(isAllowedMimeType("text/plain"), false);
});

test("isImageBuffer: magic byte detection validates real images", async () => {
  // Generate valid PNG buffer
  const pngBuffer = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();

  // Generate valid JPEG buffer
  const jpgBuffer = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 255, b: 0 } },
  })
    .jpeg()
    .toBuffer();

  // Generate valid WebP buffer
  const webpBuffer = await sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .webp()
    .toBuffer();

  const fakeBuffer = Buffer.from("this is not an image at all but a text string");

  assert.equal(isImageBuffer(pngBuffer), true);
  assert.equal(isImageBuffer(jpgBuffer), true);
  assert.equal(isImageBuffer(webpBuffer), true);
  assert.equal(isImageBuffer(fakeBuffer), false);
});

test("compressUploadImage: portrait image remains portrait and aspect ratio is strictly preserved", async () => {
  // Portrait: 120 x 240 (ratio 1:2)
  const portrait = await sharp({
    create: { width: 120, height: 240, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toBuffer();

  const result = await compressUploadImage(portrait);

  assert.equal(result.contentType, "image/webp");
  assert.ok(result.height > result.width, "Portrait orientation must be preserved (height > width)");
  assert.equal(result.width, 120);
  assert.equal(result.height, 240);
  assert.ok(result.sizeBytes > 0);
});

test("compressUploadImage: landscape image remains landscape and aspect ratio is strictly preserved", async () => {
  // Landscape: 240 x 120 (ratio 2:1)
  const landscape = await sharp({
    create: { width: 240, height: 120, channels: 3, background: { r: 200, g: 150, b: 100 } },
  })
    .png()
    .toBuffer();

  const result = await compressUploadImage(landscape);

  assert.equal(result.contentType, "image/webp");
  assert.ok(result.width > result.height, "Landscape orientation must be preserved (width > height)");
  assert.equal(result.width, 240);
  assert.equal(result.height, 120);
});

test("compressUploadImage: scales down oversized images while maintaining aspect ratio and orientation", async () => {
  // Oversized landscape: 3000 x 1500 (ratio 2:1)
  const hugeLandscape = await sharp({
    create: { width: 3000, height: 1500, channels: 3, background: { r: 50, g: 50, b: 50 } },
  })
    .jpeg()
    .toBuffer();

  const result = await compressUploadImage(hugeLandscape);

  assert.equal(result.contentType, "image/webp");
  assert.equal(result.width, 2048, "Max dimension scaled to 2048");
  assert.equal(result.height, 1024, "Height scaled proportionally to 1024 (2:1 ratio preserved)");
  assert.ok(result.width > result.height, "Landscape orientation kept");
});

test("processUpload: customer upload saves to correct key and returns valid payload", async () => {
  const storage = createTestStorage();
  const rawPng = await sharp({
    create: { width: 200, height: 300, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .png()
    .toBuffer();

  const result = await processUpload({
    storage: storage as any,
    actor: "customer",
    actorId: "usr_cust123",
    buffer: rawPng,
    contentType: "image/png",
  });

  assert.ok(result.id.startsWith("up_"));
  assert.equal(result.width, 200);
  assert.equal(result.height, 300);
  assert.equal(result.url, `/customer/uploads/${result.id}/file`);

  // Verify stored object in storage
  const expectedKey = `uploads/customer/usr_cust123/${result.id}.webp`;
  const stored = await storage.get(expectedKey);
  assert.equal(stored.contentType, "image/webp");
  assert.ok(stored.body.length > 0);
});

test("processUpload: admin upload saves to correct admin key path", async () => {
  const storage = createTestStorage();
  const rawJpg = await sharp({
    create: { width: 400, height: 200, channels: 3, background: { r: 40, g: 50, b: 60 } },
  })
    .jpeg()
    .toBuffer();

  const result = await processUpload({
    storage: storage as any,
    actor: "admin",
    actorId: "adm_999",
    buffer: rawJpg,
    contentType: "image/jpeg",
  });

  assert.ok(result.id.startsWith("up_"));
  assert.equal(result.width, 400);
  assert.equal(result.height, 200);
  assert.equal(result.url, `/admin/uploads/${result.id}/file`);

  const expectedKey = `uploads/admin/adm_999/${result.id}.webp`;
  const stored = await storage.get(expectedKey);
  assert.equal(stored.contentType, "image/webp");
  assert.ok(stored.body.length > 0);
});

test("processUpload: rejects invalid mime type and oversized files", async () => {
  const storage = createTestStorage();

  await assert.rejects(
    async () => {
      await processUpload({
        storage: storage as any,
        actor: "customer",
        actorId: "usr_1",
        buffer: Buffer.from("pdf fake"),
        contentType: "application/pdf",
      });
    },
    { message: /Format berkas tidak didukung/ },
  );

  await assert.rejects(
    async () => {
      const hugeBuffer = new Uint8Array(5 * 1024 * 1024 + 10);
      await processUpload({
        storage: storage as any,
        actor: "customer",
        actorId: "usr_1",
        buffer: hugeBuffer,
        contentType: "image/png",
      });
    },
    { message: /melebihi batas maksimal/ },
  );
});

test("checkUploadRateLimit: allows within limit and throws 429 when limit exceeded", async () => {
  const redis = createTestRedis();

  // Customer limit is 10
  for (let i = 0; i < 10; i++) {
    await checkUploadRateLimit(redis, "customer", "usr_test_rate");
  }

  // 11th request should throw rate limit error
  await assert.rejects(
    async () => {
      await checkUploadRateLimit(redis, "customer", "usr_test_rate");
    },
    { message: /Batas frekuensi upload terlampaui/ },
  );
});

test("normalizeUploadError: maps ERR_STREAM_PREMATURE_CLOSE to E005 with clear Indonesian message", async () => {
  const { normalizeUploadError } = await import("../routes/uploads.js");

  const streamErr = new Error("Premature close");
  (streamErr as any).code = "ERR_STREAM_PREMATURE_CLOSE";

  const normalized = normalizeUploadError(streamErr);
  assert.equal(normalized.code, "E005");
  assert.equal(normalized.status, 400);
  assert.ok(normalized.message.includes("Koneksi pengunggahan terputus"));
});

test("normalizeUploadError: maps unsupported media type or invalid multipart to E002", async () => {
  const { normalizeUploadError } = await import("../routes/uploads.js");

  const mediaErr = new Error("Unsupported Media Type");
  (mediaErr as any).code = "FST_ERR_CTP_INVALID_MEDIA_TYPE";

  const normalized = normalizeUploadError(mediaErr);
  assert.equal(normalized.code, "E002");
  assert.equal(normalized.status, 400);
  assert.ok(normalized.message.includes("Format permintaan tidak valid"));
});

test("listCustomerUploads: pagination and structure verification", async () => {
  const { listCustomerUploads } = await import("./service.js");
  const storage = createTestStorage();

  const res = await listCustomerUploads(storage as any, "non_existent_user", { limit: 10, offset: 0 });
  assert.equal(res.limit, 10);
  assert.equal(res.offset, 0);
  assert.equal(typeof res.total, "number");
  assert.ok(Array.isArray(res.items));
});

test("listAdminUploads: pagination and structure verification", async () => {
  const { listAdminUploads } = await import("./service.js");
  const storage = createTestStorage();

  const res = await listAdminUploads(storage as any, { limit: 20, offset: 0 });
  assert.equal(res.limit, 20);
  assert.equal(res.offset, 0);
  assert.equal(typeof res.total, "number");
  assert.ok(Array.isArray(res.items));
});

test("syncUploadsFromStorage: handles storage listing and synchronization gracefully", async () => {
  const { syncUploadsFromStorage } = await import("./service.js");
  const storage = createTestStorage();

  // Test with empty storage
  const res = await syncUploadsFromStorage(storage as any);
  assert.equal(typeof res.scanned, "number");
  assert.equal(typeof res.synced, "number");
  assert.equal(typeof res.skipped, "number");
  assert.equal(typeof res.errors, "number");
});

test("getUploadFileForUser: streams image bytes directly without exposing R2 URL", async () => {
  const { getUploadFileForUser } = await import("./service.js");
  const storage = createTestStorage();

  await storage.put({
    key: "uploads/customer/usr_test123/up_sample123.webp",
    body: new Uint8Array([1, 2, 3, 4]),
    contentType: "image/webp",
  });

  const file = await getUploadFileForUser({
    storage: storage as any,
    userId: "usr_test123",
    id: "up_sample123",
  });

  assert.equal(file.contentType, "image/webp");
  assert.equal(file.body.length, 4);
});

test("softDeleteUploadForUser: rejects non-existent or already deleted image with NOT_FOUND", async () => {
  const { softDeleteUploadForUser } = await import("./service.js");
  await assert.rejects(
    async () => {
      await softDeleteUploadForUser("usr_non_existent", "up_non_existent");
    },
    {
      name: "AuthError",
      message: "Berkas gambar tidak ditemukan atau sudah dihapus",
    },
  );
});

test("updateUploadAliasForUser: rejects non-existent upload with NOT_FOUND", async () => {
  const { updateUploadAliasForUser } = await import("./service.js");
  await assert.rejects(
    async () => {
      await updateUploadAliasForUser("usr_non_existent", "up_non_existent", "Alias Baru");
    },
    {
      name: "AuthError",
      message: "Berkas gambar tidak ditemukan",
    },
  );
});




