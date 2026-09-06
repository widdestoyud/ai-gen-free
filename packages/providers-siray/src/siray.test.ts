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
