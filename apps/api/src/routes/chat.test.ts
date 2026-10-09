import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { registerJobRoutes } from "./jobs.js";
import { MemoryObjectStorage } from "@ai-gen-free/storage";
import { sendKelontongChatCompletion } from "../chat/kelontong.js";

test("POST /generate/chat: rejects unauthenticated requests", async () => {
  const app = Fastify();
  await app.register(cookie);

  const storage = new MemoryObjectStorage();
  const mockQueue = { add: async () => {} } as any;

  await registerJobRoutes(app, { storage, queue: mockQueue });

  const response = await app.inject({
    method: "POST",
    url: "/generate/chat",
    payload: {
      messages: [{ role: "user", content: "Halo" }],
    },
  });

  assert.equal(response.statusCode, 401);
  const json = JSON.parse(response.body);
  assert.equal(json.error.code, "A006");
});

test("POST /generate/magic-prompt: rejects unauthenticated requests", async () => {
  const app = Fastify();
  await app.register(cookie);

  const storage = new MemoryObjectStorage();
  const mockQueue = { add: async () => {} } as any;

  await registerJobRoutes(app, { storage, queue: mockQueue });

  const response = await app.inject({
    method: "POST",
    url: "/generate/magic-prompt",
    payload: {
      prompt: "a cat in space",
    },
  });

  assert.equal(response.statusCode, 401);
  const json = JSON.parse(response.body);
  assert.equal(json.error.code, "A006");
});

test("POST /chat/magic-prompt: rejects unauthenticated requests", async () => {
  const app = Fastify();
  await app.register(cookie);

  const storage = new MemoryObjectStorage();
  const mockQueue = { add: async () => {} } as any;

  await registerJobRoutes(app, { storage, queue: mockQueue });

  const response = await app.inject({
    method: "POST",
    url: "/chat/magic-prompt",
    payload: {
      prompt: "a cat in space",
    },
  });

  assert.equal(response.statusCode, 401);
});

test("enhancePromptWithMagicPrompt unit test with [TEST:QA] prompt", async () => {
  const { enhancePromptWithMagicPrompt } = await import("../chat/magic-prompt.js");
  const result = await enhancePromptWithMagicPrompt({
    prompt: "[TEST:QA] seekor kucing astronot",
  });

  assert.ok(result.enhancedPrompt, "Should return an enhanced prompt");
  assert.equal(result.originalPrompt, "[TEST:QA] seekor kucing astronot");
  assert.equal(result.model, "gpt-5.6-sol");
});
