import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

test("Fastify handles empty application/json body gracefully without FST_ERR_CTP_EMPTY_JSON_BODY", async () => {
  const app = Fastify();

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body: string, done) => {
    if (!body || body.trim() === "") {
      done(null, {});
      return;
    }
    try {
      const json = JSON.parse(body);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  app.post("/admin/logout", async (req, _reply) => {
    return { ok: true, body: req.body };
  });

  const testCases = [
    { name: 'empty string body', opts: { body: "" } },
    { name: 'undefined body', opts: {} },
    { name: 'zero-length buffer body', opts: { body: Buffer.alloc(0) } },
    { name: 'content-length 0 header', opts: { headers: { "content-type": "application/json", "content-length": "0" } } },
  ];

  for (const tc of testCases) {
    const res = await app.inject({
      method: "POST",
      url: "/admin/logout",
      headers: {
        "content-type": "application/json",
        cookie: "sid_admin=testtoken123",
        ...(tc.opts.headers ?? {}),
      },
      body: tc.opts.body,
    });

    assert.equal(res.statusCode, 200, `Failed on ${tc.name}: status ${res.statusCode}, body ${res.payload}`);
    const payload = JSON.parse(res.payload);
    assert.equal(payload.ok, true, `Failed on ${tc.name}`);
  }
});
