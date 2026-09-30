import { test } from "node:test";
import assert from "node:assert/strict";
import { FalProvider, parseProviderJobId, buildFalSubmitPayload, collectFalOutputUrls } from "./fal.js";

test("FalProvider submit attaches Key header and returns handle", async () => {
  const calls: Array<{ url: string; headers: Headers; body: any }> = [];
  const fetchMock = async (input: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(
      JSON.stringify({
        request_id: "req-12345",
        status_url: "https://queue.fal.run/krea/v2/large/text-to-image/requests/req-12345/status",
        response_url: "https://queue.fal.run/krea/v2/large/text-to-image/requests/req-12345",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const provider = new FalProvider({
    key: "test-fal-key",
    fetch: fetchMock as any,
  });

  const handle = await provider.submit({
    mode: "t2i",
    modelId: "krea/v2/large/text-to-image",
    prompt: "cyberpunk city skyline",
    params: { aspectRatio: "16:9", seed: 42 },
  });

  assert.equal(handle.providerId, "falai");
  assert.equal(
    handle.providerJobId,
    "krea/v2/large/text-to-image:req-12345:https://queue.fal.run/krea/v2/large/text-to-image/requests/req-12345/status",
  );
  assert.equal(calls[0]?.url, "https://queue.fal.run/krea/v2/large/text-to-image");
  assert.equal(calls[0]?.headers.get("authorization"), "Key test-fal-key");
  assert.equal(calls[0]?.body.prompt, "cyberpunk city skyline");
  assert.equal(calls[0]?.body.aspect_ratio, "16:9");
  assert.equal(calls[0]?.body.seed, 42);
});

test("FalProvider getStatus polls status and retrieves completed output URLs", async () => {
  const calls: string[] = [];
  const fetchMock = async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/status")) {
      return new Response(
        JSON.stringify({
          status: "COMPLETED",
          logs: [{ message: "100% complete" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        images: [{ url: "https://v3b.fal.media/files/sample.png", width: 1024, height: 1024 }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const provider = new FalProvider({
    key: "test-fal-key",
    fetch: fetchMock as any,
  });

  const status = await provider.getStatus({
    providerId: "falai",
    providerJobId:
      "krea/v2/large/text-to-image:req-12345:https://queue.fal.run/krea/v2/requests/req-12345/status",
  });

  assert.equal(status.state, "succeeded");
  assert.deepEqual(status.outputUrls, ["https://v3b.fal.media/files/sample.png"]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0], "https://queue.fal.run/krea/v2/requests/req-12345/status");
  assert.equal(calls[1], "https://queue.fal.run/krea/v2/requests/req-12345");
});

test("parseProviderJobId splits modelId and requestId correctly", () => {
  assert.deepEqual(parseProviderJobId("krea/v2/large/text-to-image:req-123"), {
    modelId: "krea/v2/large/text-to-image",
    requestId: "req-123",
  });
  assert.deepEqual(
    parseProviderJobId("krea/v2/large/text-to-image:req-123:https://queue.fal.run/krea/v2/requests/req-123/status"),
    {
      modelId: "krea/v2/large/text-to-image",
      requestId: "req-123",
      statusUrl: "https://queue.fal.run/krea/v2/requests/req-123/status",
    },
  );
  assert.deepEqual(parseProviderJobId("req-standalone"), {
    modelId: "",
    requestId: "req-standalone",
  });
});

test("collectFalOutputUrls collects image, video, and output arrays", () => {
  const urls = collectFalOutputUrls({
    images: [{ url: "https://fal.media/img1.png" }],
    video: { url: "https://fal.media/vid1.mp4" },
    video_url: "https://fal.media/vid2.mp4",
  });
  assert.deepEqual(urls, [
    "https://fal.media/img1.png",
    "https://fal.media/vid1.mp4",
    "https://fal.media/vid2.mp4",
  ]);
});

test("buildFalSubmitPayload constructs correct LoRA array and safety checker params", () => {
  const payload1 = buildFalSubmitPayload({
    mode: "t2i",
    modelId: "fal-ai/krea-2/turbo/lora",
    prompt: "portrait in custom style",
    params: {
      aspectRatio: "1:1",
      loras: [{ path: "https://example.com/lora.safetensors", scale: 0.8 }],
      enable_safety_checker: false,
    },
  });

  assert.deepEqual(payload1.loras, [{ path: "https://example.com/lora.safetensors", scale: 0.8 }]);
  assert.equal(payload1.enable_safety_checker, false);

  const payload2 = buildFalSubmitPayload({
    mode: "t2i",
    modelId: "fal-ai/krea-2/turbo/lora",
    prompt: "portrait in custom style",
    params: {
      aspectRatio: "16:9",
      lora_url: "https://example.com/single-lora.safetensors",
      lora_scale: 1.2,
    },
  });

  assert.deepEqual(payload2.loras, [{ path: "https://example.com/single-lora.safetensors", scale: 1.2 }]);
  assert.equal(payload2.enable_safety_checker, false);
});

test("buildFalSubmitPayload constructs correct SeedVR upscaler payload", () => {
  const payload = buildFalSubmitPayload({
    mode: "i2i",
    modelId: "fal-ai/seedvr/upscale/image",
    prompt: "",
    params: {
      image_url: "https://example.com/input.png",
      upscale_mode: "factor",
      upscale_factor: 2.0,
      noise_scale: 0.1,
    },
  });

  assert.equal(payload.prompt, undefined);
  assert.equal(payload.image_url, "https://example.com/input.png");
  assert.equal(payload.upscale_mode, "factor");
  assert.equal(payload.upscale_factor, 2.0);
  assert.equal(payload.noise_scale, 0.1);
  assert.equal(payload.enable_safety_checker, false);

  const default8k = buildFalSubmitPayload({
    mode: "i2i",
    modelId: "fal-ai/seedvr/upscale/image",
    prompt: "",
    params: {
      image_url: "https://example.com/input.png",
    },
  });

  assert.equal(default8k.upscale_mode, "factor");
  assert.equal(default8k.upscale_factor, 8.0);
});
