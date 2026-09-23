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

export type SirayTraceEvent = {
  at: string;
  phase: "submit" | "poll" | "error";
  method: "GET" | "POST";
  path: string;
  httpStatus?: number;
  request?: unknown;
  response?: unknown;
  error?: string;
};

export type SirayTrace = (event: SirayTraceEvent) => void | Promise<void>;

export type SirayProviderOptions = {
  token?: string;
  apiBase?: string;
  fetch?: SirayFetch;
  bucket?: TokenBucket;
  onTrace?: SirayTrace;
};

type SirayTaskData = {
  task_id?: string;
  status?: string;
  progress?: string | number;
  outputs?: unknown;
  output?: unknown;
  video_url?: unknown;
  videos?: unknown;
  video?: unknown;
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
  private readonly onTrace?: SirayTrace;

  constructor(opts: SirayProviderOptions = {}) {
    this.token = (opts.token ?? process.env.SIRAY_API_TOKEN ?? "").trim();
    this.apiBase = (opts.apiBase ?? process.env.SIRAY_API_BASE ?? "https://api.siray.ai").replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? fetch;
    this.bucket = opts.bucket ?? new TokenBucket();
    this.onTrace = opts.onTrace;
  }

  async submit(input: CanonicalGenerateInput): Promise<ProviderHandle> {
    this.assertConfigured();
    this.assertRateLimit();
    const isVideo = isVideoInput(input);
    const endpoint = isVideo ? "/v1/video/generations" : "/v1/images/generations/async";
    const payload = buildSiraySubmitPayload(input);
    const json = await this.requestJson("POST", endpoint, payload);
    const taskId = json.data?.task_id || (json as any)?.task_id || json.data?.id || (json as any)?.id;
    if (!taskId) {
      throw new TerminalProviderError(JobErrorCodes.PROVIDER_ERROR, "Siray submit missing task_id");
    }
    const providerJobId = isVideo ? `video:${taskId}` : taskId;
    return { providerId: this.id, providerJobId };
  }

  async getStatus(handle: ProviderHandle): Promise<ProviderStatus> {
    this.assertConfigured();
    this.assertRateLimit();
    const isVideo = handle.providerJobId.startsWith("video:");
    const rawId = isVideo ? handle.providerJobId.slice("video:".length) : handle.providerJobId;
    const path = isVideo
      ? `/v1/video/generations/${encodeURIComponent(rawId)}`
      : `/v1/images/generations/async/${encodeURIComponent(rawId)}`;

    let json: { code?: string; message?: string; fail_code?: string; data?: SirayTaskData };
    try {
      json = await this.requestJson("GET", path);
    } catch (err) {
      if (!isVideo && err instanceof TerminalProviderError) {
        try {
          json = await this.requestJson("GET", `/v1/video/generations/${encodeURIComponent(rawId)}`);
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }
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
    const phase = method === "POST" ? "submit" : "poll";
    const at = new Date().toISOString();
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
      const message = err instanceof Error ? err.message : "Siray network error";
      await this.emitTrace({
        at,
        phase: "error",
        method,
        path,
        request: redactSirayBody(body),
        error: message,
      });
      throw new RetryableProviderError("Siray network error", { cause: err });
    }

    const parsed = await readJson(res);
    await this.emitTrace({
      at,
      phase,
      method,
      path,
      httpStatus: res.status,
      request: redactSirayBody(body),
      response: parsed,
    });
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

  private async emitTrace(event: SirayTraceEvent): Promise<void> {
    if (!this.onTrace) return;
    try {
      await this.onTrace(event);
    } catch {
      // Logging must not fail the job.
    }
  }
}

function redactSirayBody(body: unknown): unknown {
  if (body === undefined) return undefined;
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const copy = { ...(body as Record<string, unknown>) };
  if (typeof copy.prompt === "string" && copy.prompt.length > 160) {
    copy.prompt = `${copy.prompt.slice(0, 160)}…`;
  }
  if (typeof copy.image === "string" && copy.image.length > 60) {
    copy.image = `${copy.image.slice(0, 30)}…[base64 ${copy.image.length} chars]`;
  }
  if (Array.isArray(copy.images)) {
    copy.images = copy.images.map((img) =>
      typeof img === "string" && img.length > 60 ? `${img.slice(0, 30)}…[base64 ${img.length} chars]` : img,
    );
  }
  return copy;
}

/** Seedream t2i memakai `size` wajib, bukan aspect_ratio. */
const SEEDREAM_SIZE_BY_ASPECT: Record<string, string> = {
  "1:1": "1024x1024",
  "4:3": "1152x864",
  "3:4": "864x1152",
  "16:9": "1424x800",
  "9:16": "800x1424",
  "3:2": "1248x832",
  "2:3": "832x1248",
  "5:4": "1152x864",
  "4:5": "864x1152",
};

function isSeedreamT2i(modelId: string): boolean {
  return modelId.includes("seedream") && modelId.includes("t2i");
}

function isGptImage(modelId: string): boolean {
  return modelId.includes("gpt-image");
}

function isQwenImage(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return (lower.includes("qwen") || (lower.includes("alibaba") && !lower.includes("wan"))) && !lower.includes("i2v") && !lower.includes("t2v");
}

function isWan(modelId: string): boolean {
  return modelId.toLowerCase().includes("wan");
}

function isSeedance(modelId: string): boolean {
  return modelId.toLowerCase().includes("seedance");
}

const WAN_ALLOWED_RATIOS = new Set(["16:9", "9:16", "1:1", "4:3", "3:4"]);
const WAN_RATIO_MAP: Record<string, string> = {
  "3:2": "16:9",
  "2:3": "9:16",
  "21:9": "16:9",
  "9:21": "9:16",
  "5:4": "4:3",
  "4:5": "3:4",
};

function mapWanAspectRatio(ratio?: string): string {
  if (!ratio) return "16:9";
  if (WAN_ALLOWED_RATIOS.has(ratio)) return ratio;
  return WAN_RATIO_MAP[ratio] ?? "16:9";
}

const DEFAULT_WAN_NEGATIVE_PROMPT = "deformed hands, fused bodies, face morphing, watermark, extra limbs, extra legs, extra arms, extra fingers, poorly drawn hands, deformed anatomy, mutilated, disfigured, malformed limbs, fused fingers, floating limbs, disconnected limbs, mutation, blurred, ugly, bad proportions, distorted face, cloned face, unnatural body pose";


export function buildSiraySubmitPayload(input: CanonicalGenerateInput): Record<string, unknown> {
  const aspectRatio = typeof input.params.aspectRatio === "string" ? input.params.aspectRatio : undefined;
  const size = typeof input.params.size === "string" ? input.params.size : undefined;
  const tierSize = typeof input.params.tierSize === "string" ? input.params.tierSize : undefined;
  const seed = typeof input.params.seed === "number" ? input.params.seed : undefined;
  const promptExpansion =
    typeof input.params.prompt_expansion_enable === "boolean"
      ? input.params.prompt_expansion_enable
      : undefined;
  const quality =
    typeof input.params.quality === "string"
      ? input.params.quality
      : isGptImage(input.modelId)
        ? "medium"
        : undefined;
  const outputFormat =
    typeof input.params.output_format === "string"
      ? input.params.output_format
      : typeof input.params.outputFormat === "string"
        ? input.params.outputFormat
        : undefined;
  const moderation = typeof input.params.moderation === "string" ? input.params.moderation : undefined;
  const n = typeof input.params.n === "number" ? input.params.n : undefined;
  const duration =
    typeof input.params.duration === "number"
      ? input.params.duration
      : typeof input.params.duration === "string"
        ? parseInt(input.params.duration, 10) || 6
        : undefined;
  const resolution =
    typeof input.params.resolution === "string"
      ? input.params.resolution
      : typeof input.params.resolution === "number"
        ? String(input.params.resolution)
        : undefined;

  const payload: Record<string, unknown> = {
    model: input.modelId,
    prompt: input.prompt,
  };

  const image =
    typeof input.params.image === "string"
      ? input.params.image
      : typeof input.params.image_url === "string"
        ? input.params.image_url
        : Array.isArray(input.params.refs) && typeof input.params.refs[0] === "string"
          ? input.params.refs[0]
          : undefined;

  if (image) {
    payload.image = image;
  }

  if (Array.isArray(input.params.images) && input.params.images.length > 0) {
    payload.images = input.params.images;
  } else if (Array.isArray(input.params.refs) && input.params.refs.length > 0) {
    payload.images = input.params.refs;
  } else if (image) {
    payload.images = [image];
  }

  if (typeof input.params.mask === "string") {
    payload.mask = input.params.mask;
  }

  const audioEnable =
    typeof input.params.audio_enable === "boolean"
      ? input.params.audio_enable
      : typeof input.params.audioEnable === "boolean"
        ? input.params.audioEnable
        : isVideoInput(input)
          ? true
          : undefined;

  if (isWan(input.modelId)) {
    payload.duration = duration ?? 6;
    const rawRes = resolution ?? size ?? "480";
    payload.resolution = rawRes.replace(/p$/i, "");
    payload.aspect_ratio = mapWanAspectRatio(aspectRatio);
    const negativePrompt =
      typeof input.params.negative_prompt === "string" && input.params.negative_prompt.trim().length > 0
        ? input.params.negative_prompt.trim()
        : typeof input.params.negativePrompt === "string" && input.params.negativePrompt.trim().length > 0
          ? input.params.negativePrompt.trim()
          : DEFAULT_WAN_NEGATIVE_PROMPT;
    payload.negative_prompt = negativePrompt;
    if (seed !== undefined) payload.seed = seed;
    payload.audio_enable = audioEnable ?? true;
    return payload;
  }

function mapSeedanceAspectRatio(ratio?: string): string {
  if (!ratio) return "16:9";
  const r = ratio.trim();
  if (r === "3:2") return "16:9";
  if (r === "2:3") return "9:16";
  const allowed = new Set(["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"]);
  return allowed.has(r) ? r : "16:9";
}

  if (isSeedance(input.modelId)) {
    payload.duration = duration ?? 6;
    const rawRes = resolution ?? size ?? "480";
    payload.resolution = rawRes.replace(/p$/i, "");
    if (aspectRatio) payload.aspect_ratio = mapSeedanceAspectRatio(aspectRatio);
    if (seed !== undefined) payload.seed = seed;
    payload.audio_enable = audioEnable ?? true;
    return payload;
  }

  if (isQwenImage(input.modelId)) {
    payload.size = size === "2k" || size === "1k" ? size : (tierSize ?? "1k");
    payload.aspect_ratio = aspectRatio ?? "1:1";
    payload.seed = seed ?? -1;
    payload.n = n ?? 1;
    payload.prompt_expansion_enable = promptExpansion ?? true;
    if (outputFormat) payload.output_format = outputFormat;
    return payload;
  }

  if (isSeedreamT2i(input.modelId)) {
    payload.size = size ?? (aspectRatio ? SEEDREAM_SIZE_BY_ASPECT[aspectRatio] : undefined) ?? "1024x1024";
    if (outputFormat) payload.output_format = outputFormat;
    return payload;
  }

  if (aspectRatio) payload.aspect_ratio = aspectRatio;
  if (size) payload.size = size;
  if (quality) payload.quality = quality;
  if (outputFormat) payload.output_format = outputFormat;
  if (moderation) payload.moderation = moderation;
  if (n !== undefined) payload.n = n;
  if (seed !== undefined) payload.seed = seed;
  if (promptExpansion !== undefined) payload.prompt_expansion_enable = promptExpansion;
  if (!payload.aspect_ratio && !payload.size) {
    payload.aspect_ratio = "1:1";
  }
  return payload;
}

function isVideoInput(input: CanonicalGenerateInput): boolean {
  if (input.mode === "i2v" || input.mode === "t2v") return true;
  const m = (input.modelId || "").toLowerCase();
  return m.includes("seedance") || m.includes("-i2v") || m.includes("-t2v") || m.includes("kling") || m.includes("wan");
}

function collectOutputUrls(data: SirayTaskData): string[] {
  const urls: string[] = [];
  const push = (item: unknown) => {
    if (typeof item === "string" && isHttpUrl(item) && !urls.includes(item)) urls.push(item);
  };
  const raw = data.outputs ?? data.output ?? data.video_url ?? data.videos ?? data.video;
  if (Array.isArray(raw)) {
    for (const item of raw) push(item);
  } else {
    push(raw);
  }
  // gpt-image-2 (dan beberapa model lain) mengisi URL file ke fail_reason meski status SUCCESS.
  push(data.fail_reason);
  return urls;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
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
