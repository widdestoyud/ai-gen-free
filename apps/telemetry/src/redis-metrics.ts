import { Redis } from "ioredis";
import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

let redisClient: Redis | null = null;
let isRedisAvailable = false;
let lastError: string | null = null;

function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.password) u.password = "******";
    return u.toString();
  } catch {
    return raw;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        return Math.min(times * 1000, 5000);
      },
    });

    redisClient.on("connect", () => {
      isRedisAvailable = true;
      lastError = null;
    });

    redisClient.on("ready", () => {
      isRedisAvailable = true;
      lastError = null;
    });

    redisClient.on("error", (err: any) => {
      isRedisAvailable = false;
      lastError = err?.message || String(err);
    });

    redisClient.on("close", () => {
      isRedisAvailable = false;
    });

    // Attempt initial connect asynchronously
    redisClient.connect().catch((err: any) => {
      isRedisAvailable = false;
      lastError = err?.message || String(err);
    });
  }

  return redisClient;
}

export async function closeRedisConnection(): Promise<void> {
  for (const q of queueInstances.values()) {
    await q.close().catch(() => {});
  }
  queueInstances.clear();

  if (redisClient) {
    await redisClient.quit().catch(() => {
      redisClient?.disconnect();
    });
    redisClient = null;
    isRedisAvailable = false;
  }
}

export interface RedisServerInfo {
  connected: boolean;
  url: string;
  error?: string | null;
  server?: {
    version: string;
    mode: string;
    os: string;
    processId: number;
    uptimeSeconds: number;
    uptimeHuman: string;
    tcpPort: number;
  };
  memory?: {
    usedMemoryHuman: string;
    usedMemoryRssHuman: string;
    usedMemoryPeakHuman: string;
    usedMemoryBytes: number;
    usedMemoryPeakBytes: number;
    fragmentationRatio: number;
    maxMemoryHuman: string;
    maxMemoryPolicy: string;
  };
  clients?: {
    connectedClients: number;
    blockedClients: number;
    maxClients: number;
  };
  stats?: {
    instantaneousOpsPerSec: number;
    totalCommandsProcessed: number;
    totalConnectionsReceived: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    hitRatioPercent: number;
    rejectedConnections: number;
    expiredKeys: number;
  };
  keyspace?: Record<string, { keys: number; expires: number; avgTtl: number }>;
}

function parseInfo(rawInfo: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = rawInfo.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx);
      const val = trimmed.slice(colonIdx + 1);
      result[key] = val;
    }
  }
  return result;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

export async function fetchRedisServerMetrics(): Promise<RedisServerInfo> {
  const client = getRedisClient();
  const safeUrl = sanitizeUrl(redisUrl);

  try {
    if (client.status === "wait" || client.status === "close") {
      await client.connect();
    }
    const raw = await client.info();
    const parsed = parseInfo(raw);

    const uptimeSec = Number(parsed.uptime_in_seconds || 0);
    const hits = Number(parsed.keyspace_hits || 0);
    const misses = Number(parsed.keyspace_misses || 0);
    const totalLookups = hits + misses;
    const hitRatio = totalLookups > 0 ? Number(((hits / totalLookups) * 100).toFixed(1)) : 0;

    // Keyspace parsing
    const keyspace: Record<string, { keys: number; expires: number; avgTtl: number }> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith("db")) {
        // v format: keys=12,expires=0,avg_ttl=0
        const parts = v.split(",");
        const entry: { keys: number; expires: number; avgTtl: number } = { keys: 0, expires: 0, avgTtl: 0 };
        for (const p of parts) {
          const [pk, pv] = p.split("=");
          if (pk === "keys") entry.keys = Number(pv);
          if (pk === "expires") entry.expires = Number(pv);
          if (pk === "avg_ttl") entry.avgTtl = Number(pv);
        }
        keyspace[k] = entry;
      }
    }

    return {
      connected: true,
      url: safeUrl,
      server: {
        version: parsed.redis_version || "unknown",
        mode: parsed.redis_mode || "standalone",
        os: parsed.os || "unknown",
        processId: Number(parsed.process_id || 0),
        uptimeSeconds: uptimeSec,
        uptimeHuman: formatUptime(uptimeSec),
        tcpPort: Number(parsed.tcp_port || 6379),
      },
      memory: {
        usedMemoryHuman: parsed.used_memory_human || "0B",
        usedMemoryRssHuman: parsed.used_memory_rss_human || "0B",
        usedMemoryPeakHuman: parsed.used_memory_peak_human || "0B",
        usedMemoryBytes: Number(parsed.used_memory || 0),
        usedMemoryPeakBytes: Number(parsed.used_memory_peak || 0),
        fragmentationRatio: Number(parsed.mem_fragmentation_ratio || 1),
        maxMemoryHuman: parsed.maxmemory_human || "unlimited",
        maxMemoryPolicy: parsed.maxmemory_policy || "noeviction",
      },
      clients: {
        connectedClients: Number(parsed.connected_clients || 0),
        blockedClients: Number(parsed.blocked_clients || 0),
        maxClients: Number(parsed.maxclients || 10000),
      },
      stats: {
        instantaneousOpsPerSec: Number(parsed.instantaneous_ops_per_sec || 0),
        totalCommandsProcessed: Number(parsed.total_commands_processed || 0),
        totalConnectionsReceived: Number(parsed.total_connections_received || 0),
        keyspaceHits: hits,
        keyspaceMisses: misses,
        hitRatioPercent: hitRatio,
        rejectedConnections: Number(parsed.rejected_connections || 0),
        expiredKeys: Number(parsed.expired_keys || 0),
      },
      keyspace,
    };
  } catch (err: any) {
    return {
      connected: false,
      url: safeUrl,
      error: err?.message || String(err),
    };
  }
}

export interface BullQueueSummary {
  name: string;
  isPaused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
    total: number;
  };
  jobs: Array<{
    id: string;
    name: string;
    state: string;
    timestamp: string;
    processedOn?: string | null;
    finishedOn?: string | null;
    attemptsMade: number;
    progress: number | object;
    failedReason?: string | null;
    data: any;
  }>;
}

const queueInstances = new Map<string, Queue>();

function getOrCreateQueue(name: string, connection: Redis): Queue {
  if (!queueInstances.has(name)) {
    queueInstances.set(name, new Queue(name, { connection }));
  }
  return queueInstances.get(name)!;
}

export async function fetchBullQueuesMetrics(): Promise<{
  available: boolean;
  queues: BullQueueSummary[];
  error?: string | null;
}> {
  const client = getRedisClient();
  if (client.status !== "ready" && client.status !== "connect") {
    try {
      await client.connect();
    } catch (err: any) {
      return { available: false, queues: [], error: err?.message || String(err) };
    }
  }

  try {
    // Known queues
    const queueNames = new Set(["generate", "retention"]);

    // Scan for any additional dynamic BullMQ queues
    let cursor = "0";
    try {
      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", "bull:*:meta", "COUNT", 50);
        cursor = nextCursor;
        for (const k of keys) {
          const match = k.match(/^bull:([^:]+):meta$/);
          if (match && match[1]) {
            queueNames.add(match[1]);
          }
        }
      } while (cursor !== "0" && queueNames.size < 10);
    } catch {
      // fallback to known queues
    }

    const summaries: BullQueueSummary[] = [];

    for (const qName of queueNames) {
      const q = getOrCreateQueue(qName, client);
      const [counts, isPaused] = await Promise.all([
        q.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused"),
        q.isPaused().catch(() => false),
      ]);

      const total =
        (counts.waiting || 0) +
        (counts.active || 0) +
        (counts.completed || 0) +
        (counts.failed || 0) +
        (counts.delayed || 0) +
        (counts.paused || 0);

      // Fetch sample jobs: active, waiting, failed, recent completed
      const [activeJobs, waitingJobs, failedJobs, completedJobs] = await Promise.all([
        q.getJobs(["active"], 0, 5).catch(() => []),
        q.getJobs(["waiting"], 0, 5).catch(() => []),
        q.getJobs(["failed"], 0, 5).catch(() => []),
        q.getJobs(["completed"], 0, 5).catch(() => []),
      ]);

      const allJobs = [...activeJobs, ...waitingJobs, ...failedJobs, ...completedJobs];
      // deduplicate
      const jobMap = new Map<string, any>();
      for (const j of allJobs) {
        if (!j || !j.id) continue;
        const state = await j.getState().catch(() => "unknown");
        jobMap.set(String(j.id), {
          id: String(j.id),
          name: j.name,
          state,
          timestamp: j.timestamp ? new Date(j.timestamp).toISOString() : new Date().toISOString(),
          processedOn: j.processedOn ? new Date(j.processedOn).toISOString() : null,
          finishedOn: j.finishedOn ? new Date(j.finishedOn).toISOString() : null,
          attemptsMade: j.attemptsMade,
          progress: j.progress,
          failedReason: j.failedReason ?? null,
          data: sanitizeJobData(j.data),
        });
      }

      summaries.push({
        name: qName,
        isPaused,
        counts: {
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          completed: counts.completed || 0,
          failed: counts.failed || 0,
          delayed: counts.delayed || 0,
          paused: counts.paused || 0,
          total,
        },
        jobs: Array.from(jobMap.values()),
      });
    }

    return { available: true, queues: summaries };
  } catch (err: any) {
    return { available: false, queues: [], error: err?.message || String(err) };
  }
}

function sanitizeJobData(data: any): any {
  if (!data || typeof data !== "object") return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };
  for (const k of Object.keys(clone)) {
    const lk = k.toLowerCase();
    if (lk.includes("token") || lk.includes("password") || lk.includes("secret") || lk.includes("otp")) {
      clone[k] = "******";
    } else if (typeof clone[k] === "string" && clone[k].startsWith("data:image/") && clone[k].length > 100) {
      clone[k] = `[base64 image redacted, length=${clone[k].length}]`;
    }
  }
  return clone;
}

export interface RedisKeyItem {
  key: string;
  category: string;
  type: string;
  ttl: number; // -1 = no expiry, -2 = missing
}

export interface RedisKeyspaceSummary {
  available: boolean;
  totalSampled: number;
  categories: Record<string, number>;
  sampleKeys: RedisKeyItem[];
  error?: string | null;
}

export async function fetchRedisKeyspaceSummary(): Promise<RedisKeyspaceSummary> {
  const client = getRedisClient();
  if (client.status !== "ready" && client.status !== "connect") {
    try {
      await client.connect();
    } catch (err: any) {
      return { available: false, totalSampled: 0, categories: {}, sampleKeys: [], error: err?.message || String(err) };
    }
  }

  try {
    let cursor = "0";
    const rawKeys: string[] = [];
    do {
      const [nextCursor, keys] = await client.scan(cursor, "COUNT", 250);
      cursor = nextCursor;
      rawKeys.push(...keys);
      if (rawKeys.length >= 500) break;
    } while (cursor !== "0");

    const categories: Record<string, number> = {
      "BullMQ (generate)": 0,
      "BullMQ (retention)": 0,
      "BullMQ (other)": 0,
      "Rate Limits": 0,
      "Sessions / Auth": 0,
      "Wallet / Holds": 0,
      "Cooldowns": 0,
      "Other": 0,
    };

    function categorizeKey(k: string): string {
      if (k.startsWith("bull:generate:")) return "BullMQ (generate)";
      if (k.startsWith("bull:retention:")) return "BullMQ (retention)";
      if (k.startsWith("bull:")) return "BullMQ (other)";
      if (k.startsWith("ratelimit:") || k.startsWith("rl:")) return "Rate Limits";
      if (k.startsWith("session:") || k.startsWith("user:") || k.startsWith("auth:")) return "Sessions / Auth";
      if (k.startsWith("hold:") || k.startsWith("adjust:") || k.startsWith("wallet:")) return "Wallet / Holds";
      if (k.startsWith("cooldown:")) return "Cooldowns";
      return "Other";
    }

    for (const k of rawKeys) {
      const cat = categorizeKey(k);
      categories[cat] = (categories[cat] || 0) + 1;
    }

    // Inspect top 40 sample keys
    const sampleSlice = rawKeys.slice(0, 40);
    const sampleKeys: RedisKeyItem[] = [];

    await Promise.all(
      sampleSlice.map(async (k) => {
        const [type, ttl] = await Promise.all([
          client.type(k).catch(() => "unknown"),
          client.ttl(k).catch(() => -1),
        ]);
        sampleKeys.push({
          key: k,
          category: categorizeKey(k),
          type,
          ttl,
        });
      })
    );

    // Sort keys alphabetically
    sampleKeys.sort((a, b) => a.key.localeCompare(b.key));

    return {
      available: true,
      totalSampled: rawKeys.length,
      categories,
      sampleKeys,
    };
  } catch (err: any) {
    return {
      available: false,
      totalSampled: 0,
      categories: {},
      sampleKeys: [],
      error: err?.message || String(err),
    };
  }
}

export async function fetchCircuitBreakerStatus(providerId = "siray") {
  const client = getRedisClient();
  try {
    const raw = await client.get(`circuit_breaker:${providerId}`);
    if (!raw) {
      return {
        providerId,
        state: "CLOSED",
        consecutiveFailures: 0,
        openedAt: null,
        cooldownUntil: null,
        lastFailureReason: null,
        lastStateChange: new Date().toISOString(),
      };
    }
    return JSON.parse(raw);
  } catch (err: any) {
    return {
      providerId,
      state: "UNKNOWN",
      error: err?.message || String(err),
    };
  }
}

export async function resetCircuitBreakerStatus(providerId = "siray") {
  const client = getRedisClient();
  const def = {
    providerId,
    state: "CLOSED",
    consecutiveFailures: 0,
    openedAt: null,
    cooldownUntil: null,
    lastFailureReason: null,
    lastStateChange: new Date().toISOString(),
  };
  await client.set(`circuit_breaker:${providerId}`, JSON.stringify(def));
  return def;
}

