# Handoff Report: Redis Caching Strategy, SSE Multiplexing, and Connection Hardening (R2)

**Author:** teamwork_preview_explorer (Role: Redis Caching & SSE Multiplexing Explorer)  
**Date:** 2026-10-08T09:40:00Z  
**Target Requirements:** Milestone 2 (Performance & Query Optimization — R2)  
**Status:** Investigation Complete (Read-Only)

---

## 1. Observation

Direct code observations, measurements, and test traces from codebase inspection:

### A. Hot Session Query Overhead on Every Request
In `apps/api/src/auth/service.ts` lines 1314–1343:
```typescript
export async function userFromCookie(
  token: string | undefined,
  kind: SessionKind,
  context?: SessionBindingContext,
) {
  if (!token) return null;
  const tokenHash = hashSecret(appSecret(), token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.kind !== kind || session.expiresAt.getTime() < Date.now()) {
    if (session && session.expiresAt.getTime() < Date.now()) {
      void prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  if (session.user.bannedAt) return null;
  if (kind === "admin" && session.user.role !== "admin") return null;

  if (context) {
    const check = verifySessionBinding(session, context);
    if (!check.valid) {
      return null;
    }
  }

  return session;
}
```
- Every authenticated API request across customer and admin routes (`requireUser`, `requireAdmin`, `handleGetProfile`, `handlePatchProfile`, `handleChangePassword`) hits PostgreSQL with `prisma.session.findUnique({ where: { tokenHash }, include: { user: true } })`.
- Redis is never queried for session authentication, despite `redis` being instantiated in the API process.
- Sessions have a 7-day TTL (`SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000`) and are strictly validated by `tokenHash`, but read-paths hit PostgreSQL on 100% of calls.

### B. Repetitive Database Reads for Static Model Catalog
In `apps/api/src/jobs/catalog.ts` lines 209–216:
```typescript
export async function listCustomerCatalog(): Promise<CustomerCatalogItem[]> {
  const [rows, defaults] = await Promise.all([
    prisma.modelCatalog.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    getActiveDefaultModels(),
  ]);
```
In `apps/api/src/jobs/catalog.ts` lines 256–266:
```typescript
let rows = await prisma.modelCatalog.findMany({
  where: { mode, enabled: true },
  orderBy: { createdAt: "asc" },
});
```
In `apps/api/src/jobs/service.ts` lines 194–200 & 285–291:
```typescript
const spicyCatalogRows = await prisma.modelCatalog
  .findMany({
    where: { isSpicy: true },
    select: { modelId: true },
  })
  .catch(() => []);
```
- Every customer catalog fetch, every job submission (`POST /generate/*`), and every library/job listing queries `prisma.modelCatalog`.
- In `apps/api/src/admin/service.ts` lines 770–780, `updateModelCatalog` is the only route that updates model configurations. Model catalog data is virtually static in production, yet executes multiple DB round trips per user generation.

### C. Repetitive Database Reads for App Settings
In `apps/api/src/admin/service.ts` lines 26, 123, 240, 280:
- `getPaymentSettings()`: `prisma.appSetting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } })` (called on checkout, topup, invoice queries)
- `getTesterAccountSettings()`: `prisma.appSetting.findUnique({ where: { key: TESTER_ACCOUNT_KEY } })` (called during user login in `auth/service.ts:353`)
- `getGenerateCooldownSetting()`: `prisma.appSetting.findUnique({ where: { key: GENERATE_COOLDOWN_KEY } })` (called on generation cooldown checks)
- `getActiveDefaultModels()`: `prisma.appSetting.findUnique({ where: { key: DEFAULT_GENERATION_MODELS_KEY } })` (called on all job submissions and catalog requests)
- All 4 settings are updated exclusively by admin functions (`putPaymentSettings`, `putTesterAccountSettings`, `putGenerateCooldownSetting`, `putDefaultGenerationModelsSetting`), but read from PostgreSQL on hot customer paths.

### D. Redis Connection Exhaustion in SSE Subscriptions
In `apps/api/src/routes/wallet.ts` lines 155–168:
```typescript
const subscriber = deps.redis.duplicate();
const channel = `invoice-events:${session.userId}`;

let closed = false;
const cleanup = async () => {
  if (closed) return;
  closed = true;
  clearInterval(heartbeat);
  subscriber.removeAllListeners();
  try {
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  } catch {}
};
```
In `apps/api/src/routes/wallet.ts` lines 313–326:
```typescript
const subscriber = deps.redis.duplicate();
const channel = "invoice-events:all";
```
- In both `/invoices/events` (customer) and `/admin/invoices/events` (admin), a dedicated Redis TCP connection is created per SSE client via `deps.redis.duplicate()`.
- 1,000 active web browser clients listening for payment updates create 1,000 concurrent Redis client TCP connections, exhausting server-side connection limits (`maxclients`) and incurring high socket management overhead in Node.js.

### E. Missing Uncaught Error Handlers on IORedis Instances
In `apps/api/src/index.ts` lines 183–185:
```typescript
const redis = new IORedis(redisUrl);
const queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("generate", { connection: queueConnection });
```
- Neither `redis` nor `queueConnection` has an `.on("error")` event listener registered.
- In Node.js, an `EventEmitter` emitting an `"error"` event with no registered listeners throws an Uncaught Exception, terminating the Node.js process immediately (`process.exit(1)`). Transient network drops or Redis restarts will cause server crashes.

### F. Baseline Test Suite Verification
Executed `pnpm --filter @ai-gen-free/api test`:
```
✔ tests 102
✔ suites 0
✔ pass 102
✔ fail 0
ℹ duration_ms ~15064ms
```
- All 102 unit/integration baseline tests currently pass.
- Tests mock Redis using in-memory mocks (`MockRedis` in `auth-flow.test.ts`, `createTestRedis` in `uploads.test.ts`) or pass `{ redis: undefined }` in `chat.test.ts`. Any new caching logic must degrade gracefully when Redis is unavailable or unconfigured.

---

## 2. Logic Chain

1. **Premise**: In `apps/api/src/auth/service.ts`, `userFromCookie` is invoked on all authenticated requests (e.g. 500 RPS) and executes `prisma.session.findUnique({ include: { user: true } })`.
   **Inference**: Session tokens and user profiles are practically immutable between user actions. Caching valid session objects in Redis under `cache:session:${tokenHash}` with a 15-minute TTL reduces database read load by >90%.
   **Inference**: When single-session enforcement (`createSingleSession`), logout (`logout`), password change (`changeUserPassword`), or profile updates (`updateUserProfile`) occur, an in-memory or Redis index mapping `user:session:${userId}:${kind} -> tokenHash` allows instant invalidation without leaving stale sessions active.

2. **Premise**: `ModelCatalog` and `AppSetting` records are modified solely through admin endpoints (`apps/api/src/admin/service.ts`), yet are read synchronously on every job submission and catalog request.
   **Inference**: A cache-aside pattern with 1-hour TTL for `cache:catalog:customer`, `cache:catalog:enabled`, and `cache:setting:${key}` eliminates unnecessary DB round trips. Admin mutation hooks can immediately invalidate these keys, guaranteeing 100% cache freshness while serving sub-millisecond responses from Redis.

3. **Premise**: `apps/api/src/routes/wallet.ts` calls `deps.redis.duplicate()` on every connected client for `/invoices/events` and `/admin/invoices/events`.
   **Inference**: Redis Pub/Sub operates on channels over a single connection. A shared multiplexer (`RedisSubscriberMultiplexer`) holding a single duplicated subscriber connection can dispatch channel events to multiple in-memory listeners via a `Map<channel, Set<listener>>`.
   **Inference**: The total number of Redis subscriber connections drops from $O(N)$ (where $N$ is connected web clients) to $O(1)$ (exactly 1 persistent subscriber connection), eliminating connection exhaustion and connection setup latency.

4. **Premise**: `new IORedis()` in `apps/api/src/index.ts` lacks `.on("error")` handlers.
   **Inference**: In Node.js, unhandled EventEmitter error events trigger `uncaughtException` and process exit. Adding explicit `.on("error", logHandler)` to all Redis instances ensures transient disconnections are logged and handled by IORedis's automatic exponential-backoff reconnect engine instead of crashing the server.

5. **Premise**: The test suite runs in isolated environments where Redis is frequently absent or substituted with mock objects.
   **Inference**: The caching service must check for Redis availability and wrap all Redis calls in `try/catch`. If Redis is null, disconnected, or throws an error, the system must transparently fall back to direct Prisma database execution, ensuring zero test regressions.

---

## 3. Caveats

1. **Date Serialization**: Prisma returns native JavaScript `Date` instances (`session.expiresAt`, `user.createdAt`, etc.). When stored in Redis as JSON, these serialize to ISO date strings. Deserialization logic must reconstruct `Date` objects so callers relying on `.getTime()`, `.toISOString()`, or date arithmetic do not experience runtime type errors.
2. **Multi-Instance / Cluster Invalidation**: In a horizontally scaled cluster, Redis `DEL` invalidates keys globally across all API pods. For in-memory caches, Pub/Sub would be needed; but using Redis directly as the cache layer ensures all pods observe cache invalidations atomically.
3. **Graceful Fallback on Redis Outages**: Redis should be treated as an accelerator, not a hard single point of failure for reading static catalog data or validating sessions. If Redis is unreachable, queries must proceed directly against PostgreSQL.

---

## 4. Conclusion & Actionable Implementation Strategy

### A. Component Architecture Overview

```
                               ┌─────────────────────────────────┐
                               │       apps/api/src/index.ts     │
                               │   - IORedis .on("error")        │
                               │   - setCacheRedis(redis)        │
                               │   - Shared Multiplexer close()  │
                               └──────────────┬──────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
     ┌─────────────────────────────┐                     ┌─────────────────────────────┐
     │  apps/api/src/lib/cache.ts  │                     │ apps/api/src/lib/redis-     │
     │  - Session cache + TTL      │                     │   multiplexer.ts            │
     │  - Model Catalog cache      │                     │  - Single shared subscriber │
     │  - App Settings cache       │                     │  - In-memory channel map    │
     │  - Invalidation triggers    │                     │  - Clean teardown on close  │
     └──────────────┬──────────────┘                     └──────────────┬──────────────┘
                    │                                                   │
     ┌──────────────┴──────────────┐                     ┌──────────────┴──────────────┐
     ▼                             ▼                     ▼                             ▼
auth/service.ts               admin/service.ts      routes/wallet.ts               routes/jobs.ts
jobs/catalog.ts               jobs/service.ts       /invoices/events (SSE)         /generate/:id/events
```

---

### B. Exact Implementation Specifications

#### 1. Create `apps/api/src/lib/cache.ts`
Create a centralized cache-aside module supporting Session, ModelCatalog, and AppSetting caching:

```typescript
import type IORedis from "ioredis";
import type { Session, User } from "@prisma/client";

let cacheRedis: IORedis | null = null;

export function setCacheRedis(redis: IORedis | null | undefined): void {
  cacheRedis = redis ?? null;
}

export function getCacheRedis(): IORedis | null {
  return cacheRedis;
}

// -------------------------------------------------------------
// 1. Session Cache
// -------------------------------------------------------------
const SESSION_CACHE_TTL_DEFAULT = 900; // 15 minutes

type CachedSessionData = Session & { user: User };

function deserializeSession(raw: any): CachedSessionData {
  return {
    ...raw,
    expiresAt: new Date(raw.expiresAt),
    createdAt: new Date(raw.createdAt),
    user: {
      ...raw.user,
      createdAt: new Date(raw.user.createdAt),
      updatedAt: new Date(raw.user.updatedAt),
      bannedAt: raw.user.bannedAt ? new Date(raw.user.bannedAt) : null,
      emailVerifiedAt: raw.user.emailVerifiedAt ? new Date(raw.user.emailVerifiedAt) : null,
      dateOfBirth: raw.user.dateOfBirth ? new Date(raw.user.dateOfBirth) : null,
      uploadPolicyAcceptedAt: raw.user.uploadPolicyAcceptedAt ? new Date(raw.user.uploadPolicyAcceptedAt) : null,
      spicyModeAcceptedAt: raw.user.spicyModeAcceptedAt ? new Date(raw.user.spicyModeAcceptedAt) : null,
      lastLoginAt: raw.user.lastLoginAt ? new Date(raw.user.lastLoginAt) : null,
    },
  };
}

export async function getCachedSession(tokenHash: string): Promise<CachedSessionData | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get(`cache:session:${tokenHash}`);
    if (!raw) return null;
    return deserializeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function setCachedSession(
  tokenHash: string,
  session: CachedSessionData,
): Promise<void> {
  if (!cacheRedis) return;
  try {
    const remainingSeconds = Math.floor((session.expiresAt.getTime() - Date.now()) / 1000);
    const ttl = Math.min(SESSION_CACHE_TTL_DEFAULT, Math.max(1, remainingSeconds));
    await Promise.all([
      cacheRedis.set(`cache:session:${tokenHash}`, JSON.stringify(session), "EX", ttl),
      cacheRedis.set(`user:session:${session.userId}:${session.kind}`, tokenHash, "EX", ttl),
    ]);
  } catch {}
}

export async function invalidateSession(tokenHash: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del(`cache:session:${tokenHash}`);
  } catch {}
}

export async function invalidateUserSessions(userId: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    const [hashUser, hashAdmin] = await Promise.all([
      cacheRedis.get(`user:session:${userId}:user`),
      cacheRedis.get(`user:session:${userId}:admin`),
    ]);
    const keysToDelete: string[] = [
      `user:session:${userId}:user`,
      `user:session:${userId}:admin`,
    ];
    if (hashUser) keysToDelete.push(`cache:session:${hashUser}`);
    if (hashAdmin) keysToDelete.push(`cache:session:${hashAdmin}`);
    await cacheRedis.del(...keysToDelete);
  } catch {}
}

// -------------------------------------------------------------
// 2. Model Catalog Cache
// -------------------------------------------------------------
const CATALOG_CACHE_TTL = 3600; // 1 hour

export async function getCachedCustomerCatalog<T>(): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get("cache:catalog:customer");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedCustomerCatalog<T>(catalog: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set("cache:catalog:customer", JSON.stringify(catalog), "EX", CATALOG_CACHE_TTL);
  } catch {}
}

export async function getCachedEnabledModels<T>(): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get("cache:catalog:enabled");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedEnabledModels<T>(rows: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set("cache:catalog:enabled", JSON.stringify(rows), "EX", CATALOG_CACHE_TTL);
  } catch {}
}

export async function invalidateModelCatalogCache(): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del("cache:catalog:customer", "cache:catalog:enabled");
  } catch {}
}

// -------------------------------------------------------------
// 3. App Settings Cache
// -------------------------------------------------------------
const SETTINGS_CACHE_TTL = 3600; // 1 hour

export async function getCachedAppSetting<T>(key: string): Promise<T | null> {
  if (!cacheRedis) return null;
  try {
    const raw = await cacheRedis.get(`cache:setting:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setCachedAppSetting<T>(key: string, value: T): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.set(`cache:setting:${key}`, JSON.stringify(value), "EX", SETTINGS_CACHE_TTL);
  } catch {}
}

export async function invalidateAppSetting(key: string): Promise<void> {
  if (!cacheRedis) return;
  try {
    await cacheRedis.del(`cache:setting:${key}`);
  } catch {}
}
```

---

#### 2. Create `apps/api/src/lib/redis-multiplexer.ts`
Create the shared subscriber multiplexer to prevent per-client connection sprawl:

```typescript
import type IORedis from "ioredis";

export type MessageHandler = (message: string) => void;

export class RedisSubscriberMultiplexer {
  private subscriber: IORedis | null = null;
  private channelHandlers = new Map<string, Set<MessageHandler>>();
  private rootRedis: IORedis | null = null;

  constructor(redis?: IORedis | null) {
    this.rootRedis = redis ?? null;
  }

  public setRedis(redis: IORedis | null | undefined): void {
    if (this.rootRedis === redis) return;
    this.rootRedis = redis ?? null;
    if (this.subscriber) {
      void this.close();
    }
  }

  private getSubscriber(): IORedis | null {
    if (this.subscriber) return this.subscriber;
    if (!this.rootRedis) return null;

    try {
      this.subscriber = this.rootRedis.duplicate();
      this.subscriber.on("error", (err) => {
        // Prevent unhandled error crashing process
        console.error("[redis-multiplexer] Subscriber error:", err?.message || err);
      });
      this.subscriber.on("message", (channel: string, message: string) => {
        const handlers = this.channelHandlers.get(channel);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(message);
            } catch (err) {
              console.error("[redis-multiplexer] Handler dispatch error:", err);
            }
          }
        }
      });
      return this.subscriber;
    } catch (err) {
      console.error("[redis-multiplexer] Failed to duplicate subscriber:", err);
      return null;
    }
  }

  public async subscribe(channel: string, handler: MessageHandler): Promise<() => void> {
    const subscriber = this.getSubscriber();
    if (!subscriber) {
      return () => {};
    }

    let handlers = this.channelHandlers.get(channel);
    const isFirst = !handlers || handlers.size === 0;

    if (!handlers) {
      handlers = new Set<MessageHandler>();
      this.channelHandlers.set(channel, handlers);
    }
    handlers.add(handler);

    if (isFirst) {
      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.channelHandlers.delete(channel);
        }
        throw err;
      }
    }

    return () => {
      const currentHandlers = this.channelHandlers.get(channel);
      if (!currentHandlers) return;
      currentHandlers.delete(handler);
      if (currentHandlers.size === 0) {
        this.channelHandlers.delete(channel);
        if (this.subscriber) {
          this.subscriber.unsubscribe(channel).catch(() => {});
        }
      }
    };
  }

  public async close(): Promise<void> {
    if (this.subscriber) {
      try {
        this.subscriber.removeAllListeners();
        await this.subscriber.quit();
      } catch {}
      this.subscriber = null;
    }
    this.channelHandlers.clear();
  }
}
```

---

#### 3. Update `apps/api/src/index.ts`
- Add `.on("error")` handlers on `redis` and `queueConnection`.
- Initialize `setCacheRedis(redis)`.
- Wire up clean graceful shutdown.

```typescript
// Around line 183 in apps/api/src/index.ts:
const redis = new IORedis(redisUrl);
const queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

// Attach error handlers to prevent unhandled EventEmitter exception crashes
redis.on("error", (err) => {
  app.log.error({ event: "redis.error", client: "main", error: String(err) });
});

queueConnection.on("error", (err) => {
  app.log.error({ event: "redis.error", client: "queue", error: String(err) });
});

// Configure cache module
setCacheRedis(redis);
```

In `shutdown` (line 330):
```typescript
const shutdown = async () => {
  await app.close();
  await queue.close();
  await queueConnection.quit();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
};
```

---

#### 4. Update `apps/api/src/auth/service.ts`
1. **`userFromCookie`**:
```typescript
export async function userFromCookie(
  token: string | undefined,
  kind: SessionKind,
  context?: SessionBindingContext,
) {
  if (!token) return null;
  const tokenHash = hashSecret(appSecret(), token);

  // 1. Try Redis cache
  let session = await getCachedSession(tokenHash);

  // 2. Fall back to PostgreSQL if cache miss
  if (!session) {
    session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (session && session.kind === kind && session.expiresAt.getTime() >= Date.now()) {
      void setCachedSession(tokenHash, session);
    }
  }

  if (!session || session.kind !== kind || session.expiresAt.getTime() < Date.now()) {
    if (session && session.expiresAt.getTime() < Date.now()) {
      void prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      void invalidateSession(tokenHash);
    }
    return null;
  }
  if (session.user.bannedAt) return null;
  if (kind === "admin" && session.user.role !== "admin") return null;

  if (context) {
    const check = verifySessionBinding(session, context);
    if (!check.valid) {
      return null;
    }
  }

  return session;
}
```

2. **`createSingleSession`**:
```typescript
// After tx.session.create:
void invalidateUserSessions(opts.userId);
void setCachedSession(opts.tokenHash, { ...session, user });
```

3. **`logout`**:
```typescript
export async function logout(token: string | undefined, kind: SessionKind) {
  if (!token) return;
  const tokenHash = hashSecret(appSecret(), token);
  await prisma.session.deleteMany({ where: { tokenHash, kind } });
  void invalidateSession(tokenHash);
}
```

4. **`resetPassword` & `changeUserPassword`**:
```typescript
// After password change and session deletion:
void invalidateUserSessions(userId);
```

5. **`updateUserProfile`**:
```typescript
// After profile update:
void invalidateUserSessions(userId);
```

---

#### 5. Update `apps/api/src/jobs/catalog.ts`
1. **`listCustomerCatalog`**:
```typescript
export async function listCustomerCatalog(): Promise<CustomerCatalogItem[]> {
  const cached = await getCachedCustomerCatalog<CustomerCatalogItem[]>();
  if (cached) return cached;

  const [rows, defaults] = await Promise.all([
    prisma.modelCatalog.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
    }),
    getActiveDefaultModels(),
  ]);

  // Compute catalog items ...
  const result = Array.from(map.values());
  void setCachedCustomerCatalog(result);
  return result;
}
```

2. **`getActiveDefaultModels`**:
```typescript
export async function getActiveDefaultModels(): Promise<DefaultGenerationModelsConfig> {
  const cached = await getCachedAppSetting<DefaultGenerationModelsConfig>(DEFAULT_GENERATION_MODELS_KEY);
  if (cached) return cached;

  const row = await prisma.appSetting.findUnique({ where: { key: DEFAULT_GENERATION_MODELS_KEY } });
  const raw = row?.value as Partial<DefaultGenerationModelsConfig> | null | undefined;
  const config = {
    // ... resolve fallbacks
  };
  void setCachedAppSetting(DEFAULT_GENERATION_MODELS_KEY, config);
  return config;
}
```

---

#### 6. Update `apps/api/src/admin/service.ts`
1. **`getPaymentSettings` & `putPaymentSettings`**:
```typescript
export async function getPaymentSettings(): Promise<PaymentSettingsConfig> {
  const cached = await getCachedAppSetting<PaymentSettingsConfig>(PAYMENT_SETTINGS_KEY);
  if (cached) return cached;

  const row = await prisma.appSetting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } });
  // ... compute config
  void setCachedAppSetting(PAYMENT_SETTINGS_KEY, config);
  return config;
}

export async function putPaymentSettings(...) {
  // ... inside tx:
  await tx.appSetting.upsert(...);
  // ...
  void invalidateAppSetting(PAYMENT_SETTINGS_KEY);
  return nextConfig;
}
```

2. **`getTesterAccountSettings` & `putTesterAccountSettings`**:
- Cache in `getTesterAccountSettings`, invalidate in `putTesterAccountSettings`.

3. **`getGenerateCooldownSetting` & `putGenerateCooldownSetting`**:
- Cache in `getGenerateCooldownSetting`, invalidate in `putGenerateCooldownSetting`.

4. **`getDefaultGenerationModelsSetting` & `putDefaultGenerationModelsSetting`**:
- In `putDefaultGenerationModelsSetting`:
  ```typescript
  void invalidateAppSetting(DEFAULT_GENERATION_MODELS_KEY);
  void invalidateModelCatalogCache(); // Customer catalog depends on default models
  ```

5. **`updateModelCatalog`**:
- After `tx.modelCatalog.update(...)`:
  ```typescript
  void invalidateModelCatalogCache();
  ```

---

#### 7. Update `apps/api/src/routes/wallet.ts`
Instantiate `RedisSubscriberMultiplexer` once at route registration and multiplex both customer and admin SSE endpoints:

```typescript
// Inside registerWalletRoutes(app, deps):
const multiplexer = new RedisSubscriberMultiplexer(deps.redis);

// In app.get("/invoices/events", ...):
  if (!deps.redis) {
    reply.raw.write(`data: ${JSON.stringify({ type: "connected", userId: session.userId })}\n\n`);
    reply.raw.end();
    return;
  }

  const channel = `invoice-events:${session.userId}`;
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };

  try {
    unsubscribe = await multiplexer.subscribe(channel, (message) => {
      try {
        reply.raw.write(`data: ${message}\n\n`);
      } catch {
        cleanup();
      }
    });
  } catch {
    cleanup();
    reply.raw.end();
    return;
  }

  reply.raw.write(`data: ${JSON.stringify({ type: "connected", userId: session.userId })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(":ping\n\n");
    } catch {
      cleanup();
    }
  }, 15000);

  req.raw.on("close", () => {
    cleanup();
  });

// In app.get("/admin/invoices/events", ...):
// Identical multiplexer subscription to "invoice-events:all", sharing the same underlying connection!

// Fastify instance onClose cleanup:
app.addHook("onClose", async () => {
  await multiplexer.close();
});
```

---

## 5. Verification Method

### A. Baseline Regression Suite
Execute the existing 102 unit & integration tests:
```bash
pnpm --filter @ai-gen-free/api test
```
*Pass condition:* All 102 baseline tests pass with exit code 0.

### B. Redis Caching & Invalidation Unit Tests
Add verification tests to validate:
1. `userFromCookie`:
   - First call queries DB and writes to Redis key `cache:session:<tokenHash>`.
   - Second call reads from Redis without querying DB.
   - Calling `logout()` or `changeUserPassword()` removes `cache:session:<tokenHash>` and subsequent request hits DB or rejects.
2. `ModelCatalog`:
   - `listCustomerCatalog()` caches output.
   - Admin `updateModelCatalog()` triggers `invalidateModelCatalogCache()`.
3. `AppSetting`:
   - `getPaymentSettings()` returns cached config.
   - Admin `putPaymentSettings()` invalidates `cache:setting:payment_settings`.

### C. SSE Subscriber Multiplexer Concurrency Test
Verify multiplexer behavior under multiple concurrent connections:
- Simulate 10 clients subscribing to the same channel `invoice-events:usr_1`.
- Verify `rootRedis.duplicate()` was called **exactly once**.
- Publish 1 event on the channel; verify all 10 clients receive the event.
- Disconnect 9 clients; verify subscription remains active.
- Disconnect the 10th client; verify `unsubscribe(channel)` is invoked and the channel is cleared from the internal map.

### D. Invalidation Conditions for Review
1. If `deps.redis.duplicate()` is invoked inside the per-request handler of `/invoices/events`, multiplexing is broken and connection sprawl remains.
2. If `new IORedis()` in `apps/api/src/index.ts` has no `.on("error")` handler, server remains vulnerable to unhandled exception crashes.
3. If session cache deserialization returns `string` instead of `Date` for `expiresAt` or `createdAt`, date comparisons will fail at runtime.
