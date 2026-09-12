import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inferStorageDriver,
  objectStorageParamsFromEnv,
  resolveR2Bucket,
  rewriteDockerPublicEndpoint,
  splitR2Endpoint,
} from "./create.js";
import { createObjectStorage } from "./create.js";
import { S3CompatibleStorage } from "./s3-compatible.js";

test("unset STORAGE_DRIVER + minio endpoint infers minio", () => {
  const params = objectStorageParamsFromEnv({
    S3_ENDPOINT: "http://minio:9000",
    S3_BUCKET: "generations",
    S3_ACCESS_KEY: "minio",
    S3_SECRET_KEY: "minio12345",
    S3_FORCE_PATH_STYLE: "true",
  });
  assert.equal(params.driver, "minio");
  assert.equal(params.endpoint, "http://minio:9000");
  assert.equal(params.forcePathStyle, true);
});

test("STORAGE_DRIVER=r2 ignores leftover S3_* minio aliases", () => {
  const params = objectStorageParamsFromEnv({
    STORAGE_DRIVER: "r2",
    STORAGE_ENDPOINT: "https://abc.r2.cloudflarestorage.com/ai-gen-free",
    STORAGE_ACCESS_KEY: "r2-key",
    STORAGE_SECRET_KEY: "r2-secret",
    STORAGE_BUCKET: "generations",
    S3_ENDPOINT: "http://minio:9000",
    S3_ACCESS_KEY: "minio",
    S3_SECRET_KEY: "minio12345",
    S3_BUCKET: "generations",
  });
  assert.equal(params.driver, "r2");
  assert.equal(params.endpoint, "https://abc.r2.cloudflarestorage.com");
  assert.equal(params.bucket, "ai-gen-free");
  assert.equal(params.accessKeyId, "r2-key");
  assert.notEqual(params.endpoint, "http://minio:9000");
});

test("explicit STORAGE_DRIVER wins over endpoint inference", () => {
  const params = objectStorageParamsFromEnv({
    STORAGE_DRIVER: "r2",
    S3_ENDPOINT: "http://minio:9000",
  });
  assert.equal(params.driver, "r2");
  assert.equal(params.endpoint, undefined);
});

test("r2 endpoint infers r2", () => {
  assert.equal(inferStorageDriver("https://abc.r2.cloudflarestorage.com"), "r2");
});

test("splitR2Endpoint strips bucket path from S3 API origin", () => {
  assert.deepEqual(splitR2Endpoint("https://abc.r2.cloudflarestorage.com/ai-gen-free"), {
    origin: "https://abc.r2.cloudflarestorage.com",
    pathBucket: "ai-gen-free",
  });
});

test("resolveR2Bucket prefers path over default generations", () => {
  assert.equal(resolveR2Bucket("generations", "ai-gen-free"), "ai-gen-free");
  assert.equal(resolveR2Bucket("custom-bucket", "ai-gen-free"), "custom-bucket");
});

test("rewrite minio hostname so signed URL is browser-reachable", () => {
  assert.equal(rewriteDockerPublicEndpoint("http://minio:9000"), "http://localhost:9000");
  assert.equal(rewriteDockerPublicEndpoint("https://cdn.example.com"), "https://cdn.example.com");
});

test("minio adapter uses localhost public endpoint when only docker endpoint is set", () => {
  const storage = createObjectStorage({
    driver: "minio",
    endpoint: "http://minio:9000",
    bucket: "generations",
    accessKeyId: "minio",
    secretAccessKey: "minio12345",
    region: "us-east-1",
    forcePathStyle: true,
  });
  assert.ok(storage instanceof S3CompatibleStorage);
  assert.equal(storage.driver, "minio");
});

test("r2 without access keys fails immediately", () => {
  assert.throws(
    () =>
      createObjectStorage({
        driver: "r2",
        endpoint: "https://abc.r2.cloudflarestorage.com",
        bucket: "ai-gen-free",
        region: "auto",
      }),
    /STORAGE_ACCESS_KEY/,
  );
});

test("r2 adapter keeps driver r2 with cloudflare S3 API endpoint", () => {
  const storage = createObjectStorage({
    driver: "r2",
    endpoint: "https://abc.r2.cloudflarestorage.com/ai-gen-free",
    publicEndpoint: "https://pub-xxx.r2.dev",
    bucket: "generations",
    accessKeyId: "id",
    secretAccessKey: "secret",
    region: "auto",
    forcePathStyle: false,
  });
  assert.ok(storage instanceof S3CompatibleStorage);
  assert.equal(storage.driver, "r2");
});
