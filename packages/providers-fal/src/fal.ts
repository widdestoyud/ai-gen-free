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
import { classifyFalFailure, classifyFalHttpStatus, mapFalStatus, parseFalProgress } from "./map.js";
import { TokenBucket } from "./token-bucket.js";

export type FalFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type FalTraceEvent = {
  at: string;
  phase: "submit" | "poll" | "error";
  method: "GET" | "POST";
  path: string;
  httpStatus?: number;
  request?: unknown;
  response?: unknown;
  error?: string;
};

export type FalTrace = (event: FalTraceEvent) => void | Promise<void>;

export type FalProviderOptions = {
  token?: string;
  key?: string;
  apiBase?: string;
  fetch?: FalFetch;
  bucket?: TokenBucket;
  onTrace?: FalTrace;
};

export type FalQueueResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  cancel_url?: string;
  status?: string;
  queue_position?: number;
  logs?: Array<{ message?: string; level?: string }>;
  error?: unknown;
  detail?: unknown;
  images?: Array<{ url?: string; content_type?: string }>;
  image?: { url?: string } | string;
  video?: { url?: string } | string;
  videos?: Array<{ url?: string }>;
  video_url?: string;
  outputs?: unknown[];
};

export class FalProvider implements GenerationProvider {
  readonly id = "falai";
  readonly capabilities: Capability[] = ["t2i", "i2i", "t2v", "i2v"];

  private readonly token: string;
  private readonly apiBase: string;
  private readonly fetchImpl: FalFetch;
  private readonly bucket: TokenBucket;
  private readonly onTrace?: FalTrace;

  constructor(opts: FalProviderOptions = {}) {
    const rawKey =
      opts.key ??
      opts.token ??
      process.env.FALAI_API_KEY ??
      process.env.FAL_KEY ??
      process.env.FAL_API_KEY ??
      "";
    this.token = rawKey.trim();
    this.apiBase = (
      opts.apiBase ??
      process.env.FALAI_API_BASE ??
      process.env.FAL_API_BASE ??
      "https://queue.fal.run"
    ).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
    this.bucket = opts.bucket ?? new TokenBucket(30, 10);
    this.onTrace = opts.onTrace;
  }

  async submit(input: CanonicalGenerateInput): Promise<ProviderHandle> {
    this.assertConfigured();
    this.assertRateLimit();

    const modelId = normalizeFalModelId(input.modelId);
    const payload = buildFalSubmitPayload(input);
    const path = `/${modelId}`;

    const json = await this.requestJson("POST", path, payload);
    const requestId = json.request_id || (json as any)?.id;
    if (!requestId) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_ERROR, "fal.ai submit missing request_id");
    }

    const statusUrl = json.status_url || (json.response_url ? `${json.response_url}/status` : undefined);
    const providerJobId = statusUrl
      ? `${modelId}:${requestId}:${statusUrl}`
      : `${modelId}:${requestId}`;

    return { providerId: this.id, providerJobId };
  }

  async getStatus(handle: ProviderHandle): Promise<ProviderStatus> {
    this.assertConfigured();
    this.assertRateLimit();

    const { statusPathOrUrl, responsePathOrUrl } = resolveFalEndpoints(handle.providerJobId, this.apiBase);

    let statusJson: FalQueueResponse;
    try {
      statusJson = await this.requestJson("GET", statusPathOrUrl);
    } catch (err) {
      if (err instanceof TerminalProviderError && !statusPathOrUrl.startsWith("http")) {
        const { modelId, requestId } = parseProviderJobId(handle.providerJobId);
        const parts = modelId.split("/").filter(Boolean);
        if (parts.length > 2) {
          const fallbackStatusPath = `/${parts[0]}/${parts[1]}/requests/${encodeURIComponent(requestId)}/status`;
          const fallbackResponsePath = `/${parts[0]}/${parts[1]}/requests/${encodeURIComponent(requestId)}`;
          try {
            statusJson = await this.requestJson("GET", fallbackStatusPath);
            return this.processStatusResponse(statusJson, fallbackResponsePath);
          } catch {
            throw err;
          }
        }
      }
      throw err;
    }

    return this.processStatusResponse(statusJson, responsePathOrUrl);
  }

  private async processStatusResponse(statusJson: FalQueueResponse, responsePathOrUrl: string): Promise<ProviderStatus> {
    const state = mapFalStatus(statusJson.status);

    if (!state) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_ERROR, `Status fal.ai tidak dikenal: ${statusJson.status}`);
    }

    if (state === "failed") {
      return {
        state,
        errorCode: classifyFalFailure(statusJson.error || statusJson.detail || statusJson.logs),
        progress: parseFalProgress(extractProgressFromLogs(statusJson.logs)),
      };
    }

    if (state === "succeeded") {
      let outputUrls = collectFalOutputUrls(statusJson);
      if (outputUrls.length === 0) {
        const resultJson = await this.requestJson("GET", responsePathOrUrl);
        outputUrls = collectFalOutputUrls(resultJson);
      }
      return {
        state: "succeeded",
        outputUrls,
        progress: 100,
      };
    }

    return {
      state,
      progress: parseFalProgress(extractProgressFromLogs(statusJson.logs)),
    };
  }

  private assertConfigured(): void {
    if (!this.token) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_NOT_CONFIGURED, "FALAI_API_KEY kosong");
    }
  }

  private assertRateLimit(): void {
    if (!this.bucket.take()) {
      throw new RetryableProviderError("fal.ai token bucket empty");
    }
  }

  private async requestJson(method: "GET" | "POST", pathOrUrl: string, body?: unknown): Promise<FalQueueResponse> {
    const phase = method === "POST" ? "submit" : "poll";
    const at = new Date().toISOString();
    let res: Response;
    const url =
      pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")
        ? pathOrUrl
        : `${this.apiBase}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

    let parsedPath = pathOrUrl;
    try {
      if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
        parsedPath = new URL(pathOrUrl).pathname;
      }
    } catch {}

    try {
      res = await this.fetchImpl(url, {
        method,
        headers: {
          authorization: `Key ${this.token}`,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        redirect: "follow",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "fal.ai network error";
      await this.emitTrace({
        at,
        phase: "error",
        method,
        path: parsedPath,
        request: redactFalBody(body),
        error: message,
      });
      throw new RetryableProviderError("fal.ai network error", { cause: err });
    }

    const parsed = await readJson(res);
    await this.emitTrace({
      at,
      phase,
      method,
      path: parsedPath,
      httpStatus: res.status,
      request: redactFalBody(body),
      response: parsed,
    });

    if (res.status === 429 || res.status >= 500) {
      throw new RetryableProviderError(`fal.ai HTTP ${res.status}`);
    }

    if (!res.ok) {
      const errorDetail = parsed.detail || parsed.error;
      const classified = classifyFalHttpStatus(res.status, errorDetail);
      if (classified.retryable) {
        throw new RetryableProviderError(`fal.ai HTTP ${res.status}`);
      }
      const detailStr = typeof errorDetail === "string" ? `: ${errorDetail}` : (errorDetail ? `: ${JSON.stringify(errorDetail)}` : "");
      throw new TerminalProviderError(classified.errorCode, `fal.ai HTTP ${res.status}${detailStr}`);
    }

    return parsed;
  }

  private async emitTrace(event: FalTraceEvent): Promise<void> {
    if (!this.onTrace) return;
    try {
      await this.onTrace(event);
    } catch {
      // Logging trace must not break the workflow.
    }
  }
}

export function resolveFalEndpoints(
  providerJobId: string,
  apiBase: string,
): { statusPathOrUrl: string; responsePathOrUrl: string; requestId: string } {
  const httpIdx = providerJobId.indexOf("://");
  if (httpIdx > 0) {
    const rawUrl = providerJobId.slice(providerJobId.lastIndexOf("http", httpIdx));
    const statusUrl = rawUrl.endsWith("/status") ? rawUrl : `${rawUrl}/status`;
    const responseUrl = statusUrl.replace(/\/status(\?.*)?$/, "$1");
    const matchReq = statusUrl.match(/\/requests\/([^/?#]+)/);
    return {
      statusPathOrUrl: statusUrl,
      responsePathOrUrl: responseUrl,
      requestId: matchReq ? matchReq[1] : providerJobId,
    };
  }

  if (providerJobId.startsWith("/") && providerJobId.includes("/requests/")) {
    const statusPath = providerJobId.endsWith("/status") ? providerJobId : `${providerJobId}/status`;
    const responsePath = statusPath.replace(/\/status(\?.*)?$/, "$1");
    const matchReq = statusPath.match(/\/requests\/([^/?#]+)/);
    return {
      statusPathOrUrl: statusPath,
      responsePathOrUrl: responsePath,
      requestId: matchReq ? matchReq[1] : providerJobId,
    };
  }

  const { modelId, requestId } = parseProviderJobId(providerJobId);
  const statusPath = `/${modelId}/requests/${encodeURIComponent(requestId)}/status`;
  const responsePath = `/${modelId}/requests/${encodeURIComponent(requestId)}`;
  return { statusPathOrUrl: statusPath, responsePathOrUrl: responsePath, requestId };
}

export function parseProviderJobId(providerJobId: string): { modelId: string; requestId: string; statusUrl?: string } {
  const httpIdx = providerJobId.indexOf("://");
  if (httpIdx > 0) {
    const prefix = providerJobId.slice(0, httpIdx);
    const lastColonBeforeHttp = prefix.lastIndexOf(":");
    if (lastColonBeforeHttp > 0) {
      const remainingPrefix = prefix.slice(0, lastColonBeforeHttp);
      const statusUrl = providerJobId.slice(lastColonBeforeHttp + 1);
      const firstColon = remainingPrefix.indexOf(":");
      if (firstColon > 0) {
        return {
          modelId: remainingPrefix.slice(0, firstColon),
          requestId: remainingPrefix.slice(firstColon + 1),
          statusUrl,
        };
      }
      return { modelId: remainingPrefix, requestId: remainingPrefix, statusUrl };
    }
  }

  const idx = providerJobId.lastIndexOf(":");
  if (idx > 0) {
    return {
      modelId: providerJobId.slice(0, idx),
      requestId: providerJobId.slice(idx + 1),
    };
  }
  return { modelId: "", requestId: providerJobId };
}

export function normalizeFalModelId(modelId: string): string {
  return modelId.trim().replace(/^\/+/, "");
}

export function buildFalSubmitPayload(input: CanonicalGenerateInput): Record<string, unknown> {
  const aspectRatio = typeof input.params.aspectRatio === "string" ? input.params.aspectRatio : undefined;
  const seed = typeof input.params.seed === "number" ? input.params.seed : undefined;
  const numImages = typeof input.params.n === "number" ? input.params.n : 1;
  const image =
    typeof input.params.image === "string"
      ? input.params.image
      : typeof input.params.image_url === "string"
        ? input.params.image_url
        : Array.isArray(input.params.refs) && typeof input.params.refs[0] === "string"
          ? input.params.refs[0]
          : undefined;

  const payload: Record<string, unknown> = {};

  if (input.prompt && input.prompt.trim().length > 0) {
    payload.prompt = input.prompt.trim();
  } else if (!normalizeFalModelId(input.modelId).includes("upscale")) {
    payload.prompt = "";
  }

  if (numImages > 1) {
    payload.num_images = numImages;
  }

  if (aspectRatio) {
    payload.aspect_ratio = aspectRatio;
  }

  if (seed !== undefined && seed >= 0) {
    payload.seed = seed;
  }

  if (image) {
    payload.image_url = image;
    payload.image = image;
  }

  if (Array.isArray(input.params.images) && input.params.images.length > 0) {
    payload.images = input.params.images;
  }

  // Upscale specific parameters (SeedVR, etc.)
  if (input.params.upscale_mode !== undefined || input.params.upscaleMode !== undefined) {
    payload.upscale_mode = input.params.upscale_mode ?? input.params.upscaleMode;
  } else if (normalizeFalModelId(input.modelId).includes("upscale")) {
    payload.upscale_mode = "factor";
  }

  if (input.params.target_resolution !== undefined || input.params.targetResolution !== undefined) {
    payload.target_resolution = input.params.target_resolution ?? input.params.targetResolution;
  }

  if (input.params.upscale_factor !== undefined || input.params.upscaleFactor !== undefined) {
    payload.upscale_factor = input.params.upscale_factor ?? input.params.upscaleFactor;
  } else if (normalizeFalModelId(input.modelId).includes("upscale") && !payload.target_resolution) {
    payload.upscale_factor = 8.0;
  }

  if (input.params.noise_scale !== undefined || input.params.noiseScale !== undefined) {
    payload.noise_scale = input.params.noise_scale ?? input.params.noiseScale;
  }
  if (input.params.output_format !== undefined || input.params.outputFormat !== undefined) {
    payload.output_format = input.params.output_format ?? input.params.outputFormat;
  }

  // Support pass-through of custom parameters like creativity, style, resolution, duration
  if (input.params.creativity !== undefined) {
    payload.creativity = input.params.creativity;
  }
  if (input.params.style !== undefined) {
    payload.style = input.params.style;
  }
  if (input.params.duration !== undefined) {
    payload.duration = input.params.duration;
  }
  if (input.params.resolution !== undefined) {
    payload.resolution = input.params.resolution;
  }

  // Support LoRA configurations
  if (Array.isArray(input.params.loras) && input.params.loras.length > 0) {
    payload.loras = input.params.loras;
  } else if (typeof input.params.lora_url === "string" && input.params.lora_url.trim()) {
    payload.loras = [
      {
        path: input.params.lora_url.trim(),
        scale: typeof input.params.lora_scale === "number" ? input.params.lora_scale : 1.0,
      },
    ];
  } else if (typeof input.params.lora_path === "string" && input.params.lora_path.trim()) {
    payload.loras = [
      {
        path: input.params.lora_path.trim(),
        scale: typeof input.params.lora_scale === "number" ? input.params.lora_scale : 1.0,
      },
    ];
  } else if (typeof input.params.lora === "string" && input.params.lora.trim()) {
    payload.loras = [
      {
        path: input.params.lora.trim(),
        scale: typeof input.params.lora_scale === "number" ? input.params.lora_scale : 1.0,
      },
    ];
  } else if (typeof input.params.lora === "object" && input.params.lora !== null) {
    payload.loras = [input.params.lora];
  }

  payload.enable_safety_checker =
    typeof input.params.enable_safety_checker === "boolean"
      ? input.params.enable_safety_checker
      : false;

  return payload;
}

export function collectFalOutputUrls(data: FalQueueResponse): string[] {
  const urls: string[] = [];
  const push = (item: unknown) => {
    if (typeof item === "string" && /^https?:\/\//i.test(item.trim()) && !urls.includes(item.trim())) {
      urls.push(item.trim());
    }
  };

  if (Array.isArray(data.images)) {
    for (const img of data.images) {
      if (typeof img === "string") push(img);
      else if (img && typeof img.url === "string") push(img.url);
    }
  }

  if (data.image) {
    if (typeof data.image === "string") push(data.image);
    else if (typeof data.image.url === "string") push(data.image.url);
  }

  if (data.video) {
    if (typeof data.video === "string") push(data.video);
    else if (typeof data.video.url === "string") push(data.video.url);
  }

  if (Array.isArray(data.videos)) {
    for (const vid of data.videos) {
      if (typeof vid === "string") push(vid);
      else if (vid && typeof vid.url === "string") push(vid.url);
    }
  }

  if (typeof data.video_url === "string") push(data.video_url);

  if (Array.isArray(data.outputs)) {
    for (const out of data.outputs) {
      if (typeof out === "string") push(out);
      else if (out && typeof (out as any).url === "string") push((out as any).url);
    }
  }

  return urls;
}

function extractProgressFromLogs(logs?: Array<{ message?: string }>): string | undefined {
  if (!Array.isArray(logs) || logs.length === 0) return undefined;
  for (let i = logs.length - 1; i >= 0; i--) {
    const msg = logs[i]?.message;
    if (typeof msg === "string" && msg.includes("%")) {
      return msg;
    }
  }
  return undefined;
}

function redactFalBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const copy = { ...(body as Record<string, unknown>) };
  if (typeof copy.prompt === "string" && copy.prompt.length > 160) {
    copy.prompt = `${copy.prompt.slice(0, 160)}…`;
  }
  if (typeof copy.image === "string" && copy.image.length > 60) {
    copy.image = `${copy.image.slice(0, 30)}…[base64 ${copy.image.length} chars]`;
  }
  return copy;
}

async function readJson(res: Response): Promise<FalQueueResponse> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as FalQueueResponse;
  } catch {
    return { detail: text.slice(0, 200) };
  }
}
