import assert from "node:assert/strict";
import { test } from "node:test";
import { CircuitBreaker, type MinimalRedisClient } from "./circuit-breaker.js";

test("CircuitBreaker starts CLOSED and allows execution", async () => {
  const cb = new CircuitBreaker({ providerId: "siray-test", failureThreshold: 3, cooldownMs: 1000 });
  const check = await cb.canExecute();
  assert.equal(check.allowed, true);
  assert.equal(check.state, "CLOSED");
});

test("CircuitBreaker resets consecutive failures on success", async () => {
  const cb = new CircuitBreaker({ providerId: "siray-test", failureThreshold: 3, cooldownMs: 1000 });
  await cb.recordFailure("timeout 1");
  await cb.recordFailure("timeout 2");
  let state = await cb.getState();
  assert.equal(state.consecutiveFailures, 2);
  assert.equal(state.state, "CLOSED");

  await cb.recordSuccess(1500);
  state = await cb.getState();
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.state, "CLOSED");
});

test("CircuitBreaker trips to OPEN after 3 consecutive failures", async () => {
  const cb = new CircuitBreaker({ providerId: "siray-test", failureThreshold: 3, cooldownMs: 1000 });
  await cb.recordFailure("timeout 1");
  await cb.recordFailure("timeout 2");
  await cb.recordFailure("timeout 3");

  const state = await cb.getState();
  assert.equal(state.state, "OPEN");
  assert.equal(state.consecutiveFailures, 3);
  assert.ok(state.openedAt);

  const check = await cb.canExecute();
  assert.equal(check.allowed, false);
  assert.equal(check.state, "OPEN");
  assert.match(check.reason ?? "", /Circuit Breaker OPEN/);
});

test("CircuitBreaker transitions from OPEN to HALF_OPEN after cooldown", async () => {
  const cb = new CircuitBreaker({ providerId: "siray-test", failureThreshold: 3, cooldownMs: 50 });
  await cb.recordFailure("timeout 1");
  await cb.recordFailure("timeout 2");
  await cb.recordFailure("timeout 3");

  let check = await cb.canExecute();
  assert.equal(check.allowed, false);

  // Wait for cooldown to elapse
  await new Promise((r) => setTimeout(r, 60));

  check = await cb.canExecute();
  assert.equal(check.allowed, true);
  assert.equal(check.state, "HALF_OPEN");

  // Success in HALF_OPEN recovers to CLOSED
  await cb.recordSuccess(1000);
  const state = await cb.getState();
  assert.equal(state.state, "CLOSED");
  assert.equal(state.consecutiveFailures, 0);
});

test("CircuitBreaker trips back to OPEN if trial fails in HALF_OPEN", async () => {
  const cb = new CircuitBreaker({ providerId: "siray-test", failureThreshold: 3, cooldownMs: 50 });
  await cb.recordFailure("fail 1");
  await cb.recordFailure("fail 2");
  await cb.recordFailure("fail 3");

  await new Promise((r) => setTimeout(r, 60));
  const check = await cb.canExecute();
  assert.equal(check.state, "HALF_OPEN");

  // Trial failed
  await cb.recordFailure("trial failed");
  const state = await cb.getState();
  assert.equal(state.state, "OPEN");

  const checkBlocked = await cb.canExecute();
  assert.equal(checkBlocked.allowed, false);
  assert.equal(checkBlocked.state, "OPEN");
});

test("CircuitBreaker syncs across mock Redis client", async () => {
  const store = new Map<string, string>();
  const mockRedis: MinimalRedisClient = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
  };

  const cb1 = new CircuitBreaker({ providerId: "shared-provider", failureThreshold: 2, redis: mockRedis });
  const cb2 = new CircuitBreaker({ providerId: "shared-provider", failureThreshold: 2, redis: mockRedis });

  await cb1.recordFailure("fail 1");
  await cb1.recordFailure("fail 2");

  const check2 = await cb2.canExecute();
  assert.equal(check2.allowed, false);
  assert.equal(check2.state, "OPEN");
});
