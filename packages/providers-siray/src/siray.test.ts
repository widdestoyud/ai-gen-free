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
