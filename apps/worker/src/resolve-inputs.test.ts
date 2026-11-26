import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  TEMPLATE_IMAGE_REF_PREFIX,
  isSafePublicUrl,
  isTemplateRefAllowed,
  parseTemplateImageRef,
  resolveInputImages,
  resolveSingleImageBuffer,
  type ResolveInputsDb,
} from "./resolve-inputs.js";
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

test("TEMPLATE_IMAGE_REF_PREFIX and parseTemplateImageRef", () => {
  assert.equal(TEMPLATE_IMAGE_REF_PREFIX, "template-image:");
  assert.equal(parseTemplateImageRef("template-image:cmu1efgfz0001qz0zntv0iy2z"), "cmu1efgfz0001qz0zntv0iy2z");
  assert.equal(parseTemplateImageRef("template-image:../x"), null);
  assert.equal(parseTemplateImageRef("template-image:abc"), null);
  assert.equal(parseTemplateImageRef("template-image:Cmu1efgfz0001qz0zntv0iy2z"), null);
  assert.equal(parseTemplateImageRef("template-image:cmu1efgfz0001qz0zntv0iy2z/extra"), null);
  assert.equal(parseTemplateImageRef("xtemplate-image:cmu1efgfz0001qz0zntv0iy2z"), null);
  assert.equal(parseTemplateImageRef("https://cdn/x.webp"), null);
  assert.equal(parseTemplateImageRef("cmu1efgfz0001qz0zntv0iy2z"), null);
});

test("isTemplateRefAllowed enforces active and spicy guards", () => {
  assert.equal(isTemplateRefAllowed({ isActive: false, isSpicy: false }, true), false);
  assert.equal(isTemplateRefAllowed({ isActive: false, isSpicy: false }, false), false);
  assert.equal(isTemplateRefAllowed({ isActive: false, isSpicy: true }, true), false);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: true }, false), false);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: true }, true), true);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: false }, false), true);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: false }, true), true);
});

function createTemplateFixtureDeps(opts: {
  templateImage?: { storageKey: string; template: { isActive: boolean; isSpicy: boolean } } | null;
  user?: { spicyModeEnabled: boolean } | null;
  objects?: Record<string, Uint8Array>;
}) {
  const storageGetCalls: string[] = [];
  const uploadFindCalls: unknown[] = [];
  const jobAssetFindCalls: unknown[] = [];
  const templateFindCalls: unknown[] = [];
  const userFindCalls: unknown[] = [];

  const storage: ObjectStorage = {
    driver: "memory",
    async put() {},
    async get(key: string) {
      storageGetCalls.push(key);
      const body = opts.objects?.[key];
      if (!body) throw new Error(`Object not found: ${key}`);
      return { key, body, contentType: "image/webp" };
    },
    async delete() {},
    async signGetUrl(key: string) {
      return `https://storage.local/${key}`;
    },
  };

  const db: ResolveInputsDb = {
    templateImage: {
      async findUnique(args) {
        templateFindCalls.push(args);
        return opts.templateImage ?? null;
      },
    },
    user: {
      async findUnique(args) {
        userFindCalls.push(args);
        return opts.user ?? null;
      },
    },
    upload: {
      async findFirst(args) {
        uploadFindCalls.push(args);
        return null;
      },
    },
    jobAsset: {
      async findFirst(args) {
        jobAssetFindCalls.push(args);
        return null;
      },
    },
  };

  const fetchBytes = async () => {
    throw new Error("fetchBytes should not be called for template-image ref");
  };

  return {
    storage,
    db,
    fetchBytes,
    storageGetCalls,
    uploadFindCalls,
    jobAssetFindCalls,
    templateFindCalls,
    userFindCalls,
  };
}

test("resolveSingleImageBuffer resolves active non-spicy template-image ref and converts to PNG", async () => {
  const sampleWebp = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 120, g: 40, b: 200 } },
  })
    .webp()
    .toBuffer();

  const tplImgId = "cmu1efgfz0001qz0zntv0iy2z";
  const storageKey = "templates/abc123.webp";
  const deps = createTemplateFixtureDeps({
    templateImage: { storageKey, template: { isActive: true, isSpicy: false } },
    user: { spicyModeEnabled: false },
    objects: { [storageKey]: new Uint8Array(sampleWebp) },
  });

  const resolved = await resolveSingleImageBuffer({
    userId: "user-1",
    ref: `template-image:${tplImgId}`,
    storage: deps.storage,
    fetchBytes: deps.fetchBytes,
    db: deps.db,
  });

  assert.ok(resolved);
  assert.equal(resolved.contentType, "image/png");
  assert.deepEqual(Array.from(resolved.bytes.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
  assert.deepEqual(deps.storageGetCalls, [storageKey]);
  assert.equal(deps.uploadFindCalls.length, 0);
  assert.equal(deps.jobAssetFindCalls.length, 0);
  assert.deepEqual(deps.templateFindCalls, [
    {
      where: { id: tplImgId },
      include: { template: { select: { isActive: true, isSpicy: true } } },
    },
  ]);
  assert.deepEqual(deps.userFindCalls, [
    {
      where: { id: "user-1" },
      select: { spicyModeEnabled: true },
    },
  ]);
});

test("resolveSingleImageBuffer gates spicy template-image ref by user.spicyModeEnabled without fallback", async () => {
  const sampleWebp = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 10, b: 10 } },
  })
    .webp()
    .toBuffer();

  const tplImgId = "cmu1efgfz0001qz0zntv0iy2z";
  const storageKey = "templates/spicy01.webp";

  const blockedDeps = createTemplateFixtureDeps({
    templateImage: { storageKey, template: { isActive: true, isSpicy: true } },
    user: { spicyModeEnabled: false },
    objects: {
      [storageKey]: new Uint8Array(sampleWebp),
      [`uploads/customer/user-1/${tplImgId}.webp`]: new Uint8Array(sampleWebp),
    },
  });

  const blocked = await resolveSingleImageBuffer({
    userId: "user-1",
    ref: `template-image:${tplImgId}`,
    storage: blockedDeps.storage,
    fetchBytes: blockedDeps.fetchBytes,
    db: blockedDeps.db,
  });

  assert.equal(blocked, null);
  assert.deepEqual(blockedDeps.storageGetCalls, []);
  assert.equal(blockedDeps.uploadFindCalls.length, 0);
  assert.equal(blockedDeps.jobAssetFindCalls.length, 0);

  const allowedDeps = createTemplateFixtureDeps({
    templateImage: { storageKey, template: { isActive: true, isSpicy: true } },
    user: { spicyModeEnabled: true },
    objects: { [storageKey]: new Uint8Array(sampleWebp) },
  });

  const allowed = await resolveSingleImageBuffer({
    userId: "user-1",
    ref: `template-image:${tplImgId}`,
    storage: allowedDeps.storage,
    fetchBytes: allowedDeps.fetchBytes,
    db: allowedDeps.db,
  });

  assert.ok(allowed);
  assert.equal(allowed.contentType, "image/png");
  assert.deepEqual(allowedDeps.storageGetCalls, [storageKey]);
});

test("resolveSingleImageBuffer returns null without fallback for inactive, missing, or malformed template-image refs", async () => {
  const sampleWebp = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 10, g: 200, b: 10 } },
  })
    .webp()
    .toBuffer();

  const tplImgId = "cmu1efgfz0001qz0zntv0iy2z";
  const uploadFallbackKey = `uploads/customer/user-1/${tplImgId}.webp`;

  // Inactive template
  const inactiveDeps = createTemplateFixtureDeps({
    templateImage: { storageKey: "templates/dead.webp", template: { isActive: false, isSpicy: false } },
    user: { spicyModeEnabled: true },
    objects: { "templates/dead.webp": new Uint8Array(sampleWebp), [uploadFallbackKey]: new Uint8Array(sampleWebp) },
  });
  assert.equal(
    await resolveSingleImageBuffer({
      userId: "user-1",
      ref: `template-image:${tplImgId}`,
      storage: inactiveDeps.storage,
      fetchBytes: inactiveDeps.fetchBytes,
      db: inactiveDeps.db,
    }),
    null,
  );
  assert.deepEqual(inactiveDeps.storageGetCalls, []);
  assert.equal(inactiveDeps.uploadFindCalls.length, 0);

  // Missing templateImage in DB
  const missingTplDeps = createTemplateFixtureDeps({
    templateImage: null,
    user: { spicyModeEnabled: true },
    objects: { [uploadFallbackKey]: new Uint8Array(sampleWebp) },
  });
  assert.equal(
    await resolveSingleImageBuffer({
      userId: "user-1",
      ref: `template-image:${tplImgId}`,
      storage: missingTplDeps.storage,
      fetchBytes: missingTplDeps.fetchBytes,
      db: missingTplDeps.db,
    }),
    null,
  );
  assert.deepEqual(missingTplDeps.storageGetCalls, []);
  assert.equal(missingTplDeps.uploadFindCalls.length, 0);

  // Missing user in DB
  const missingUserDeps = createTemplateFixtureDeps({
    templateImage: { storageKey: "templates/ok.webp", template: { isActive: true, isSpicy: false } },
    user: null,
    objects: { "templates/ok.webp": new Uint8Array(sampleWebp) },
  });
  assert.equal(
    await resolveSingleImageBuffer({
      userId: "user-missing",
      ref: `template-image:${tplImgId}`,
      storage: missingUserDeps.storage,
      fetchBytes: missingUserDeps.fetchBytes,
      db: missingUserDeps.db,
    }),
    null,
  );
  assert.deepEqual(missingUserDeps.storageGetCalls, []);

  // Malformed template-image ref that would otherwise match old regex [a-z0-9_-]{10,40}
  const malformedDeps = createTemplateFixtureDeps({
    objects: { "uploads/customer/user-1/bad_id_123456.webp": new Uint8Array(sampleWebp) },
  });
  assert.equal(
    await resolveSingleImageBuffer({
      userId: "user-1",
      ref: "template-image:bad_id_123456",
      storage: malformedDeps.storage,
      fetchBytes: malformedDeps.fetchBytes,
      db: malformedDeps.db,
    }),
    null,
  );
  assert.deepEqual(malformedDeps.storageGetCalls, []);
  assert.equal(malformedDeps.uploadFindCalls.length, 0);
});

test("resolveInputImages resolves template-image refs in params.refs into temp PNGs", async () => {
  const sampleWebp = await sharp({
    create: { width: 2, height: 2, channels: 3, background: { r: 20, g: 120, b: 220 } },
  })
    .webp()
    .toBuffer();

  const tplImgId = "cmu1efgfz0001qz0zntv0iy2z";
  const storageKey = "templates/ref01.webp";
  const putCalls: Array<{ key: string; contentType: string }> = [];
  const deps = createTemplateFixtureDeps({
    templateImage: { storageKey, template: { isActive: true, isSpicy: false } },
    user: { spicyModeEnabled: false },
    objects: { [storageKey]: new Uint8Array(sampleWebp) },
  });
  deps.storage.put = async (input) => {
    putCalls.push({ key: input.key, contentType: input.contentType });
  };

  const result = await resolveInputImages({
    userId: "user-1",
    jobId: "job-tpl-1",
    params: {
      refs: [{ url: `template-image:${tplImgId}` }],
    },
    storage: deps.storage,
    fetchBytes: deps.fetchBytes,
    db: deps.db,
  });

  assert.ok(result.image?.endsWith("/temp/jobs/job-tpl-1/image-0.png"));
  assert.deepEqual(result.images, [result.image]);
  assert.deepEqual(result.tempStorageKeys, ["temp/jobs/job-tpl-1/image-0.png"]);
  assert.deepEqual(putCalls, [{ key: "temp/jobs/job-tpl-1/image-0.png", contentType: "image/png" }]);
});
