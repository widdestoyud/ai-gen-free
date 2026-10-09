import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKelontongPayload, sendKelontongChatCompletion } from "./kelontong.js";

test("buildKelontongPayload: creates payload with default model gpt-5.6-sol", () => {
  const payload = buildKelontongPayload({
    messages: [{ role: "user", content: "Halo dari KelontongAI" }],
  });

  assert.equal(payload.model, "gpt-5.6-sol");
  assert.deepEqual(payload.messages, [{ role: "user", content: "Halo dari KelontongAI" }]);
});

test("buildKelontongPayload: converts single prompt to user message", () => {
  const payload = buildKelontongPayload({
    prompt: "Halo dari KelontongAI",
  });

  assert.equal(payload.model, "gpt-5.6-sol");
  assert.deepEqual(payload.messages, [{ role: "user", content: "Halo dari KelontongAI" }]);
});

test("buildKelontongPayload: respects custom model and temperature", () => {
  const payload = buildKelontongPayload({
    model: "custom-chat-model",
    messages: [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Test" },
    ],
    temperature: 0.5,
  });

  assert.equal(payload.model, "custom-chat-model");
  assert.equal(payload.messages.length, 2);
  assert.equal(payload.temperature, 0.5);
});

test("buildKelontongPayload: throws error if messages and prompt are missing", () => {
  assert.throws(
    () => buildKelontongPayload({}),
    /Parameter 'messages' \(array\) atau 'prompt' \(string\) wajib diisi/,
  );
});

test("sendKelontongChatCompletion: sends request with bearer token and parses response", async () => {
  let capturedUrl = "";
  let capturedHeaders: Record<string, string> = {};
  let capturedBody: any = null;

  const mockFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedHeaders = (init?.headers as Record<string, string>) ?? {};
    capturedBody = JSON.parse(String(init?.body));

    return new Response(
      JSON.stringify({
        id: "chatcmpl-12345",
        object: "chat.completion",
        created: 1727768000,
        model: "gpt-5.6-sol",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Halo! Ada yang bisa saya bantu?" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const res = await sendKelontongChatCompletion(
    {
      model: "gpt-5.6-sol",
      messages: [{ role: "user", content: "Halo dari KelontongAI" }],
    },
    {
      apiKey: "sk-kelontong-XxPDBa_zxh2EJ5z7wioJXS1BzDajl__IB5SrN5dc",
      apiBase: "https://api.kelontongai.id",
      fetchFn: mockFetch,
    },
  );

  assert.equal(capturedUrl, "https://api.kelontongai.id/v1/chat/completions");
  assert.equal(
    capturedHeaders["Authorization"],
    "Bearer sk-kelontong-XxPDBa_zxh2EJ5z7wioJXS1BzDajl__IB5SrN5dc",
  );
  assert.equal(capturedHeaders["Content-Type"], "application/json");
  assert.equal(capturedBody.model, "gpt-5.6-sol");
  assert.deepEqual(capturedBody.messages, [{ role: "user", content: "Halo dari KelontongAI" }]);

  assert.equal(res.id, "chatcmpl-12345");
  assert.equal(res.choices?.[0]?.message?.content, "Halo! Ada yang bisa saya bantu?");
});

test("sendKelontongChatCompletion: throws AppError on provider error", async () => {
  const mockFetch: typeof fetch = async () => {
    return new Response(
      JSON.stringify({
        error: { message: "Invalid API key provided" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  };

  await assert.rejects(
    () =>
      sendKelontongChatCompletion(
        { prompt: "Hello" },
        {
          apiKey: "invalid-key",
          fetchFn: mockFetch,
        },
      ),
    /KelontongAI error: Invalid API key provided/,
  );
});
