import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { FalTraceEvent } from "@ai-gen-free/providers-fal";
import { prisma } from "@ai-gen-free/db";

export type FalJobLogContext = {
  jobId: string;
  providerJobId?: string;
};

const ctx = new AsyncLocalStorage<FalJobLogContext>();

export function falLogDir(): string {
  return process.env.FAL_LOG_DIR?.trim() || join(process.cwd(), "logs", "fal");
}

export function runWithFalJobLog<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ jobId }, fn);
}

export function rememberFalTaskId(providerJobId: string): void {
  const current = ctx.getStore();
  if (current) current.providerJobId = providerJobId;
}

export async function appendFalJobNote(note: string): Promise<void> {
  const store = ctx.getStore();
  if (!store) return;
  await writeToIds(store, `${isoNow()} ${note}\n`);

  // Fail-safe direct persistence to SystemLog
  persistNoteToDb(store.jobId, note).catch(() => {});
}

export async function appendFalTrace(event: FalTraceEvent): Promise<void> {
  const store = ctx.getStore();
  const requestId =
    store?.providerJobId ||
    (typeof event.response === "object" && event.response && "request_id" in event.response
      ? String((event.response as { request_id?: string }).request_id ?? "")
      : "");
  if (requestId && store && !store.providerJobId) store.providerJobId = requestId;

  const ids = [store?.jobId, requestId].filter((id): id is string => Boolean(id && id.length > 0));
  if (ids.length === 0) return;

  const block = formatTrace(event, store?.jobId);
  await writeToIds({ jobId: store?.jobId ?? ids[0]!, providerJobId: requestId || store?.providerJobId }, block);

  // Fail-safe direct persistence to SystemLog
  persistTraceToDb(store?.jobId ?? ids[0]!, requestId || store?.providerJobId, event).catch(() => {});
}

async function persistTraceToDb(jobId: string, providerJobId: string | undefined, event: FalTraceEvent): Promise<void> {
  try {
    const isError = Boolean(
      (typeof event.httpStatus === "number" && event.httpStatus >= 400) ||
      event.error
    );
    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { userId: true } }).catch(() => null);

    await prisma.systemLog.create({
      data: {
        timestamp: new Date(event.at),
        level: isError ? "error" : "info",
        service: "falai",
        event: `fal.${event.phase}.${isError ? "failed" : "succeeded"}`,
        message: isError
          ? `fal.ai HTTP ${event.httpStatus || "ERR"}: ${event.error || "Provider call failed"}`
          : `fal.ai ${event.phase} ${event.method} ${event.path} (${event.httpStatus || 200})`,
        jobId,
        transactionId: `tx-legacy-${jobId.slice(-8)}`,
        userId: job?.userId,
        httpMethod: event.method,
        httpPath: event.path,
        httpStatus: event.httpStatus,
        error: isError ? { error: event.error } : undefined,
        context: {
          phase: event.phase,
          providerJobId,
        },
      },
    });
  } catch {
    // Fail-safe
  }
}

async function persistNoteToDb(jobId: string, note: string): Promise<void> {
  try {
    const isFailed = note.includes("RESULT=failed");
    const isSuccess = note.includes("RESULT=success");
    if (!isFailed && !isSuccess) return;

    const job = await prisma.job.findUnique({ where: { id: jobId }, select: { userId: true } }).catch(() => null);

    const matchCode = note.match(/errorCode=([^\s]+)/);
    const matchMsg = note.match(/message=(.*?)(?=\s*hint=|$)/);
    const matchHint = note.match(/hint=(.*)$/);

    await prisma.systemLog.create({
      data: {
        timestamp: new Date(),
        level: isFailed ? "error" : "info",
        service: "worker",
        event: isFailed ? "job.failed" : "job.succeeded",
        message: matchMsg ? matchMsg[1].trim() : (isFailed ? "Job gagal diproses" : "Job selesai"),
        jobId,
        transactionId: `tx-legacy-${jobId.slice(-8)}`,
        userId: job?.userId,
        error: isFailed
          ? {
              errorCode: matchCode ? matchCode[1] : undefined,
              hint: matchHint ? matchHint[1].trim() : undefined,
            }
          : undefined,
        context: { note },
      },
    });
  } catch {
    // Fail-safe
  }
}

function formatTrace(event: FalTraceEvent, jobId?: string): string {
  const lines = [
    "-----",
    `time=${event.at}`,
    `provider=falai`,
    `phase=${event.phase}`,
    `http=${event.method} ${event.path}`,
  ];
  if (jobId) lines.push(`jobId=${jobId}`);
  if (typeof event.httpStatus === "number") lines.push(`httpStatus=${event.httpStatus}`);
  if (event.error) lines.push(`error=${event.error}`);
  if (event.request !== undefined) lines.push(`request=${safeJson(event.request)}`);
  if (event.response !== undefined) {
    lines.push(`response=${safeJson(event.response)}`);
    const resp = event.response as Record<string, unknown> | undefined;
    if (resp?.request_id) lines.push(`falRequestId=${String(resp.request_id)}`);
    if (resp?.status) lines.push(`falStatus=${String(resp.status)}`);
    if (resp?.queue_position !== undefined) lines.push(`falQueuePosition=${String(resp.queue_position)}`);
    if (resp?.detail) lines.push(`falDetail=${safeJson(resp.detail)}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function writeToIds(ids: FalJobLogContext, block: string): Promise<void> {
  const names = [ids.jobId, ids.providerJobId].filter((id): id is string => Boolean(id && id.length > 0));
  const unique = [...new Set(names.map(safeFileId))];
  const dir = falLogDir();
  await mkdir(dir, { recursive: true });
  await Promise.all(unique.map((name) => appendFile(join(dir, `${name}.txt`), block, "utf8")));
}

function safeFileId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return cleaned.length > 0 ? cleaned : "unknown";
}

function safeJson(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
  } catch {
    return "[unserializable]";
  }
}

function isoNow(): string {
  return new Date().toISOString();
}
