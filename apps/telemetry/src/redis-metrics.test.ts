import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  fetchRedisServerMetrics,
  fetchBullQueuesMetrics,
  fetchRedisKeyspaceSummary,
  closeRedisConnection,
} from "./redis-metrics.js";

describe("Redis Metrics & Telemetry", () => {
  after(async () => {
    await closeRedisConnection();
  });
  it("fetches redis server metrics safely without throwing even if offline", async () => {
    const res = await fetchRedisServerMetrics();
    assert.ok(typeof res.connected === "boolean");
    assert.ok(typeof res.url === "string");
    if (res.connected) {
      assert.ok(res.server);
      assert.ok(res.memory);
      assert.ok(res.stats);
      assert.ok(typeof res.memory.usedMemoryBytes === "number");
    }
  });

  it("fetches bullmq queues metrics structure safely", async () => {
    const res = await fetchBullQueuesMetrics();
    assert.ok(typeof res.available === "boolean");
    assert.ok(Array.isArray(res.queues));
    if (res.available && res.queues.length > 0) {
      const q = res.queues[0];
      assert.ok(typeof q.name === "string");
      assert.ok(typeof q.counts === "object");
      assert.ok(typeof q.counts.waiting === "number");
      assert.ok(typeof q.counts.active === "number");
    }
  });

  it("fetches redis keyspace summary structure safely", async () => {
    const res = await fetchRedisKeyspaceSummary();
    assert.ok(typeof res.available === "boolean");
    assert.ok(typeof res.totalSampled === "number");
    assert.ok(typeof res.categories === "object");
    assert.ok(Array.isArray(res.sampleKeys));
  });
});
