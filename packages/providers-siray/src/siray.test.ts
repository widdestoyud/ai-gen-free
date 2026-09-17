import assert from "node:assert/strict";
import { test } from "node:test";
import {
  JobErrorCodes,
  RetryableProviderError,
  TerminalProviderError,
  type CanonicalGenerateInput,
} from "@ai-gen-free/core";
import { SirayProvider } from "./siray.js";
import { TokenBucket } from "./token-bucket.js";

const input: CanonicalGenerateInput = {
  mode: "t2i",
  modelId: "black-forest-labs/flux-1.1-pro-t2i",
  prompt: "sebuah kucing",
  params: { aspectRatio: "16:9" },
  inputFiles: [],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("empty token is terminal PROVIDER_NOT_CONFIGURED and does not call HTTP", async () => {
  let called = 0;
  const provider = new SirayProvider({
    token: "",
    fetch: async () => {
      called += 1;
      return jsonResponse(200, {});
    },
  });
  await assert.rejects(
    () => provider.submit(input),
    (err: unknown) => err instanceof TerminalProviderError && err.errorCode === JobErrorCodes.PROVIDER_NOT_CONFIGURED,
  );
  assert.equal(called, 0);
});

test("submit POSTs async body and returns task_id", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    apiBase: "https://api.siray.ai",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "image_abc" } });
    },
  });
  const handle = await provider.submit(input);
  assert.equal(handle.providerId, "siray");
  assert.equal(handle.providerJobId, "image_abc");
  assert.equal(calls[0]?.url, "https://api.siray.ai/v1/images/generations/async");
  assert.equal(calls[0]?.init?.method, "POST");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("authorization"), "Bearer secret");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "black-forest-labs/flux-1.1-pro-t2i",
    prompt: "sebuah kucing",
    aspect_ratio: "16:9",
  });
});

test("submit supports openai/gpt-image-2-t2i parameters (n, size, quality, output_format, moderation)", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    apiBase: "https://api.siray.ai",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "image_gpt2" } });
    },
  });
  const gptInput: CanonicalGenerateInput = {
    mode: "t2i",
    modelId: "openai/gpt-image-2-t2i",
    prompt: "pemandangan indah",
    params: {
      n: 1,
      output_format: "png",
      quality: "low",
      size: "1024x768",
      moderation: "auto",
    },
    inputFiles: [],
  };
  const handle = await provider.submit(gptInput);
  assert.equal(handle.providerJobId, "image_gpt2");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "openai/gpt-image-2-t2i",
    prompt: "pemandangan indah",
    size: "1024x768",
    quality: "low",
    output_format: "png",
    moderation: "auto",
    n: 1,
  });
});

test("submit supports openai/gpt-image-2-edit with image reference", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    apiBase: "https://api.siray.ai",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "image_gpt2_edit" } });
    },
  });
  const editInput: CanonicalGenerateInput = {
    mode: "i2i",
    modelId: "openai/gpt-image-2-edit",
    prompt: "ubah latar belakang menjadi pantai tropis",
    params: {
      image: "https://storage.example.com/uploads/input1.webp",
      refs: ["https://storage.example.com/uploads/input1.webp"],
      aspectRatio: "1:1",
      quality: "high",
    },
    inputFiles: [],
  };
  const handle = await provider.submit(editInput);
  assert.equal(handle.providerJobId, "image_gpt2_edit");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "openai/gpt-image-2-edit",
    prompt: "ubah latar belakang menjadi pantai tropis",
    image: "https://storage.example.com/uploads/input1.webp",
    images: ["https://storage.example.com/uploads/input1.webp"],
    aspect_ratio: "1:1",
    quality: "high",
  });
});

test("submit gpt-image defaults quality to medium and image populates images array", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    apiBase: "https://api.siray.ai",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "image_gpt2_default" } });
    },
  });
  const editInput: CanonicalGenerateInput = {
    mode: "i2i",
    modelId: "openai/gpt-image-2-edit",
    prompt: "ubah latar belakang",
    params: {
      image: "https://storage.example.com/uploads/input1.webp",
    },
    inputFiles: [],
  };
  const handle = await provider.submit(editInput);
  assert.equal(handle.providerJobId, "image_gpt2_default");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "openai/gpt-image-2-edit",
    prompt: "ubah latar belakang",
    image: "https://storage.example.com/uploads/input1.webp",
    images: ["https://storage.example.com/uploads/input1.webp"],
    aspect_ratio: "1:1",
    quality: "medium",
  });
});

test("submit seedream t2i spicy uses required size and omits gpt-only fields", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "seedream_1" } });
    },
  });
  await provider.submit({
    mode: "t2i",
    modelId: "bytedance/seedream-5.0-pro-t2i-spicy",
    prompt: "pemandangan kiamat",
    params: { aspectRatio: "16:9", output_format: "png" },
    inputFiles: [],
  });
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "bytedance/seedream-5.0-pro-t2i-spicy",
    prompt: "pemandangan kiamat",
    size: "1424x800",
    output_format: "png",
  });
});

test("getStatus maps SUCCESS outputs", async () => {
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () =>
      jsonResponse(200, {
        code: "success",
        data: {
          task_id: "image_abc",
          status: "SUCCESS",
          progress: "100%",
          outputs: ["https://api.siray.ai/redirect/out"],
        },
      }),
  });
  const status = await provider.getStatus({ providerId: "siray", providerJobId: "image_abc" });
  assert.equal(status.state, "succeeded");
  assert.deepEqual(status.outputUrls, ["https://api.siray.ai/redirect/out"]);
});

test("getStatus SUCCESS uses fail_reason URL when outputs empty (gpt-image-2 quirk)", async () => {
  const url =
    "https://api.siray.ai/redirect/vwIfmJ8CcZCyP7LXh_zI4GzZlpTl7bHPWhSiyEMcMdmobvjABYJYgXRdGov73K2F/out.png";
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () =>
      jsonResponse(200, {
        code: "success",
        data: {
          task_id: "openai-image-1",
          status: "SUCCESS",
          progress: "100%",
          outputs: [],
          fail_reason: url,
        },
      }),
  });
  const status = await provider.getStatus({ providerId: "siray", providerJobId: "openai-image-1" });
  assert.equal(status.state, "succeeded");
  assert.deepEqual(status.outputUrls, [url]);
});

test("getStatus SUCCESS does not duplicate the same URL in outputs and fail_reason", async () => {
  const url = "https://api.siray.ai/redirect/out.png";
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () =>
      jsonResponse(200, {
        code: "success",
        data: {
          task_id: "image_abc",
          status: "SUCCESS",
          progress: "100%",
          outputs: [url],
          fail_reason: url,
        },
      }),
  });
  const status = await provider.getStatus({ providerId: "siray", providerJobId: "image_abc" });
  assert.deepEqual(status.outputUrls, [url]);
});

test("policy 4xx is terminal PROVIDER_POLICY", async () => {
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () =>
      jsonResponse(400, { code: "error", fail_code: "SensitiveContentDetected", message: "blocked" }),
  });
  await assert.rejects(
    () => provider.submit(input),
    (err: unknown) => err instanceof TerminalProviderError && err.errorCode === JobErrorCodes.PROVIDER_POLICY,
  );
});

test("429 is retryable, not failed", async () => {
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () => jsonResponse(429, { message: "rate" }),
  });
  await assert.rejects(
    () => provider.getStatus({ providerId: "siray", providerJobId: "image_abc" }),
    (err: unknown) => err instanceof RetryableProviderError,
  );
});

test("empty bucket throws retryable without HTTP", async () => {
  let called = 0;
  const provider = new SirayProvider({
    token: "secret",
    bucket: new TokenBucket({ burst: 0, ratePerSec: 0 }),
    fetch: async () => {
      called += 1;
      return jsonResponse(200, {});
    },
  });
  await assert.rejects(() => provider.submit(input), (err: unknown) => err instanceof RetryableProviderError);
  assert.equal(called, 0);
});

test("network failure is retryable", async () => {
  const provider = new SirayProvider({
    token: "secret",
    fetch: async () => {
      throw new Error("ECONNRESET");
    },
  });
  await assert.rejects(() => provider.submit(input), (err: unknown) => err instanceof RetryableProviderError);
});

test("submit alibaba/qwen model uses size 1k, aspect_ratio, seed, and prompt_expansion_enable", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "qwen_task_1" } });
    },
  });
  const handle = await provider.submit({
    mode: "t2i",
    modelId: "alibaba/qwen-image-3-pro-t2i-spicy",
    prompt: "sebuah kastil di awan",
    params: {
      aspectRatio: "16:9",
      size: "1024x768",
      tierSize: "1k",
      seed: -1,
      n: 1,
      prompt_expansion_enable: true,
    },
    inputFiles: [],
  });
  assert.equal(handle.providerJobId, "qwen_task_1");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "alibaba/qwen-image-3-pro-t2i-spicy",
    prompt: "sebuah kastil di awan",
    size: "1k",
    aspect_ratio: "16:9",
    seed: -1,
    n: 1,
    prompt_expansion_enable: true,
  });
});

test("submit alibaba/qwen-image-3-edit-spicy sends image references and qwen parameters", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "qwen_edit_task_1" } });
    },
  });
  const handle = await provider.submit({
    mode: "i2i",
    modelId: "alibaba/qwen-image-3-edit-spicy",
    prompt: "ganti pakaian karakter dengan gaun malam merah",
    params: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      refs: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      aspectRatio: "1:1",
      tierSize: "1k",
      seed: -1,
      n: 1,
      prompt_expansion_enable: true,
    },
    inputFiles: [],
  });
  assert.equal(handle.providerJobId, "qwen_edit_task_1");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "alibaba/qwen-image-3-edit-spicy",
    prompt: "ganti pakaian karakter dengan gaun malam merah",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
    size: "1k",
    aspect_ratio: "1:1",
    seed: -1,
    n: 1,
    prompt_expansion_enable: true,
  });
});

test("submit bytedance/seedance-2.5-i2v uses duration 6 and resolution 480 and calls video endpoint", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "seedance_task_1" } });
    },
  });
  const handle = await provider.submit({
    mode: "i2v",
    modelId: "bytedance/seedance-2.5-i2v",
    prompt: "karakter tersenyum dan melambaikan tangan",
    params: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      refs: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      duration: "6s",
      resolution: "480p",
      aspectRatio: "16:9",
    },
    inputFiles: [],
  });
  assert.equal(handle.providerJobId, "video:seedance_task_1");
  assert.equal(calls[0]?.url, "https://api.siray.ai/v1/video/generations");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "bytedance/seedance-2.5-i2v",
    prompt: "karakter tersenyum dan melambaikan tangan",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
    duration: 6,
    resolution: "480",
    aspect_ratio: "16:9",
  });
});

test("submit bytedance/seedance-2.0-i2v-spicy defaults duration to 6 and resolution to 480 and calls video endpoint", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "seedance_spicy_task_1" } });
    },
  });
  const handle = await provider.submit({
    mode: "i2v",
    modelId: "bytedance/seedance-2.0-i2v-spicy",
    prompt: "karakter menari di panggung",
    params: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    },
    inputFiles: [],
  });
  assert.equal(handle.providerJobId, "video:seedance_spicy_task_1");
  assert.equal(calls[0]?.url, "https://api.siray.ai/v1/video/generations");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "bytedance/seedance-2.0-i2v-spicy",
    prompt: "karakter menari di panggung",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
    duration: 6,
    resolution: "480",
  });
});

test("getStatus polls video endpoint when handle has video: prefix and extracts video_url", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const videoUrl = "https://api.siray.ai/redirect/video_123.mp4";
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, {
        code: "success",
        data: {
          task_id: "video_task_abc",
          status: "SUCCESS",
          progress: "100%",
          video_url: videoUrl,
        },
      });
    },
  });
  const status = await provider.getStatus({ providerId: "siray", providerJobId: "video:video_task_abc" });
  assert.equal(status.state, "succeeded");
  assert.deepEqual(status.outputUrls, [videoUrl]);
  assert.equal(calls[0]?.url, "https://api.siray.ai/v1/video/generations/video_task_abc");
});

test("submit alibaba/wan-2.7-i2v-uncensored maps 3:2 to 16:9 and injects default negative_prompt", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const provider = new SirayProvider({
    token: "secret",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(200, { code: "success", data: { task_id: "wan_task_1" } });
    },
  });
  const handle = await provider.submit({
    mode: "i2v",
    modelId: "alibaba/wan-2.7-i2v-uncensored",
    prompt: "camera pans slowly as character turns around",
    params: {
      image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      refs: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
      duration: 6,
      resolution: "480",
      aspectRatio: "3:2",
    },
    inputFiles: [],
  });
  assert.equal(handle.providerJobId, "video:wan_task_1");
  assert.equal(calls[0]?.url, "https://api.siray.ai/v1/video/generations");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    model: "alibaba/wan-2.7-i2v-uncensored",
    prompt: "camera pans slowly as character turns around",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    images: ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
    duration: 6,
    resolution: "480",
    aspect_ratio: "16:9",
    negative_prompt: "Avoid extra limbs, deformed hands, fused bodies, face morphing,  watermark",
  });
});
