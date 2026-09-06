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
  updateProgress(jobId: string, progressPct: number): Promise<void>;
  hasOutputAsset(jobId: string): Promise<boolean>;
  putOutputAsset(jobId: string, asset: OutputAssetInput): Promise<void>;
  succeed(jobId: string, opts: { userId: string; finishedAt: Date; nextGenerateAt: Date | null }): Promise<void>;
  fail(jobId: string, opts: { errorCode: string; finishedAt: Date }): Promise<void>;
  cooldownSeconds(): Promise<number>;
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
  lastAttempt?: boolean;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

export async function processGenerateJob(opts: ProcessGenerateJobOpts): Promise<void> {
  const now = opts.now ?? (() => new Date());
  const sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const wallet = opts.wallet ?? { captureJob, releaseJob };
  const fetchBytes = opts.fetchBytes ?? ((url) => fetchOutputBytes(url));
  const pollIntervalMs = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const timeoutMs = opts.timeoutMs ?? IMAGE_TIMEOUT_MS;

  const job = await opts.store.get(opts.jobId);
  if (!job || TERMINAL.has(job.status)) return;

  const provider = opts.providers.get(job.providerId);
  if (!provider) {
    await failJob(job, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now);
    return;
  }

  await opts.store.markRunning(job.id, now());
  const running = (await opts.store.get(job.id)) ?? job;
  const startedAt = running.startedAt ?? now();

  let providerJobId = running.providerJobId;
  try {
    if (!providerJobId) {
      const handle = await provider.submit({
        mode: running.mode as Capability,
        modelId: running.modelId,
        prompt: running.prompt,
        params: running.params,
        inputFiles: [],
      });
      providerJobId = handle.providerJobId;
      await opts.store.saveProviderJobId(job.id, providerJobId);
      console.log(JSON.stringify({ event: "job.provider_submitted", jobId: job.id, providerJobId }));
    }

    const handle: ProviderHandle = { providerId: provider.id, providerJobId };
    while (true) {
      if (now().getTime() - startedAt.getTime() > timeoutMs) {
        await failJob(running, JobErrorCodes.PROVIDER_TIMEOUT, opts, wallet, now);
        return;
      }
      const status = await provider.getStatus(handle);
      if (typeof status.progress === "number") {
        await opts.store.updateProgress(job.id, status.progress);
      }
      if (status.state === "failed") {
        await failJob(running, status.errorCode ?? JobErrorCodes.PROVIDER_ERROR, opts, wallet, now);
        return;
      }
      if (status.state === "succeeded") {
        await completeSuccess(running, status.outputUrls ?? [], opts, wallet, now, fetchBytes);
        return;
      }
      await sleep(pollIntervalMs);
    }
  } catch (err) {
    if (isTerminalProviderError(err)) {
      await failJob(running, err.errorCode, opts, wallet, now);
      return;
    }
    if (isRetryableProviderError(err) || isNetworkLike(err)) {
      if (opts.lastAttempt) {
        await failJob(running, JobErrorCodes.PROVIDER_UNAVAILABLE, opts, wallet, now);
        return;
      }
      throw err;
    }
    await failJob(running, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now);
  }
}

async function completeSuccess(
  job: GenerateJobRecord,
  outputUrls: string[],
  opts: ProcessGenerateJobOpts,
  wallet: WalletPort,
  now: () => Date,
  fetchBytes: (url: string) => Promise<FetchedBytes>,
) {
  const already = await opts.store.hasOutputAsset(job.id);
  if (!already) {
    const url = outputUrls[0];
    if (!url) {
      await failJob(job, JobErrorCodes.PROVIDER_ERROR, opts, wallet, now);
      return;
    }
    let fetched: FetchedBytes;
    try {
      fetched = await fetchBytes(url);
      const ext = extensionFor(fetched.contentType);
      const key = `outputs/${job.userId}/${job.id}.${ext}`;
      await opts.storage.put({ key, body: fetched.body, contentType: fetched.contentType });
      await opts.store.putOutputAsset(job.id, {
        storageKey: key,
        contentType: fetched.contentType,
        bytes: fetched.body.byteLength,
        sha256: sha256Hex(fetched.body),
        expiresAt: new Date(now().getTime() + RETENTION_MS),
      });
    } catch (err) {
      if (isTerminalProviderError(err) || isRetryableProviderError(err)) throw err;
      throw new RetryableProviderError("output copy failed", { cause: err });
    }
  }

  await wallet.captureJob({ userId: job.userId, jobId: job.id, amount: job.cost });
  const cooldownSeconds = await opts.store.cooldownSeconds();
  const nextGenerateAt =
    cooldownSeconds > 0 ? new Date(now().getTime() + cooldownSeconds * 1000) : null;
  await opts.store.succeed(job.id, { userId: job.userId, finishedAt: now(), nextGenerateAt });
  console.log(JSON.stringify({ event: "job.completed", jobId: job.id, status: "succeeded" }));
}

async function failJob(
  job: GenerateJobRecord,
  errorCode: string,
  opts: ProcessGenerateJobOpts,
  wallet: WalletPort,
  now: () => Date,
) {
  await wallet.releaseJob({ userId: job.userId, jobId: job.id, amount: job.cost });
  await opts.store.fail(job.id, { errorCode, finishedAt: now() });
  console.log(JSON.stringify({ event: "job.completed", jobId: job.id, status: "failed", errorCode }));
}

function isNetworkLike(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toUpperCase();
  return msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND") || msg.includes("FETCH");
}

function sha256Hex(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}
