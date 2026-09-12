import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryObjectStorage } from "@ai-gen-free/storage";
import {
  customerOutputPath,
  isOutputAssetLive,
  isOutputPurged,
  promptPreview,
  resolveJobOutput,
} from "./output.js";

const now = new Date("2026-09-05T12:00:00.000Z");
const future = new Date("2026-09-19T12:00:00.000Z");
const past = new Date("2026-09-01T12:00:00.000Z");

test("promptPreview trims and caps at 120", () => {
  assert.equal(promptPreview("  halo  "), "halo");
  assert.equal(promptPreview("a".repeat(121)).length, 120);
});

test("live vs expired vs purged", () => {
  assert.equal(isOutputAssetLive({ purgedAt: null, expiresAt: future }, now), true);
  assert.equal(isOutputAssetLive({ purgedAt: null, expiresAt: past }, now), false);
  assert.equal(isOutputAssetLive({ purgedAt: now, expiresAt: future }, now), false);
  assert.equal(isOutputPurged(undefined, now), false);
  assert.equal(isOutputPurged({ purgedAt: null, expiresAt: now }, now), true);
});

test("resolveJobOutput: not succeeded or no asset is null", async () => {
  const storage = new MemoryObjectStorage();
  assert.equal(await resolveJobOutput("queued", undefined, storage, { now }), null);
  assert.equal(
    await resolveJobOutput(
      "failed",
      { storageKey: "outputs/u/j.png", contentType: "image/png", expiresAt: future, purgedAt: null },
      storage,
      { now },
    ),
    null,
  );
});

test("resolveJobOutput: live customer asset is app file path, never Siray", async () => {
  const storage = new MemoryObjectStorage();
  await storage.put({ key: "outputs/u/j.webp", body: new Uint8Array([1, 2, 3]), contentType: "image/webp" });
  const out = await resolveJobOutput(
    "succeeded",
    { storageKey: "outputs/u/j.webp", contentType: "image/webp", expiresAt: future, purgedAt: null },
    storage,
    { now, jobId: "job1" },
  );
  assert.ok(out);
  assert.equal(out.url, customerOutputPath("job1"));
  assert.equal(out.url, "/api/jobs/job1/file");
  assert.ok(!out.url?.includes("siray.ai"));
  assert.equal(out.contentType, "image/webp");
  assert.equal(out.availableUntil, future.toISOString());
  assert.equal(out.signedExpiresAt, null);
});

test("resolveJobOutput: live asset without jobId is signed 600s", async () => {
  const storage = new MemoryObjectStorage();
  await storage.put({ key: "outputs/u/j.png", body: new Uint8Array([1, 2, 3]), contentType: "image/png" });
  const out = await resolveJobOutput(
    "succeeded",
    { storageKey: "outputs/u/j.png", contentType: "image/png", expiresAt: future, purgedAt: null },
    storage,
    { now },
  );
  assert.ok(out);
  assert.ok(out.url);
  assert.ok(!out.url.includes("siray.ai"));
  assert.equal(out.contentType, "image/png");
  assert.equal(out.availableUntil, future.toISOString());
  assert.equal(out.signedExpiresAt, new Date(now.getTime() + 600_000).toISOString());
});

test("resolveJobOutput: expired or purged or missing object → url null, not throw", async () => {
  const storage = new MemoryObjectStorage();
  const expired = await resolveJobOutput(
    "succeeded",
    { storageKey: "outputs/u/j.png", contentType: "image/png", expiresAt: past, purgedAt: null },
    storage,
    { now },
  );
  assert.deepEqual(expired, {
    url: null,
    contentType: "image/png",
    availableUntil: past.toISOString(),
    signedExpiresAt: null,
  });

  const purged = await resolveJobOutput(
    "succeeded",
    { storageKey: "outputs/u/j.png", contentType: "image/png", expiresAt: future, purgedAt: now },
    storage,
    { now },
  );
  assert.equal(purged?.url, null);
  assert.equal(purged?.signedExpiresAt, null);

  const missing = await resolveJobOutput(
    "succeeded",
    { storageKey: "outputs/u/missing.png", contentType: "image/png", expiresAt: future, purgedAt: null },
    storage,
    { now },
  );
  assert.equal(missing?.url, null);
  assert.equal(missing?.availableUntil, future.toISOString());
});
