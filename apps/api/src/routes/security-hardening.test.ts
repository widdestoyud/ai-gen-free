import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { ErrorCodes } from "@ai-gen-free/core";
import { requestIp } from "../http.js";

function buildHardenedServer() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
  });

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

  app.setErrorHandler((error, req, reply) => {
    if (reply.sent) return;
    const rawCode = typeof error.code === "string" ? error.code : "";
    let status =
      typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;
    let code: string = ErrorCodes.NOT_READY;
    let message: string = "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.";

    if (rawCode === "FST_ERR_VALIDATION" || (error as any).validation) {
      code = ErrorCodes.VALIDATION_ERROR;
      message = "Data yang dikirim tidak valid.";
      status = 400;
    } else if (status === 400 || (error instanceof SyntaxError && "body" in error)) {
      code = ErrorCodes.VALIDATION_ERROR;
      message = "Format permintaan tidak valid.";
      status = 400;
    }

    reply.header("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    reply.status(status).send({
      transaction_id: req.id,
      error: { code, message },
    });
  });

  return app;
}

test("Fastify Helmet: registers security headers including CSP, HSTS, CORP, and nosniff", async () => {
  const app = buildHardenedServer();
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  app.get("/api/health", async () => ({ ok: true }));

  const res = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(res.statusCode, 200);

  // Assert Helmet headers
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
  assert.equal(
    res.headers["strict-transport-security"],
    "max-age=31536000; includeSubDomains; preload"
  );
  assert.ok(res.headers["content-security-policy"]);
  assert.ok((res.headers["content-security-policy"] as string).includes("default-src 'self'"));
  assert.ok((res.headers["content-security-policy"] as string).includes("object-src 'none'"));
  assert.ok((res.headers["content-security-policy"] as string).includes("frame-ancestors 'self'"));
});

test("Route schema enforcement: rejects missing required fields with 400 VALIDATION_ERROR", async () => {
  const app = buildHardenedServer();

  app.post(
    "/customer/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async () => ({ ok: true })
  );

  // 1. Missing both fields
  const res1 = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res1.statusCode, 400);
  const json1 = JSON.parse(res1.payload);
  assert.equal(json1.error.code, ErrorCodes.VALIDATION_ERROR);
  assert.equal(json1.error.message, "Data yang dikirim tidak valid.");

  // 2. Missing password
  const res2 = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "user@example.com" }),
  });
  assert.equal(res2.statusCode, 400);
  const json2 = JSON.parse(res2.payload);
  assert.equal(json2.error.code, ErrorCodes.VALIDATION_ERROR);
});

test("Route schema enforcement: rejects type mismatches and minLength violations", async () => {
  const app = buildHardenedServer();

  app.post(
    "/customer/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", minLength: 1 },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async () => ({ ok: true })
  );

  // Type mismatch: email is an object instead of string
  const resObject = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: { injection: true }, password: "SecretPassword1" }),
  });
  assert.equal(resObject.statusCode, 400);
  assert.equal(JSON.parse(resObject.payload).error.code, ErrorCodes.VALIDATION_ERROR);

  // Type mismatch: password is an array instead of string
  const resArray = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "user@example.com", password: ["bad", "array"] }),
  });
  assert.equal(resArray.statusCode, 400);
  assert.equal(JSON.parse(resArray.payload).error.code, ErrorCodes.VALIDATION_ERROR);

  // minLength violation: empty string email
  const resLen = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "", password: "SecretPassword1" }),
  });
  assert.equal(resLen.statusCode, 400);
  assert.equal(JSON.parse(resLen.payload).error.code, ErrorCodes.VALIDATION_ERROR);
});

test("Route schema enforcement: rejects malformed unparseable JSON payloads", async () => {
  const app = buildHardenedServer();

  app.post("/customer/register", async () => ({ ok: true }));

  const res = await app.inject({
    method: "POST",
    url: "/customer/register",
    headers: { "content-type": "application/json" },
    body: '{"email": "broken_json',
  });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.payload).error.code, ErrorCodes.VALIDATION_ERROR);
});

test("requestIp: reliably prioritizes Cloudflare and leftmost forwarded IP, stripping IPv6 prefix", () => {
  // Cloudflare priority
  const cfReq = {
    headers: {
      "cf-connecting-ip": "198.51.100.42",
      "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      "x-real-ip": "10.0.0.3",
    },
    ip: "10.0.0.4",
  };
  assert.equal(requestIp(cfReq), "198.51.100.42");

  // X-Forwarded-For leftmost hop
  const xffReq = {
    headers: {
      "x-forwarded-for": "198.51.100.99, 10.0.0.1, 172.16.0.1",
    },
  };
  assert.equal(requestIp(xffReq), "198.51.100.99");

  // IPv4-mapped IPv6 prefix stripping
  const ipv6Mapped = {
    headers: {
      "cf-connecting-ip": "::ffff:203.0.113.195",
    },
  };
  assert.equal(requestIp(ipv6Mapped), "203.0.113.195");

  // Fallback to default
  assert.equal(requestIp({}), "127.0.0.1");
});
