import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "@ai-gen-free/db";
import { renderDashboardHtml } from "./ui.js";
import {
  fetchRedisServerMetrics,
  fetchBullQueuesMetrics,
  fetchRedisKeyspaceSummary,
  fetchCircuitBreakerStatus,
  resetCircuitBreakerStatus,
} from "./redis-metrics.js";
import { startLogWatcher, syncLogFiles, getLastSyncStatus } from "./log-sync.js";

const port = Number(process.env.TELEMETRY_PORT ?? process.env.PORT ?? 5050);
const host = process.env.TELEMETRY_HOST ?? "0.0.0.0";

const app = Fastify({ logger: false });

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
});

// Serve Splunk-style Dashboard
app.get("/", async (_req, reply) => {
  reply.type("text/html; charset=utf-8");
  return renderDashboardHtml();
});

// Health check
app.get("/health", async () => {
  return { status: "ok", app: "telemetry", port, timestamp: new Date().toISOString() };
});

// Helper to parse query dates
function resolveDateFilter(query: { timeRange?: string; startDate?: string; endDate?: string }): { gte?: Date; lte?: Date } {
  const now = new Date();
  if (query.timeRange === "24h") {
    return { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
  }
  if (query.timeRange === "7d") {
    return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
  }
  if (query.timeRange === "30d") {
    return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
  }
  if (query.startDate || query.endDate) {
    const res: { gte?: Date; lte?: Date } = {};
    if (query.startDate) {
      const s = new Date(query.startDate);
      s.setHours(0, 0, 0, 0);
      res.gte = s;
    }
    if (query.endDate) {
      const e = new Date(query.endDate);
      e.setHours(23, 59, 59, 999);
      res.lte = e;
    }
    return res;
  }
  return {};
}

// Build Prisma Where clause
function buildWhereClause(query: {
  q?: string;
  timeRange?: string;
  startDate?: string;
  endDate?: string;
  level?: string;
  service?: string;
  transactionId?: string;
  jobId?: string;
  userId?: string;
}) {
  const dateFilter = resolveDateFilter(query);
  const where: Record<string, unknown> = {};

  if (dateFilter.gte || dateFilter.lte) {
    where.timestamp = {
      ...(dateFilter.gte ? { gte: dateFilter.gte } : {}),
      ...(dateFilter.lte ? { lte: dateFilter.lte } : {}),
    };
  }

  if (query.level && query.level !== "all") {
    where.level = query.level.toLowerCase();
  }

  if (query.service && query.service !== "all") {
    where.service = query.service.toLowerCase();
  }

  if (query.transactionId && query.transactionId.trim()) {
    where.transactionId = { contains: query.transactionId.trim(), mode: "insensitive" };
  }

  if (query.jobId && query.jobId.trim()) {
    where.jobId = { contains: query.jobId.trim(), mode: "insensitive" };
  }

  if (query.userId && query.userId.trim()) {
    where.userId = { contains: query.userId.trim(), mode: "insensitive" };
  }

  if (query.q && query.q.trim()) {
    const term = query.q.trim();
    where.OR = [
      { message: { contains: term, mode: "insensitive" } },
      { event: { contains: term, mode: "insensitive" } },
      { httpPath: { contains: term, mode: "insensitive" } },
      { transactionId: { contains: term, mode: "insensitive" } },
      { jobId: { contains: term, mode: "insensitive" } },
      { userId: { contains: term, mode: "insensitive" } },
    ];
  }

  return where;
}

// GET /api/logs
app.get("/api/logs", async (req) => {
  const query = (req.query ?? {}) as {
    q?: string;
    timeRange?: string;
    startDate?: string;
    endDate?: string;
    level?: string;
    service?: string;
    transactionId?: string;
    jobId?: string;
    userId?: string;
    page?: string;
    limit?: string;
  };

  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 30)));
  const skip = (page - 1) * limit;

  const where = buildWhereClause(query);

  const [total, rows] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    logs: rows.map((r) => ({
      ...r,
      timestamp: r.timestamp.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  };
});

// GET /api/stats (Metrics & Timeline Histogram)
app.get("/api/stats", async (req) => {
  const query = (req.query ?? {}) as Record<string, string>;
  const where = buildWhereClause(query);

  const [total, errors, warnings, infos] = await Promise.all([
    prisma.systemLog.count({ where }),
    prisma.systemLog.count({ where: { ...where, level: "error" } }),
    prisma.systemLog.count({ where: { ...where, level: "warn" } }),
    prisma.systemLog.count({ where: { ...where, level: "info" } }),
  ]);

  // Aggregate recent days timeline
  const recentLogs = await prisma.systemLog.findMany({
    where,
    select: { timestamp: true, level: true },
    orderBy: { timestamp: "asc" },
    take: 1000,
  });

  const bucketMap = new Map<string, { date: string; total: number; errors: number }>();
  for (const item of recentLogs) {
    const key = item.timestamp.toISOString().slice(0, 10);
    const existing = bucketMap.get(key) ?? { date: key, total: 0, errors: 0 };
    existing.total++;
    if (item.level === "error" || item.level === "fatal") {
      existing.errors++;
    }
    bucketMap.set(key, existing);
  }

  return {
    total,
    errors,
    warnings,
    infos,
    timeline: Array.from(bucketMap.values()),
  };
});

// GET /api/logs/:id
app.get("/api/logs/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const log = await prisma.systemLog.findUnique({ where: { id } });
  if (!log) {
    return reply.status(404).send({ error: "Log entry not found" });
  }
  return log;
});

// POST /api/ingest
app.post("/api/ingest", async (req, reply) => {
  const body = (req.body ?? {}) as {
    timestamp?: string;
    level?: string;
    service?: string;
    event?: string;
    message?: string;
    transactionId?: string;
    userId?: string;
    jobId?: string;
    durationMs?: number;
    httpMethod?: string;
    httpPath?: string;
    httpStatus?: number;
    error?: unknown;
    context?: unknown;
  };

  if (!body.message || !body.event) {
    return reply.status(400).send({ error: "message and event are required" });
  }

  const created = await prisma.systemLog.create({
    data: {
      timestamp: body.timestamp ? new Date(body.timestamp) : new Date(),
      level: body.level?.toLowerCase() || "info",
      service: body.service?.toLowerCase() || "app",
      event: body.event,
      message: body.message,
      transactionId: body.transactionId,
      userId: body.userId,
      jobId: body.jobId,
      durationMs: body.durationMs,
      httpMethod: body.httpMethod,
      httpPath: body.httpPath,
      httpStatus: body.httpStatus,
      error: (body.error as any) ?? undefined,
      context: (body.context as any) ?? undefined,
    },
  });

  return reply.status(201).send({ ok: true, id: created.id });
});

// GET /api/redis/info (Server info & memory)
app.get("/api/redis/info", async () => {
  return fetchRedisServerMetrics();
});

// GET /api/redis/queues (BullMQ queue state & jobs)
app.get("/api/redis/queues", async () => {
  return fetchBullQueuesMetrics();
});

// GET /api/redis/keys (Keyspace breakdown & sample keys)
app.get("/api/redis/keys", async () => {
  return fetchRedisKeyspaceSummary();
});

// GET /api/redis/summary (Consolidated Redis telemetry)
app.get("/api/redis/summary", async () => {
  const [server, queues, keyspace, circuitBreaker] = await Promise.all([
    fetchRedisServerMetrics(),
    fetchBullQueuesMetrics(),
    fetchRedisKeyspaceSummary(),
    fetchCircuitBreakerStatus("siray"),
  ]);
  return {
    server,
    queues,
    keyspace,
    circuitBreaker,
    timestamp: new Date().toISOString(),
  };
});

// POST /api/logs/sync (Sync file logs to database)
app.post("/api/logs/sync", async () => {
  const result = await syncLogFiles();
  return result;
});

// GET /api/logs/sync-status
app.get("/api/logs/sync-status", async () => {
  return getLastSyncStatus();
});

// GET /api/circuit-breaker
app.get("/api/circuit-breaker", async () => {
  return fetchCircuitBreakerStatus("siray");
});

// POST /api/circuit-breaker/reset
app.post("/api/circuit-breaker/reset", async () => {
  return resetCircuitBreakerStatus("siray");
});

// Start background log directory watcher & periodic sync
startLogWatcher();

try {
  await app.listen({ port, host });
  console.log(`\n======================================================`);
  console.log(`  ⚡ Telemetry & Log Observability Dashboard Ready!`);
  console.log(`  🌐 URL  : http://localhost:${port}`);
  console.log(`  🔌 Port : ${port} (Independent Service)`);
  console.log(`  📊 Mode : Splunk-style Tracing (tx, job, user)`);
  console.log(`======================================================\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
