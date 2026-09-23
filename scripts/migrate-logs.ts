import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ParsedLogEntry = {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  service: "api" | "worker" | "web" | "siray" | "storage";
  event: string;
  message: string;
  transactionId?: string;
  userId?: string;
  jobId?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
  error?: Record<string, unknown>;
  context?: Record<string, unknown>;
};

function redactLargeBase64(obj: unknown): unknown {
  if (typeof obj === "string") {
    if (obj.startsWith("data:image/") && obj.includes(";base64,")) {
      const mime = obj.slice(5, obj.indexOf(";"));
      return `[redacted_base64 length=${obj.length} mime=${mime}]`;
    }
    if (obj.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(obj.slice(0, 100))) {
      return `[redacted_base64 length=${obj.length}]`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactLargeBase64);
  }
  if (obj !== null && typeof obj === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = redactLargeBase64(v);
    }
    return res;
  }
  return obj;
}

function parseBlock(blockText: string, defaultJobId?: string): ParsedLogEntry[] {
  const lines = blockText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && l !== "-----");
  if (lines.length === 0) return [];

  const entries: ParsedLogEntry[] = [];
  const fields: Record<string, string> = {};
  const noteLines: string[] = [];

  for (const line of lines) {
    if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      noteLines.push(line);
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx > 0) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim();
      fields[key] = val;
    }
  }

  // If we have time / http / phase
  if (fields.time) {
    const timestamp = new Date(fields.time);
    const validTime = !Number.isNaN(timestamp.getTime()) ? timestamp : new Date();
    const jobId = fields.jobId || defaultJobId;
    const httpRaw = fields.http || "";
    const [httpMethod, httpPath] = httpRaw.includes(" ") ? httpRaw.split(" ") : [undefined, httpRaw || undefined];
    const httpStatus = fields.httpStatus ? Number(fields.httpStatus) : undefined;
    const phase = fields.phase || "request";

    let reqObj: unknown;
    if (fields.request) {
      try {
        reqObj = redactLargeBase64(JSON.parse(fields.request));
      } catch {
        reqObj = fields.request;
      }
    }

    let resObj: unknown;
    if (fields.response) {
      try {
        resObj = redactLargeBase64(JSON.parse(fields.response));
      } catch {
        resObj = fields.response;
      }
    }

    const isError = Boolean(
      (httpStatus && httpStatus >= 400) ||
      fields.error ||
      fields.sirayFailCode ||
      (fields.sirayCode && fields.sirayCode !== "success" && fields.sirayCode !== "0")
    );

    const level = isError ? "error" : "info";
    const event = `siray.${phase}.${isError ? "failed" : "succeeded"}`;
    const message = isError
      ? `Siray HTTP ${httpStatus || "ERR"} [${fields.sirayCode || fields.sirayFailCode || "error"}]: ${fields.sirayMessage || fields.error || "Provider call failed"}`
      : `Siray ${fields.phase || "call"} ${httpMethod || ""} ${httpPath || ""} berhasil (${httpStatus || 200})`;

    entries.push({
      timestamp: validTime,
      level,
      service: "siray",
      event,
      message,
      jobId,
      transactionId: jobId ? `tx-legacy-${jobId.slice(-8)}` : undefined,
      httpMethod,
      httpPath,
      httpStatus,
      error: isError
        ? {
            code: fields.sirayCode || fields.sirayFailCode,
            message: fields.sirayMessage || fields.error,
            rawError: fields.error,
          }
        : undefined,
      context: {
        phase: fields.phase,
        sirayTaskId: fields.sirayTaskId,
        sirayStatus: fields.sirayStatus,
        sirayProgress: fields.sirayProgress,
        request: reqObj,
        response: resObj,
      },
    });
  }

  // Parse trailing RESULT / STORED / note lines
  for (const nl of noteLines) {
    const parts = nl.split(" ");
    const timeStr = parts[0];
    const rest = parts.slice(1).join(" ");
    const timestamp = new Date(timeStr);
    const validTime = !Number.isNaN(timestamp.getTime()) ? timestamp : new Date();

    if (rest.startsWith("RESULT=failed")) {
      const kv: Record<string, string> = {};
      const pairs = rest.replace("RESULT=failed", "").trim();
      const matchJob = pairs.match(/jobId=([^\s]+)/);
      const matchSource = pairs.match(/source=([^\s]+)/);
      const matchCode = pairs.match(/errorCode=([^\s]+)/);
      const matchMsg = pairs.match(/message=(.*?)(?=\shint=|$)/);
      const matchHint = pairs.match(/hint=(.*)$/);

      const jId = matchJob ? matchJob[1] : defaultJobId;
      entries.push({
        timestamp: validTime,
        level: "error",
        service: "worker",
        event: "job.failed",
        message: matchMsg ? matchMsg[1] : "Job generate gagal",
        jobId: jId,
        transactionId: jId ? `tx-legacy-${jId.slice(-8)}` : undefined,
        error: {
          source: matchSource ? matchSource[1] : "worker",
          errorCode: matchCode ? matchCode[1] : "FAILED",
          hint: matchHint ? matchHint[1] : undefined,
        },
      });
    } else if (rest.startsWith("RESULT=succeeded")) {
      const matchJob = rest.match(/jobId=([^\s]+)/);
      const jId = matchJob ? matchJob[1] : defaultJobId;
      entries.push({
        timestamp: validTime,
        level: "info",
        service: "worker",
        event: "job.succeeded",
        message: "Job generate selesai dan berhasil disimpan",
        jobId: jId,
        transactionId: jId ? `tx-legacy-${jId.slice(-8)}` : undefined,
      });
    } else if (rest.startsWith("STORED")) {
      const matchJob = rest.match(/jobId=([^\s]+)/);
      const matchKey = rest.match(/key=([^\s]+)/);
      const matchBytes = rest.match(/bytes=([^\s]+)/);
      const matchType = rest.match(/type=([^\s]+)/);
      const jId = matchJob ? matchJob[1] : defaultJobId;

      // Extract userId from key if available (e.g. outputs/{userId}/{jobId}.webp)
      let extractedUserId: string | undefined;
      if (matchKey) {
        const segs = matchKey[1].split("/");
        if (segs.length >= 3 && segs[0] === "outputs") {
          extractedUserId = segs[1];
        }
      }

      entries.push({
        timestamp: validTime,
        level: "info",
        service: "storage",
        event: "output.stored",
        message: `Berkas render berhasil diunggah ke storage: ${matchKey ? matchKey[1] : ""}`,
        jobId: jId,
        userId: extractedUserId,
        transactionId: jId ? `tx-legacy-${jId.slice(-8)}` : undefined,
        context: {
          storageKey: matchKey ? matchKey[1] : undefined,
          bytes: matchBytes ? Number(matchBytes[1]) : undefined,
          contentType: matchType ? matchType[1] : undefined,
        },
      });
    } else if (rest.startsWith("SIRAY_SUCCESS")) {
      const matchJob = rest.match(/jobId=([^\s]+)/);
      const jId = matchJob ? matchJob[1] : defaultJobId;
      entries.push({
        timestamp: validTime,
        level: "info",
        service: "siray",
        event: "siray.completed",
        message: `Siray provider menandai job selesai: ${rest}`,
        jobId: jId,
        transactionId: jId ? `tx-legacy-${jId.slice(-8)}` : undefined,
      });
    }
  }

  return entries;
}

async function migrate() {
  console.log("Starting log migration from logs/...");
  const logsDir = join(process.cwd(), "logs");
  const sirayDir = join(logsDir, "siray");

  // Pre-fetch all jobs in DB to map jobId -> userId
  console.log("Loading jobs from DB for userId correlation...");
  const existingJobs = await prisma.job.findMany({
    select: { id: true, userId: true },
  });
  const jobToUser = new Map<string, string>();
  for (const j of existingJobs) {
    jobToUser.set(j.id, j.userId);
  }
  console.log(`Found ${jobToUser.size} jobs in DB.`);

  const files = await readdir(sirayDir);
  console.log(`Found ${files.length} files in logs/siray.`);

  const dedupeSet = new Set<string>();
  const toInsert: ParsedLogEntry[] = [];

  for (const file of files) {
    if (!file.endsWith(".txt")) continue;
    const defaultJobId = file.startsWith("cmu") || file.startsWith("cmt") ? file.replace(".txt", "") : undefined;
    const content = await readFile(join(sirayDir, file), "utf8");

    // Split by "-----" blocks
    const rawBlocks = content.split(/(?:^|\n)-----\n?/);
    for (const raw of rawBlocks) {
      if (!raw.trim()) continue;
      const parsed = parseBlock(raw, defaultJobId);
      for (const entry of parsed) {
        // Correlate userId from DB if not already set
        if (!entry.userId && entry.jobId && jobToUser.has(entry.jobId)) {
          entry.userId = jobToUser.get(entry.jobId);
        }

        // Deduplication key
        const key = `${entry.jobId || "nojob"}_${entry.timestamp.toISOString()}_${entry.event}_${entry.httpPath || ""}`;
        if (dedupeSet.has(key)) continue;
        dedupeSet.add(key);
        toInsert.push(entry);
      }
    }
  }

  console.log(`Parsed ${toInsert.length} unique log entries to insert.`);

  // Batch insert into SystemLog
  let inserted = 0;
  const batchSize = 100;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    await prisma.systemLog.createMany({
      data: batch.map((item) => ({
        timestamp: item.timestamp,
        level: item.level,
        service: item.service,
        event: item.event,
        message: item.message,
        transactionId: item.transactionId,
        userId: item.userId,
        jobId: item.jobId,
        httpMethod: item.httpMethod,
        httpPath: item.httpPath,
        httpStatus: item.httpStatus,
        error: (item.error as any) ?? undefined,
        context: (item.context as any) ?? undefined,
      })),
    });
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${toInsert.length} logs...`);
  }

  console.log(`Migration complete! Total ${inserted} logs successfully stored in SystemLog.`);
}

migrate()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
