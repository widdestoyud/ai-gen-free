import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchOutputBytes, fetchWithSirayAuth, shouldAttachSirayAuth } from "./fetch-output.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("fetchWithSirayAuth adds Bearer only for /v1/ API paths, not /redirect/", async () => {
  const seen: string[] = [];
  const inner: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    seen.push(`${String(input)}|${headers.get("authorization") ?? ""}`);
    return new Response("ok", { status: 200 });
  };
  const fetchImpl = fetchWithSirayAuth("secret-token", inner);
  await fetchImpl("https://api.siray.ai/redirect/abc");
  await fetchImpl("https://api.siray.ai/v1/images/generations/async/task-1");
  await fetchImpl("https://cdn.example.com/out.png");
  assert.equal(seen[0], "https://api.siray.ai/redirect/abc|");
  assert.equal(seen[1], "https://api.siray.ai/v1/images/generations/async/task-1|Bearer secret-token");
  assert.equal(seen[2], "https://cdn.example.com/out.png|");
});

test("shouldAttachSirayAuth is false for signed redirect URLs", () => {
  assert.equal(shouldAttachSirayAuth("https://api.siray.ai/redirect/token/out.png"), false);
  assert.equal(shouldAttachSirayAuth("https://api.siray.ai/v1/images/generations/async/x"), true);
});

test("fetchOutputBytes follows 302 without forwarding Authorization to CDN", async () => {
  const seen: string[] = [];
  const inner: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    const url = String(input);
    seen.push(`${url}|${headers.get("authorization") ?? ""}`);
    if (url.includes("/redirect/")) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.com/out.png" },
      });
    }
    return new Response(PNG_1X1, { status: 200, headers: { "content-type": "image/png" } });
  };
  const fetched = await fetchOutputBytes(
    "https://api.siray.ai/redirect/abc/out.png",
    fetchWithSirayAuth("secret-token", inner),
  );
  assert.equal(seen[0], "https://api.siray.ai/redirect/abc/out.png|");
  assert.equal(seen[1], "https://cdn.example.com/out.png|");
  assert.equal(fetched.contentType, "image/png");
  assert.ok(fetched.body.byteLength > 0);
});

test("fetchOutputBytes trusts PNG magic bytes even if content-type is octet-stream", async () => {
  const inner: typeof fetch = async () =>
    new Response(PNG_1X1, { status: 200, headers: { "content-type": "application/octet-stream" } });
  const fetched = await fetchOutputBytes("https://cdn.example.com/out.bin", inner);
  assert.equal(fetched.contentType, "image/png");
});
