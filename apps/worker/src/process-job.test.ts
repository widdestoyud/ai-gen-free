import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JobErrorCodes,
  RetryableProviderError,
  TerminalProviderError,
  type GenerationProvider,
  type ProviderHandle,
  type ProviderStatus,
} from "@ai-gen-free/core";
import { MemoryObjectStorage } from "@ai-gen-free/storage";
import { DummyProvider, PNG_1X1 } from "./dummy.js";
import { processGenerateJob, type GenerateJobRecord, type GenerateJobStore } from "./process-job.js";

function baseJob(over: Partial<GenerateJobRecord> = {}): GenerateJobRecord {
  return {
    id: "job1",
    userId: "user1",
    status: "queued",
    cost: 10,
    mode: "t2i",
    modelId: "black-forest-labs/flux-1.1-pro-t2i",
    providerId: "siray",
    providerJobId: null,
    prompt: "kucing",
    params: { aspectRatio: "1:1" },
    startedAt: null,
    nextGenerateAt: null,
    ...over,
  };
}

function memoryStore(
  initial: GenerateJobRecord,
  extras?: { cooldownSeconds?: number },
): GenerateJobStore & { job: GenerateJobRecord; assets: number } {
  const state = { job: { ...initial }, assets: 0 };
  return {
    get job() {
      return state.job;
    },
    get assets() {
      return state.assets;
    },
    set assets(n: number) {
      state.assets = n;
    },
    async get() {
      return { ...state.job };
    },
    async markRunning(_id, startedAt) {
      state.job.status = "running";
      state.job.startedAt = state.job.startedAt ?? startedAt;
    },
    async saveProviderJobId(_id, providerJobId) {
      state.job.providerJobId = providerJobId;
    },
    async saveProviderOutputUrls(_id, urls) {
      state.job.params = { ...state.job.params, providerOutputUrls: urls };
    },
    async updateProgress(_id, progressPct) {
      state.job.status = "running";
      void progressPct;
    },
    async hasOutputAsset() {
      return state.assets > 0;
    },
    async putOutputAsset() {
      state.assets += 1;
    },
    async succeed(_id, opts) {
      state.job.status = "succeeded";
      state.job.nextGenerateAt = opts.nextGenerateAt;
    },
    async fail(_id, opts) {
      state.job.status = "failed";
      state.job.nextGenerateAt = state.job.nextGenerateAt;
      (state.job as GenerateJobRecord & { errorCode?: string }).errorCode = opts.errorCode;
    },
    async cooldownSeconds() {
      return extras?.cooldownSeconds ?? 43200;
    },
    async listCopyPendingJobIds() {
      return [];
    },
  };
}

class ScriptedProvider implements GenerationProvider {
  readonly id = "siray";
  readonly capabilities = ["t2i"] as const;
  submits = 0;
  polls = 0;
  constructor(
    private readonly script: {
      submitId?: string;
      statuses: ProviderStatus[];
      submitError?: Error;
      statusError?: Error;
    },
  ) {}
  async submit(): Promise<ProviderHandle> {
    this.submits += 1;
    if (this.script.submitError) throw this.script.submitError;
    return { providerId: this.id, providerJobId: this.script.submitId ?? "task-1" };
  }
  async getStatus(): Promise<ProviderStatus> {
    this.polls += 1;
    if (this.script.statusError) throw this.script.statusError;
    return this.script.statuses[Math.min(this.polls - 1, this.script.statuses.length - 1)]!;
  }
}

test("success: put output then capture then cooldown; no second submit", async () => {
  const store = memoryStore(baseJob());
  const storage = new MemoryObjectStorage();
  const calls: string[] = [];
  const provider = new ScriptedProvider({
    statuses: [
      {
        state: "succeeded",
        outputUrls: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="],
      },
    ],
  });
  const wallet = {
    async captureJob() {
      calls.push("capture");
      assert.equal(store.assets, 1);
      const obj = await storage.get("outputs/user1/job1.png");
      assert.ok(obj.body.byteLength > 0);
      return {};
    },
    async releaseJob() {
      calls.push("release");
      return {};
    },
  };

  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    wallet,
    sleep: async () => {},
    optimizeImage: async (input) => input,
  });

  assert.equal(provider.submits, 1);
  assert.equal(store.job.status, "succeeded");
  assert.ok(store.job.nextGenerateAt);
  assert.deepEqual(calls, ["capture"]);

  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    wallet,
    sleep: async () => {},
    optimizeImage: async (input) => input,
  });
  assert.equal(provider.submits, 1);
  assert.equal(store.assets, 1);
  assert.deepEqual(calls, ["capture"]);
});

test("duplicate poll after asset exists: one capture, one asset", async () => {
  const store = memoryStore(baseJob({ status: "running", providerJobId: "task-1", startedAt: new Date() }));
  store.assets = 1;
  const storage = new MemoryObjectStorage();
  await storage.put({ key: "outputs/user1/job1.png", body: PNG_1X1, contentType: "image/png" });
  let captures = 0;
  const provider = new ScriptedProvider({
    statuses: [{ state: "succeeded", outputUrls: ["https://api.siray.ai/redirect/secret"] }],
  });
  let downloaded = 0;
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    wallet: {
      async captureJob() {
        captures += 1;
        return {};
      },
      async releaseJob() {
        throw new Error("should not release");
      },
    },
    fetchBytes: async () => {
      downloaded += 1;
      return { body: PNG_1X1, contentType: "image/png" };
    },
    sleep: async () => {},
  });
  assert.equal(provider.submits, 0);
  assert.equal(downloaded, 0);
  assert.equal(captures, 1);
  assert.equal(store.assets, 1);
  assert.equal(store.job.status, "succeeded");
});

test("failed job: release hold, no cooldown", async () => {
  const store = memoryStore(baseJob());
  const storage = new MemoryObjectStorage();
  const calls: string[] = [];
  const provider = new ScriptedProvider({
    statuses: [{ state: "failed", errorCode: JobErrorCodes.PROVIDER_POLICY }],
  });
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, ["release"]);
  assert.equal(store.job.status, "failed");
  assert.equal(store.job.nextGenerateAt, null);
  assert.equal((store.job as { errorCode?: string }).errorCode, JobErrorCodes.PROVIDER_POLICY);
});

test("empty token / not configured: release, no cooldown", async () => {
  const store = memoryStore(baseJob());
  const provider = new ScriptedProvider({
    submitError: new TerminalProviderError(JobErrorCodes.PROVIDER_NOT_CONFIGURED, "no token"),
    statuses: [],
  });
  const calls: string[] = [];
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage: new MemoryObjectStorage(),
    store,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, ["release"]);
  assert.equal(store.job.status, "failed");
  assert.equal(store.job.nextGenerateAt, null);
});

test("429 under retry budget is not failed", async () => {
  const store = memoryStore(baseJob());
  const provider = new ScriptedProvider({
    submitError: new RetryableProviderError("Siray HTTP 429"),
    statuses: [],
  });
  await assert.rejects(
    () =>
      processGenerateJob({
        jobId: "job1",
        providers: new Map([["siray", provider]]),
        storage: new MemoryObjectStorage(),
        store,
        lastAttempt: false,
        wallet: {
          async captureJob() {
            throw new Error("no capture");
          },
          async releaseJob() {
            throw new Error("no release");
          },
        },
        sleep: async () => {},
      }),
    (err: unknown) => err instanceof RetryableProviderError,
  );
  assert.equal(store.job.status, "running");
  assert.equal(store.job.nextGenerateAt, null);
});

test("retry exhausted becomes PROVIDER_UNAVAILABLE + release", async () => {
  const store = memoryStore(baseJob({ providerJobId: "task-1", status: "running", startedAt: new Date() }));
  const provider = new ScriptedProvider({
    statusError: new RetryableProviderError("Siray HTTP 503"),
    statuses: [],
  });
  const calls: string[] = [];
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage: new MemoryObjectStorage(),
    store,
    lastAttempt: true,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, ["release"]);
  assert.equal(store.job.status, "failed");
  assert.equal((store.job as { errorCode?: string }).errorCode, JobErrorCodes.PROVIDER_UNAVAILABLE);
  assert.equal(store.job.nextGenerateAt, null);
});

test("transient output copy failure then success stores the file", async () => {
  const store = memoryStore(baseJob({ providerJobId: "task-1", status: "running", startedAt: new Date() }));
  const storage = new MemoryObjectStorage();
  const provider = new ScriptedProvider({
    statuses: [{ state: "succeeded", outputUrls: ["https://api.siray.ai/redirect/out.png"] }],
  });
  let downloads = 0;
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    lastAttempt: false,
    fetchBytes: async () => {
      downloads += 1;
      if (downloads === 1) throw new Error("output download HTTP 503");
      return { body: PNG_1X1, contentType: "image/png" };
    },
    wallet: {
      async captureJob() {
        return {};
      },
      async releaseJob() {
        throw new Error("should not release");
      },
    },
    sleep: async () => {},
  });
  assert.equal(downloads, 2);
  assert.equal(store.job.status, "succeeded");
  assert.equal(store.assets, 1);
});

test("storage failure after Siray SUCCESS keeps hold and does not fail the job", async () => {
  const store = memoryStore(baseJob({ providerJobId: "task-1", status: "running", startedAt: new Date() }));
  const provider = new ScriptedProvider({
    statuses: [{ state: "succeeded", outputUrls: ["https://api.siray.ai/redirect/out.png"] }],
  });
  const inner = new MemoryObjectStorage();
  const storage = {
    driver: "r2",
    async put() {
      const err = new Error("Could not load credentials from any providers");
      err.name = "CredentialsProviderError";
      throw err;
    },
    get: inner.get.bind(inner),
    delete: inner.delete.bind(inner),
    signGetUrl: inner.signGetUrl.bind(inner),
  };
  const calls: string[] = [];
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    lastAttempt: true,
    fetchBytes: async () => ({ body: PNG_1X1, contentType: "image/png" }),
    optimizeImage: async (input) => input,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, []);
  assert.equal(store.job.status, "running");
  assert.equal(provider.polls, 1);
  assert.deepEqual(store.job.params.providerOutputUrls, ["https://api.siray.ai/redirect/out.png"]);
});

test("cached provider output URLs skip getStatus and copy immediately", async () => {
  const store = memoryStore(
    baseJob({
      providerJobId: "task-1",
      status: "running",
      startedAt: new Date(),
      params: { providerOutputUrls: ["https://api.siray.ai/redirect/cached.png"] },
    }),
  );
  const storage = new MemoryObjectStorage();
  const provider = new ScriptedProvider({
    statusError: new Error("should not poll"),
    statuses: [],
  });
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    fetchBytes: async (url) => {
      assert.equal(url, "https://api.siray.ai/redirect/cached.png");
      return { body: PNG_1X1, contentType: "image/png" };
    },
    optimizeImage: async (input) => input,
    wallet: {
      async captureJob() {
        return {};
      },
      async releaseJob() {
        throw new Error("should not release");
      },
    },
    sleep: async () => {},
  });
  assert.equal(provider.polls, 0);
  assert.equal(store.job.status, "succeeded");
  assert.equal(store.assets, 1);
});

test("output copy failure after Siray SUCCESS defers delivery, does not W006/release", async () => {
  const store = memoryStore(baseJob({ providerJobId: "task-1", status: "running", startedAt: new Date() }));
  const provider = new ScriptedProvider({
    statuses: [{ state: "succeeded", outputUrls: ["https://api.siray.ai/redirect/out.png"] }],
  });
  const calls: string[] = [];
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage: new MemoryObjectStorage(),
    store,
    lastAttempt: true,
    fetchBytes: async () => {
      throw new Error("output download HTTP 403");
    },
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, []);
  assert.equal(store.job.status, "running");
});

test("timeout 5 minutes: release, no cooldown", async () => {
  const startedAt = new Date("2026-01-01T00:00:00Z");
  const store = memoryStore(baseJob({ startedAt, status: "running", providerJobId: "task-1" }));
  const provider = new ScriptedProvider({ statuses: [{ state: "running", progress: 10 }] });
  let nowMs = startedAt.getTime() + 6 * 60 * 1000;
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage: new MemoryObjectStorage(),
    store,
    now: () => new Date(nowMs),
    wallet: {
      async captureJob() {
        return {};
      },
      async releaseJob() {
        return {};
      },
    },
    sleep: async () => {},
    timeoutMs: 5 * 60 * 1000,
  });
  assert.equal(store.job.status, "failed");
  assert.equal((store.job as { errorCode?: string }).errorCode, JobErrorCodes.PROVIDER_TIMEOUT);
  assert.equal(store.job.nextGenerateAt, null);
});

test("cooldown 0 does not set nextGenerateAt after capture", async () => {
  const store = memoryStore(baseJob(), { cooldownSeconds: 0 });
  const storage = new MemoryObjectStorage();
  const calls: string[] = [];
  const provider = new ScriptedProvider({
    statuses: [
      {
        state: "succeeded",
        outputUrls: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="],
      },
    ],
  });
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
    optimizeImage: async (input) => input,
  });
  assert.deepEqual(calls, ["capture"]);
  assert.equal(store.job.status, "succeeded");
  assert.equal(store.job.nextGenerateAt, null);
});

test("optimized webp is stored under outputs/{userId}/{jobId}.webp, never a Siray URL", async () => {
  const store = memoryStore(baseJob({ providerJobId: "task-1", status: "running", startedAt: new Date() }));
  const storage = new MemoryObjectStorage();
  const provider = new ScriptedProvider({
    statuses: [{ state: "succeeded", outputUrls: ["https://api.siray.ai/redirect/secret.png"] }],
  });
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["siray", provider]]),
    storage,
    store,
    fetchBytes: async () => ({ body: PNG_1X1, contentType: "image/png" }),
    optimizeImage: async () => ({ body: webp, contentType: "image/webp" }),
    wallet: {
      async captureJob() {
        const obj = await storage.get("outputs/user1/job1.webp");
        assert.equal(obj.contentType, "image/webp");
        assert.deepEqual(obj.body, webp);
        return {};
      },
      async releaseJob() {
        throw new Error("should not release");
      },
    },
    sleep: async () => {},
  });
  assert.equal(store.job.status, "succeeded");
});

test("dummy fail uses release without cooldown", async () => {
  const store = memoryStore(baseJob({ providerId: "dummy", modelId: "dummy-t2i", params: { fail: true } }));
  const calls: string[] = [];
  await processGenerateJob({
    jobId: "job1",
    providers: new Map([["dummy", new DummyProvider()]]),
    storage: new MemoryObjectStorage(),
    store,
    wallet: {
      async captureJob() {
        calls.push("capture");
        return {};
      },
      async releaseJob() {
        calls.push("release");
        return {};
      },
    },
    sleep: async () => {},
  });
  assert.deepEqual(calls, ["release"]);
  assert.equal(store.job.status, "failed");
  assert.equal(store.job.nextGenerateAt, null);
});
