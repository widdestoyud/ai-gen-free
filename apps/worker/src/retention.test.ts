import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoryObjectStorage } from "@ai-gen-free/storage";
import type { ObjectStorage, PutObjectInput, StoredObject } from "@ai-gen-free/core";
import {
  isRetentionKey,
  runRetentionSweep,
  type RetentionAsset,
  type RetentionStore,
} from "./retention.js";

const now = new Date("2026-09-05T12:00:00.000Z");

function memoryRetentionStore(initial: RetentionAsset[]): RetentionStore & { rows: RetentionAsset[] } {
  const rows = initial.map((row) => ({ ...row }));
  return {
    rows,
    async listExpiredUnpurged(at, take, after) {
      const sorted = rows
        .filter((row) => row.purgedAt == null && row.expiresAt.getTime() < at.getTime())
        .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime() || a.id.localeCompare(b.id));
      const start = after
        ? sorted.findIndex(
            (row) =>
              row.expiresAt.getTime() > after.expiresAt.getTime() ||
              (row.expiresAt.getTime() === after.expiresAt.getTime() && row.id > after.id),
          )
        : 0;
      if (start < 0) return [];
      return sorted.slice(start, start + take).map((row) => ({ ...row }));
    },
    async markPurged(id, purgedAt) {
      const row = rows.find((item) => item.id === id);
      if (row && row.purgedAt == null) row.purgedAt = purgedAt;
    },
  };
}

class DeleteSpy implements ObjectStorage {
  readonly driver = "memory";
  deleted: string[] = [];
  constructor(
    private readonly inner: MemoryObjectStorage,
    private readonly failOn?: string,
  ) {}
  async put(input: PutObjectInput): Promise<void> {
    await this.inner.put(input);
  }
  async get(key: string): Promise<StoredObject> {
    return this.inner.get(key);
  }
  async delete(key: string): Promise<void> {
    if (this.failOn && key === this.failOn) throw new Error("delete failed");
    this.deleted.push(key);
    await this.inner.delete(key);
  }
  async signGetUrl(key: string, expiresSeconds?: number): Promise<string> {
    return this.inner.signGetUrl(key, expiresSeconds);
  }
}

test("isRetentionKey only outputs/ and inputs/", () => {
  assert.equal(isRetentionKey("outputs/u/j.png"), true);
  assert.equal(isRetentionKey("inputs/u/j.png"), true);
  assert.equal(isRetentionKey("proofs/u/inv"), false);
  assert.equal(isRetentionKey("outputs"), false);
});

test("sweep deletes expired outputs, marks purged, keeps job metadata caller-side", async () => {
  const inner = new MemoryObjectStorage();
  await inner.put({ key: "outputs/u/j.png", body: new Uint8Array([1]), contentType: "image/png" });
  await inner.put({ key: "proofs/u/inv", body: new Uint8Array([9]), contentType: "image/jpeg" });
  const storage = new DeleteSpy(inner);
  const store = memoryRetentionStore([
    {
      id: "a1",
      jobId: "job1",
      storageKey: "outputs/u/j.png",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      purgedAt: null,
    },
    {
      id: "proof",
      jobId: "job1",
      storageKey: "proofs/u/inv",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      purgedAt: null,
    },
  ]);

  const first = await runRetentionSweep({ store, storage, now: () => now, batchSize: 100 });
  assert.equal(first.purged, 1);
  assert.equal(first.skipped, 1);
  assert.deepEqual(storage.deleted, ["outputs/u/j.png"]);
  assert.ok(store.rows.find((r) => r.id === "a1")?.purgedAt);
  assert.equal(store.rows.find((r) => r.id === "proof")?.purgedAt, null);
  await inner.get("proofs/u/inv");

  const second = await runRetentionSweep({ store, storage, now: () => now, batchSize: 100 });
  assert.equal(second.purged, 0);
  assert.equal(second.skipped, 1);
  assert.deepEqual(storage.deleted, ["outputs/u/j.png"]);
});

test("missing object delete is success and sets purgedAt", async () => {
  const inner = new MemoryObjectStorage();
  const storage = new DeleteSpy(inner);
  const store = memoryRetentionStore([
    {
      id: "gone",
      jobId: "job2",
      storageKey: "outputs/u/missing.png",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      purgedAt: null,
    },
  ]);
  const result = await runRetentionSweep({ store, storage, now: () => now });
  assert.equal(result.purged, 1);
  assert.equal(result.failed, 0);
  assert.ok(store.rows[0]?.purgedAt);
});

test("delete failure does not set purgedAt", async () => {
  const inner = new MemoryObjectStorage();
  await inner.put({ key: "outputs/u/j.png", body: new Uint8Array([1]), contentType: "image/png" });
  const storage = new DeleteSpy(inner, "outputs/u/j.png");
  const store = memoryRetentionStore([
    {
      id: "a1",
      jobId: "job1",
      storageKey: "outputs/u/j.png",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      purgedAt: null,
    },
  ]);
  const result = await runRetentionSweep({ store, storage, now: () => now });
  assert.equal(result.purged, 0);
  assert.equal(result.failed, 1);
  assert.equal(store.rows[0]?.purgedAt, null);
});

test("already purged assets are skipped", async () => {
  const inner = new MemoryObjectStorage();
  const storage = new DeleteSpy(inner);
  const store = memoryRetentionStore([
    {
      id: "a1",
      jobId: "job1",
      storageKey: "outputs/u/j.png",
      expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      purgedAt: now,
    },
  ]);
  const result = await runRetentionSweep({ store, storage, now: () => now });
  assert.equal(result.purged, 0);
  assert.deepEqual(storage.deleted, []);
});
