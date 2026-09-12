import {
  JobErrorCodes,
  RetryableProviderError,
  isRetryableProviderError,
  isTerminalProviderError,
  type Capability,
  type GenerationProvider,
  type ObjectStorage,
  type ProviderHandle,
} from "@ai-gen-free/core";
import { captureJob, releaseJob } from "@ai-gen-free/wallet";
import { createHash } from "node:crypto";
import { extensionFor, fetchOutputBytes, type FetchedBytes } from "./fetch-output.js";
import { optimizeOutputImage } from "./optimize-output.js";
import { classifyJobFailure, formatFailureLog, formatFailureNote } from "./failure-source.js";
import { appendSirayJobNote, rememberSirayTaskId } from "./siray-file-log.js";

const RETENTION_MS = 14 * 24 * 60 * 60 * 1000;
const IMAGE_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 4_000;

export type GenerateJobRecord = {
  id: string;
  userId: string;
  status: string;
  cost: number;
  mode: string;
  modelId: string;
  providerId: string;
  providerJobId: string | null;
  prompt: string;
  params: Record<string, unknown>;
  startedAt: Date | null;
  nextGenerateAt: Date | null;
};

export type OutputAssetInput = {
  storageKey: string;
  contentType: string;
  bytes: number;
  sha256: string;
  expiresAt: Date;
};

export type GenerateJobStore = {
  get(jobId: string): Promise<GenerateJobRecord | null>;
  markRunning(jobId: string, startedAt: Date): Promise<void>;
  saveProviderJobId(jobId: string, providerJobId: string): Promise<void>;
  saveProviderOutputUrls(jobId: string, urls: string[]): Promise<void>;
  updateProgress(jobId: string, progressPct: number): Promise<void>;
  hasOutputAsset(jobId: string): Promise<boolean>;
  putOutputAsset(jobId: string, asset: OutputAssetInput): Promise<void>;
  succeed(jobId: string, opts: { userId: string; finishedAt: Date; nextGenerateAt: Date | null }): Promise<void>;
  fail(jobId: string, opts: { errorCode: string; finishedAt: Date }): Promise<void>;
  cooldownSeconds(): Promise<number>;
  listCopyPendingJobIds(olderThan: Date): Promise<string[]>;
};

export type WalletPort = {
  captureJob(opts: { userId: string; jobId: string; amount: number }): Promise<unknown>;
  releaseJob(opts: { userId: string; jobId: string; amount: number }): Promise<unknown>;
};

export type ProcessGenerateJobOpts = {
  jobId: string;
  providers: Map<string, GenerationProvider>;
  storage: ObjectStorage;
  store: GenerateJobStore;
  wallet?: WalletPort;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  fetchBytes?: (url: string) => Promise<FetchedBytes>;
  optimizeImage?: (input: FetchedBytes) => Promise<FetchedBytes>;
  lastAttempt?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
  chaosPauseAfterSuccessMs?: number;
};

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

export async function processGenerateJob(opts: ProcessGenerateJobOpts): Promise<void> {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const wallet = opts.wallet ?? { captureJob, releaseJob };
  const fetchBytes = opts.fetchBytes ?? ((url) => fetchOutputBytes(url));
  const optimizeImage = opts.optimizeImage ?? ((input) => optimizeOutputImage(input));
  const pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? IMAGE_TIMEOUT_MS;
  const chaosPauseAfterSuccessMs =
    opts.chaosPauseAfterSuccessMs ?? Number(process.env.CHAOS_PAUSE_AFTER_SUCCESS_MS ?? 0);

  const job = await opts.store.get(opts.jobId);
  if (!job || TERMINAL.has(job.status)) return;

  const provider = opts.providers.get(job.providerId);
  if (!provider) {
    await failJob(job, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now, {
      sourceHint: "app",
      err: new Error(`adapter providerId=${job.providerId} tidak terdaftar di worker`),
    });
    return;
  }

  await opts.store.markRunning(job.id, now());
  const running = (await opts.store.get(job.id)) ?? job;
  const startedAt = running.startedAt ?? now();

  let providerJobId = running.providerJobId;
  if (providerJobId) rememberSirayTaskId(providerJobId);
  try {
    if (!providerJobId) {
      try {
        await opts.storage.put({
          key: "healthcheck/ping.txt",
          body: new Uint8Array([111, 107]),
          contentType: "text/plain",
        });
      } catch (err) {
        throw new RetryableProviderError(`storage not ready before Siray: ${errorDetail(err)}`, { cause: err });
      }
      const handle = await provider.submit({
        mode: running.mode as Capability,
        modelId: running.modelId,
        prompt: running.prompt,
        params: running.params,
        inputFiles: [],
      });
      providerJobId = handle.providerJobId;
      rememberSirayTaskId(providerJobId);
      await opts.store.saveProviderJobId(job.id, providerJobId);
      console.log(JSON.stringify({ event: "job.provider_submitted", jobId: job.id, providerJobId }));
      await appendSirayJobNote(`RESULT=submitted sirayTaskId=${providerJobId} jobId=${job.id}`);
    }

    const cachedUrls = cachedOutputUrls(running.params);
    if (cachedUrls.length > 0) {
      await completeSuccess(running, cachedUrls, opts, wallet, now, fetchBytes, optimizeImage);
      return;
    }

    const handle: ProviderHandle = { providerId: provider.id, providerJobId };
    while (true) {
      if (now().getTime() - startedAt.getTime() > timeoutMs) {
        await failJob(running, JobErrorCodes.PROVIDER_TIMEOUT, opts, wallet, now, { sourceHint: "siray" });
        return;
      }
      const status = await provider.getStatus(handle);
      if (typeof status.progress === "number") {
        await opts.store.updateProgress(job.id, status.progress);
      }
      if (status.state === "failed") {
        await failJob(running, status.errorCode ?? JobErrorCodes.PROVIDER_ERROR, opts, wallet, now, {
          sourceHint: "siray",
          err: new Error(status.errorCode ?? JobErrorCodes.PROVIDER_ERROR),
        });
        return;
      }
      if (status.state === "succeeded") {
        const urls = status.outputUrls ?? [];
        await appendSirayJobNote(
          `SIRAY_SUCCESS jobId=${job.id} urls=${urls.length} chaosPauseMs=${Number.isFinite(chaosPauseAfterSuccessMs) ? chaosPauseAfterSuccessMs : 0}`,
        );
        await opts.store.saveProviderOutputUrls(job.id, urls);
        running.params = { ...running.params, providerOutputUrls: urls };
        if (Number.isFinite(chaosPauseAfterSuccessMs) && chaosPauseAfterSuccessMs > 0) {
          console.warn(
            JSON.stringify({
              event: "job.chaos_pause_after_success",
              jobId: job.id,
              ms: chaosPauseAfterSuccessMs,
            }),
          );
          await sleep(chaosPauseAfterSuccessMs);
        }
        await completeSuccess(running, urls, opts, wallet, now, fetchBytes, optimizeImage);
        return;
      }
      await sleep(pollIntervalMs);
    }
  } catch (err) {
    if (isTerminalProviderError(err)) {
      await failJob(running, err.errorCode, opts, wallet, now, { err });
      return;
    }
    if (isRetryableProviderError(err) || isNetworkLike(err)) {
      if (opts.lastAttempt) {
        if (shouldDeferCopy(running, err)) {
          await deferCopy(running, err);
          return;
        }
        await failJob(
          running,
          isOutputCopyError(err) ? JobErrorCodes.OUTPUT_COPY_FAILED : JobErrorCodes.PROVIDER_UNAVAILABLE,
          opts,
          wallet,
          now,
          { err },
        );
        return;
      }
      throw err;
    }
    await failJob(running, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now, { err });
  }
}

async function completeSuccess(
  job: GenerateJobRecord,
  outputUrls: string[],
  opts: ProcessGenerateJobOpts,
  wallet: WalletPort,
  now: () => Date,
  fetchBytes: (url: string) => Promise<FetchedBytes>,
  optimizeImage: (input: FetchedBytes) => Promise<FetchedBytes>,
) {
  const already = await opts.store.hasOutputAsset(job.id);
  if (!already) {
    const url = outputUrls[0];
    if (!url) {
      await failJob(job, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now, {
        sourceHint: "siray",
        err: new Error("Siray SUCCESS tanpa URL output"),
      });
      return;
    }
    const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const fetched = await fetchBytes(url);
        let stored: FetchedBytes = fetched;
        try {
          stored = await optimizeImage(fetched);
        } catch (err) {
          await appendSirayJobNote(`OPTIMIZE_SKIP jobId=${job.id} detail=${errorDetail(err)}`);
        }
        const ext = extensionFor(stored.contentType);
        const key = `outputs/${job.userId}/${job.id}.${ext}`;
        await opts.storage.put({ key, body: stored.body, contentType: stored.contentType });
        await opts.store.putOutputAsset(job.id, {
          storageKey: key,
          contentType: stored.contentType,
          bytes: stored.body.byteLength,
          sha256: sha256Hex(stored.body),
          expiresAt: new Date(now().getTime() + RETENTION_MS),
        });
        await appendSirayJobNote(
          `STORED jobId=${job.id} key=${key} bytes=${stored.body.byteLength} type=${stored.contentType}`,
        );
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        const detail = errorDetail(err);
        const classified = classifyJobFailure(JobErrorCodes.OUTPUT_COPY_FAILED, err);
        await appendSirayJobNote(
          `COPY_RETRY jobId=${job.id} attempt=${attempt} source=${classified.source} url=${url} message=${classified.message}`,
        );
        if (isPermanentStorageError(err)) break;
        if (attempt < 3) await sleep(1500 * attempt);
      }
    }
    if (lastErr) {
      const classified = classifyJobFailure(JobErrorCodes.OUTPUT_COPY_FAILED, lastErr);
      await appendSirayJobNote(
        `COPY_FAILED jobId=${job.id} source=${classified.source} url=${url} message=${classified.message} hint=${classified.hint}`,
      );
      console.error(formatFailureLog(classified, { jobId: job.id, phase: "copy" }));
      if (isTerminalProviderError(lastErr) || isRetryableProviderError(lastErr)) throw lastErr;
      throw new RetryableProviderError(`output copy failed: ${classified.message}`, { cause: lastErr });
    }
  }

  await wallet.captureJob({ userId: job.userId, jobId: job.id, amount: job.cost });
  const cooldownSeconds = await opts.store.cooldownSeconds();
  const nextGenerateAt =
    cooldownSeconds > 0 ? new Date(now().getTime() + cooldownSeconds * 1000) : null;
  await opts.store.succeed(job.id, { userId: job.userId, finishedAt: now(), nextGenerateAt });
  console.log(JSON.stringify({ event: "job.completed", jobId: job.id, status: "succeeded" }));
  await appendSirayJobNote(`RESULT=succeeded jobId=${job.id}`);
}

async function failJob(
  job: GenerateJobRecord,
  errorCode: string,
  opts: ProcessGenerateJobOpts,
  wallet: WalletPort,
  now: () => Date,
  extra?: { err?: unknown; sourceHint?: "siray" | "storage" | "app" },
) {
  await wallet.releaseJob({ userId: job.userId, jobId: job.id, amount: job.cost });
  await opts.store.fail(job.id, { errorCode, finishedAt: now() });
  const classified = classifyJobFailure(errorCode, extra?.err);
  if (extra?.sourceHint && classified.source !== extra.sourceHint && !extra.err) {
    classified.source = extra.sourceHint;
  }
  console.error(formatFailureLog(classified, { jobId: job.id, status: "failed" }));
  await appendSirayJobNote(formatFailureNote(classified, job.id));
}

function errorDetail(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? err.cause.message : "";
  return cause ? `${err.name}: ${err.message} (${cause})` : `${err.name}: ${err.message}`;
}

function isOutputCopyError(err: unknown): boolean {
  const text = errorDetail(err);
  return /output copy|output download|HeadBucket|NoSuchBucket|ENOTFOUND|ECONNREFUSED|S3|storage|credentials/i.test(text);
}

function isPermanentStorageError(err: unknown): boolean {
  const text = errorDetail(err);
  return /credentials|InvalidAccessKeyId|SignatureDoesNotMatch|ExpiredToken|AccessDenied|STORAGE_ACCESS_KEY/i.test(
    text,
  );
}

function shouldDeferCopy(job: GenerateJobRecord, err: unknown): boolean {
  if (!job.providerJobId) return false;
  return isOutputCopyError(err) || cachedOutputUrls(job.params).length > 0;
}

async function deferCopy(job: GenerateJobRecord, err: unknown): Promise<void> {
  const classified = classifyJobFailure(JobErrorCodes.OUTPUT_COPY_FAILED, err);
  await appendSirayJobNote(
    `COPY_DEFERRED jobId=${job.id} source=${classified.source} message=${classified.message} hold=kept`,
  );
  console.warn(
    JSON.stringify({
      event: "job.copy_deferred",
      jobId: job.id,
      source: classified.source,
      errorCode: classified.errorCode,
      message: classified.message,
    }),
  );
}

function cachedOutputUrls(params: Record<string, unknown>): string[] {
  const raw = params.providerOutputUrls;
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function isNetworkLike(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toUpperCase();
  return msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND") || msg.includes("FETCH");
}

function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}
