import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SirayTraceEvent } from "@ai-gen-free/providers-siray";
import { prisma } from "@ai-gen-free/db";

export type SirayJobLogContext = {
  jobId: string;
  providerJobId?: string;
};

const ctx = new AsyncLocalStorage<SirayJobLogContext>();

export function sirayLogDir(): string {
  return process.env.SIRAY_LOG_DIR?.trim() || join(process.cwd(), "logs", "siray");
}

export function runWithSirayJobLog<T>(jobId: string, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ jobId }, fn);
}

export function rememberSirayTaskId(providerJobId: string): void {
  const current = ctx.getStore();
  if (current) current.providerJobId = providerJobId;
}

export async function appendSirayJobNote(note: string): Promise<void> {
  const store = ctx.getStore();
  if (!store) return;
  await writeToIds(store, `${isoNow()} ${note}\n`);

  // Fail-safe direct persistence to SystemLog
  persistNoteToDb(store.jobId, note).catch(() => {});
}

export async function appendSirayTrace(event: SirayTraceEvent): Promise<void> {
  const store = ctx.getStore();
  const taskId =
    store?.providerJobId ||
    (typeof event.response === "object" && event.response && "data" in event.response
      ? String((event.response as { data?: { task_id?: string } }).data?.task_id ?? "")
      : "");
  if (taskId && store && !store.providerJobId) store.providerJobId = taskId;

  const ids = [store?.jobId, taskId].filter((id): id is string => Boolean(id && id.length > 0));
  if (ids.length === 0) return;

  const block = formatTrace(event, store?.jobId);
  await writeToIds({ jobId: store?.jobId ?? ids[0]!, providerJobId: taskId || store?.providerJobId }, block);

  // Fail-safe direct persistence to SystemLog
  persistTraceToDb(store?.jobId ?? ids[0]!, taskId || store?.providerJobId, event).catch(() => {});
}

async function persistTraceToDb(jobId: string, providerJobId: string | undefined, event: SirayTraceEvent): Promise<void> {
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
        service: "siray",
        event: `siray.${event.phase}.${isError ? "failed" : "succeeded"}`,
        message: isError
          ? `Siray HTTP ${event.httpStatus || "ERR"}: ${event.error || "Provider call failed"}`
          : `Siray ${event.phase} ${event.method} ${event.path} (${event.httpStatus || 200})`,
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

function formatTrace(event: SirayTraceEvent, jobId?: string): string {
  const lines = [
    "-----",
    `time=${event.at}`,
    `phase=${event.phase}`,
    `http=${event.method} ${event.path}`,
  ];
  if (jobId) lines.push(`jobId=${jobId}`);
  if (typeof event.httpStatus === "number") lines.push(`httpStatus=${event.httpStatus}`);
  if (event.error) lines.push(`error=${event.error}`);
  if (event.request !== undefined) lines.push(`request=${safeJson(event.request)}`);
  if (event.response !== undefined) {
    lines.push(`response=${safeJson(event.response)}`);
    const data =
      event.response && typeof event.response === "object"
        ? (event.response as { data?: { status?: string; fail_code?: string; fail_reason?: string; task_id?: string; progress?: unknown } }).data
        : undefined;
    if (data?.task_id) lines.push(`sirayTaskId=${data.task_id}`);
    if (data?.status) lines.push(`sirayStatus=${data.status}`);
    if (data?.progress !== undefined) lines.push(`sirayProgress=${String(data.progress)}`);
    if (data?.fail_code) lines.push(`sirayFailCode=${data.fail_code}`);
    if (data?.fail_reason) lines.push(`sirayFailReason=${data.fail_reason}`);
    const rec = event.response as { code?: string; message?: string };
    if (rec.code) lines.push(`sirayCode=${rec.code}`);
    if (rec.message) lines.push(`sirayMessage=${rec.message}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function writeToIds(ids: SirayJobLogContext, block: string): Promise<void> {
  const names = [ids.jobId, ids.providerJobId].filter((id): id is string => Boolean(id && id.length > 0));
  const unique = [...new Set(names.map(safeFileId))];
  const dir = sirayLogDir();
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
