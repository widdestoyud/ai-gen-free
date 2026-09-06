import {
  JobErrorCodes,
  RetryableProviderError,
  TerminalProviderError,
  type CanonicalGenerateInput,
  type Capability,
  type GenerationProvider,
  type ProviderHandle,
  type ProviderStatus,
} from "@ai-gen-free/core";
import { classifySirayFailure, classifySirayHttpStatus, mapSirayStatus, parseSirayProgress } from "./map.js";
import { TokenBucket } from "./token-bucket.js";

export type SirayFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type SirayProviderOptions = {
  token?: string;
  apiBase?: string;
  fetch?: SirayFetch;
  bucket?: TokenBucket;
};

type SirayTaskData = {
  task_id?: string;
  status?: string;
  progress?: string | number;
  outputs?: unknown;
  output?: unknown;
  fail_code?: string;
  fail_reason?: string;
};

export class SirayProvider implements GenerationProvider {
  readonly id = "siray";
  readonly capabilities: Capability[] = ["t2i", "i2i", "t2v", "i2v"];

  private readonly token: string;
  private readonly apiBase: string;
  private readonly fetchImpl: SirayFetch;
  private readonly bucket: TokenBucket;

  constructor(opts: SirayProviderOptions = {}) {
    this.token = (opts.token ?? process.env.SIRAY_API_TOKEN ?? "").trim();
    this.apiBase = (opts.apiBase ?? process.env.SIRAY_API_BASE ?? "https://api.siray.ai").replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
    this.bucket = opts.bucket ?? new TokenBucket();
  }

  async submit(input: CanonicalGenerateInput): Promise<ProviderHandle> {
    this.assertConfigured();
    this.assertRateLimit();
    const aspectRatio = typeof input.params.aspectRatio === "string" ? input.params.aspectRatio : "1:1";
    const payload = {
      model: input.modelId,
      prompt: input.prompt,
      aspect_ratio: aspectRatio,
    };
    const json = await this.requestJson("POST", "/v1/images/generations/async", payload);
    const taskId = json.data?.task_id;
    if (!taskId) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_ERROR, "Siray submit missing task_id");
    }
    return { providerId: this.id, providerJobId: taskId };
  }

  async getStatus(handle: ProviderHandle): Promise<ProviderStatus> {
    this.assertConfigured();
    this.assertRateLimit();
    const path = `/v1/images/generations/async/${encodeURIComponent(handle.providerJobId)}`;
    const json = await this.requestJson("GET", path);
    const data = json.data ?? {};
    const state = mapSirayStatus(data.status);
    if (!state) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_ERROR, "Siray status tidak dikenal");
    }
    if (state === "failed") {
      return {
        state,
        errorCode: classifySirayFailure(data.fail_code),
        progress: parseSirayProgress(data.progress),
      };
    }
    return {
      state,
      progress: parseSirayProgress(data.progress),
      outputUrls: state === "succeeded" ? collectOutputUrls(data) : undefined,
    };
  }

  private assertConfigured(): void {
    if (!this.token) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_NOT_CONFIGURED, "SIRAY_API_TOKEN kosong");
    }
  }

  private assertRateLimit(): void {
    if (!this.bucket.take()) {
      throw new RetryableProviderError("Siray token bucket empty");
    }
  }

  private async requestJson(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<{ code?: string; message?: string; fail_code?: string; data?: SirayTaskData }> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.apiBase}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: "follow",
      });
    } catch (err) {
      throw new RetryableProviderError("Siray network error", { cause: err });
    }

    const parsed = await readJson(res);
    const failCode = failCodeOf(parsed);
    if (res.status === 429 || isOverloaded(parsed, res.status)) {
      throw new RetryableProviderError(`Siray HTTP ${res.status}`);
    }
    if (!res.ok) {
      const classified = classifySirayHttpStatus(res.status, failCode);
      if (classified.retryable) {
        throw new RetryableProviderError(`Siray HTTP ${res.status}`);
      }
      throw new TerminalProviderError(classified.errorCode, `Siray HTTP ${res.status}`);
    }
    if (typeof parsed.code === "string" && parsed.code && parsed.code !== "success") {
      const classified = classifySirayHttpStatus(400, failCode ?? parsed.code);
      throw new TerminalProviderError(classified.errorCode, parsed.message ?? parsed.code);
    }
    return parsed;
  }
}

function collectOutputUrls(data: SirayTaskData): string[] {
  const raw = data.outputs ?? data.output;
  if (typeof raw === "string" && raw) return [raw];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function failCodeOf(parsed: { fail_code?: string; data?: SirayTaskData; code?: string }): string | undefined {
  return parsed.data?.fail_code || parsed.fail_code || undefined;
}

function isOverloaded(parsed: { code?: string; message?: string; fail_code?: string }, httpStatus: number): boolean {
  if (httpStatus >= 500) return true;
  const blob = `${parsed.code ?? ""} ${parsed.message ?? ""} ${parsed.fail_code ?? ""}`.toLowerCase();
  return blob.includes("serveroverloaded") || blob.includes("server overloaded");
}

async function readJson(
  res: Response,
): Promise<{ code?: string; message?: string; fail_code?: string; data?: SirayTaskData }> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { code?: string; message?: string; fail_code?: string; data?: SirayTaskData };
  } catch {
    return { message: text.slice(0, 200) };
  }
}
