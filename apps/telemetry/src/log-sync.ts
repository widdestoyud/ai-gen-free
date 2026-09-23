import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { join } from "node:path";
import { prisma } from "@ai-gen-free/db";

export interface SyncResult {
  scannedFiles: number;
  newEntriesCount: number;
  lastSyncTime: string;
}

let lastSyncResult: SyncResult = {
  scannedFiles: 0,
  newEntriesCount: 0,
  lastSyncTime: new Date().toISOString(),
};

// Track files mtime and size to skip re-parsing unmodified files
const fileMetaCache = new Map<string, { mtimeMs: number; size: number }>();

export function resolveLogsDir(): string | null {
  const envDir = process.env.LOGS_DIR?.trim();
  if (envDir && existsSync(envDir)) return envDir;

  const cwdDir = join(process.cwd(), "logs");
  if (existsSync(cwdDir)) return cwdDir;

  const rootRelDir = join(process.cwd(), "..", "..", "logs");
  if (existsSync(rootRelDir)) return rootRelDir;

  return null;
}

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

interface ParsedEntry {
  timestamp: Date;
  level: string;
  service: string;
  event: string;
  message: string;
  jobId?: string;
  transactionId?: string;
  userId?: string;
  httpMethod?: string;
  httpPath?: string;
  httpStatus?: number;
  error?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

function parseBlock(blockText: string, defaultJobId?: string): ParsedEntry[] {
  const lines = blockText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && l !== "-----");
  if (lines.length === 0) return [];

  const entries: ParsedEntry[] = [];
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
        request: reqObj as any,
        response: resObj as any,
      },
    });
  }

  for (const nl of noteLines) {
    const parts = nl.split(" ");
    const timeStr = parts[0];
    const rest = parts.slice(1).join(" ");
    const timestamp = new Date(timeStr);
    const validTime = !Number.isNaN(timestamp.getTime()) ? timestamp : new Date();

    if (rest.startsWith("RESULT=failed")) {
      const matchJob = rest.match(/jobId=([^\s]+)/);
      const matchSource = rest.match(/source=([^\s]+)/);
      const matchCode = rest.match(/errorCode=([^\s]+)/);
      const matchMsg = rest.match(/message=(.*?)(?=\s*hint=|$)/);
      const matchHint = rest.match(/hint=(.*)$/);

      const resolvedJobId = matchJob ? matchJob[1] : defaultJobId;
      entries.push({
        timestamp: validTime,
        level: "error",
        service: "worker",
        event: "job.failed",
        message: matchMsg ? matchMsg[1].trim() : "Job gagal diproses",
        jobId: resolvedJobId,
        transactionId: resolvedJobId ? `tx-legacy-${resolvedJobId.slice(-8)}` : undefined,
        error: {
          errorCode: matchCode ? matchCode[1] : undefined,
          source: matchSource ? matchSource[1] : undefined,
          hint: matchHint ? matchHint[1].trim() : undefined,
        },
        context: { rawNote: rest },
      });
    } else if (rest.startsWith("RESULT=success")) {
      const matchJob = rest.match(/jobId=([^\s]+)/);
      const resolvedJobId = matchJob ? matchJob[1] : defaultJobId;
      entries.push({
        timestamp: validTime,
        level: "info",
        service: "worker",
        event: "job.succeeded",
        message: "Job berhasil diselesaikan",
        jobId: resolvedJobId,
        transactionId: resolvedJobId ? `tx-legacy-${resolvedJobId.slice(-8)}` : undefined,
        context: { rawNote: rest },
      });
    }
  }

  return entries;
}

export async function syncLogFiles(): Promise<SyncResult> {
  const baseDir = resolveLogsDir();
  if (!baseDir) {
    return lastSyncResult;
  }

  const sirayDir = join(baseDir, "siray");
  const targetDirs = [sirayDir, baseDir].filter((d) => existsSync(d));

  let totalScanned = 0;
  let totalNew = 0;

  for (const dir of targetDirs) {
    let files: string[] = [];
    try {
      const dirEntries = await readdir(dir);
      files = dirEntries.filter((f) => f.endsWith(".txt") || f.endsWith(".log"));
    } catch {
      continue;
    }

    totalScanned += files.length;

    for (const file of files) {
      const fullPath = join(dir, file);
      try {
        const fileStat = await stat(fullPath);
        const cached = fileMetaCache.get(fullPath);

        // Skip if file hasn't changed
        if (cached && cached.mtimeMs === fileStat.mtimeMs && cached.size === fileStat.size) {
          continue;
        }

        const content = await readFile(fullPath, "utf8");
        const defaultJobId = file.endsWith(".txt") ? file.replace(/\.txt$/, "") : undefined;

        // Split by delimiter '-----' or parse lines
        const rawBlocks = content.split("-----");
        const parsedEntries: ParsedEntry[] = [];

        for (const raw of rawBlocks) {
          const trimmed = raw.trim();
          if (!trimmed) continue;
          const parsed = parseBlock(trimmed, defaultJobId);
          parsedEntries.push(...parsed);
        }

        if (parsedEntries.length === 0) {
          fileMetaCache.set(fullPath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size });
          continue;
        }

        // Correlate jobs with user ID
        const jobIds = Array.from(new Set(parsedEntries.map((e) => e.jobId).filter((id): id is string => Boolean(id))));
        const jobUserMap = new Map<string, string>();

        if (jobIds.length > 0) {
          const foundJobs = await prisma.job.findMany({
            where: { id: { in: jobIds } },
            select: { id: true, userId: true },
          });
          for (const j of foundJobs) {
            jobUserMap.set(j.id, j.userId);
          }
        }

        // Deduplicate against database
        const timestamps = parsedEntries.map((e) => e.timestamp);
        const existingLogs = await prisma.systemLog.findMany({
          where: {
            timestamp: { in: timestamps },
            jobId: jobIds.length > 0 ? { in: jobIds } : undefined,
          },
          select: { timestamp: true, jobId: true, event: true, httpPath: true },
        });

        const existingSet = new Set(
          existingLogs.map((l) => `${l.jobId ?? ""}_${l.timestamp.toISOString()}_${l.event}_${l.httpPath ?? ""}`)
        );

        const newEntries: ParsedEntry[] = [];
        for (const entry of parsedEntries) {
          const key = `${entry.jobId ?? ""}_${entry.timestamp.toISOString()}_${entry.event}_${entry.httpPath ?? ""}`;
          if (!existingSet.has(key)) {
            existingSet.add(key);
            if (entry.jobId && jobUserMap.has(entry.jobId)) {
              entry.userId = jobUserMap.get(entry.jobId);
            }
            newEntries.push(entry);
          }
        }

        if (newEntries.length > 0) {
          await prisma.systemLog.createMany({
            data: newEntries.map((e) => ({
              timestamp: e.timestamp,
              level: e.level,
              service: e.service,
              event: e.event,
              message: e.message,
              jobId: e.jobId,
              transactionId: e.transactionId,
              userId: e.userId,
              httpMethod: e.httpMethod,
              httpPath: e.httpPath,
              httpStatus: e.httpStatus,
              error: e.error as any,
              context: e.context as any,
            })),
          });
          totalNew += newEntries.length;
        }

        fileMetaCache.set(fullPath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size });
      } catch (err) {
        console.error(`Error syncing log file ${fullPath}:`, err);
      }
    }
  }

  lastSyncResult = {
    scannedFiles: totalScanned,
    newEntriesCount: totalNew,
    lastSyncTime: new Date().toISOString(),
  };

  return lastSyncResult;
}

let isSyncing = false;

export function triggerDebouncedSync(): void {
  if (isSyncing) return;
  isSyncing = true;
  setTimeout(async () => {
    try {
      await syncLogFiles();
    } catch (err) {
      console.error("Auto log sync failed:", err);
    } finally {
      isSyncing = false;
    }
  }, 500);
}

export function startLogWatcher(): () => void {
  // Initial sync immediately
  syncLogFiles().catch(console.error);

  const baseDir = resolveLogsDir();
  const watchers: Array<{ close: () => void }> = [];

  if (baseDir && existsSync(baseDir)) {
    try {
      const w1 = watch(baseDir, { recursive: true }, () => {
        triggerDebouncedSync();
      });
      watchers.push(w1);
    } catch {
      // ignore
    }

    const sirayDir = join(baseDir, "siray");
    if (existsSync(sirayDir)) {
      try {
        const w2 = watch(sirayDir, () => {
          triggerDebouncedSync();
        });
        watchers.push(w2);
      } catch {
        // ignore
      }
    }
  }

  // Backup interval poll every 4 seconds to catch Docker volume updates across OS borders
  const intervalTimer = setInterval(() => {
    syncLogFiles().catch(() => {});
  }, 4000);

  return () => {
    clearInterval(intervalTimer);
    for (const w of watchers) {
      try {
        w.close();
      } catch {}
    }
  };
}

export function getLastSyncStatus(): SyncResult {
  return lastSyncResult;
}
