import "./test-setup";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { NextRequest } from "next/server";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { adminBasicHeaders, fetchAdminApi, fetchUserApi } from "./server-api";
import { proxyFastify } from "./bff-proxy";
import { GET, POST } from "../app/api/[...path]/route";

function runWithNextContext<T>(req: NextRequest, fn: () => Promise<T>): Promise<T> {
  const reqHeaders = new Headers(req.headers);
  return workAsyncStorage.run({ route: req.nextUrl.pathname }, () => {
    return workUnitAsyncStorage.run({ type: "request", headers: reqHeaders } as any, fn);
  });
}

test("adminBasicHeaders: produces valid Basic auth header when credentials configured", () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "secret_pass_123";

  const headers = adminBasicHeaders();
  assert.ok(headers.authorization);
  assert.equal(headers.authorization, `Basic ${Buffer.from("admin:secret_pass_123").toString("base64")}`);
});

test("adminBasicHeaders: returns empty object if user or password unset", () => {
  const origUser = process.env.ADMIN_BASIC_USER;
  const origPass = process.env.ADMIN_BASIC_PASSWORD;

  try {
    delete process.env.ADMIN_BASIC_USER;
    process.env.ADMIN_BASIC_PASSWORD = "secret";
    assert.deepEqual(adminBasicHeaders(), {});

    process.env.ADMIN_BASIC_USER = "admin";
    delete process.env.ADMIN_BASIC_PASSWORD;
    assert.deepEqual(adminBasicHeaders(), {});

    delete process.env.ADMIN_BASIC_USER;
    delete process.env.ADMIN_BASIC_PASSWORD;
    assert.deepEqual(adminBasicHeaders(), {});
  } finally {
    process.env.ADMIN_BASIC_USER = origUser;
    process.env.ADMIN_BASIC_PASSWORD = origPass;
  }
});

test("fetchAdminApi & fetchUserApi: return null without sending requests when unauthenticated", async () => {
  const adminRes = await fetchAdminApi("/api/admin/me");
  assert.equal(adminRes, null);

  const userRes = await fetchUserApi("/api/user/profile");
  assert.equal(userRes, null);
});

test("BFF proxy: unauthenticated admin requests NEVER leak Authorization: Basic to upstream", async () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "super_secret_admin_pw";

  let receivedHeaders: http.IncomingHttpHeaders | null = null;
  let receivedUrl: string | null = null;

  const server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    receivedUrl = req.url ?? null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as any).port;
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${port}`;

  try {
    // Client crafts an unauthenticated request attempting to access admin route
    // and sends malicious cookies containing forged sid and sid_admin
    const clientReq = new NextRequest(`http://localhost:3000/api/admin/users`, {
      method: "GET",
      headers: {
        cookie: "sid_admin=forged_admin_token; sid=forged_user_token; tracking=safe_analytics",
        "user-agent": "AdversarialClient/1.0",
      },
    });

    const proxyRes = await runWithNextContext(clientReq, () =>
      proxyFastify(clientReq, "/admin/users", "admin")
    );
    assert.equal(proxyRes.status, 200);

    // Verify upstream server received the request
    assert.ok(receivedHeaders);
    assert.equal(receivedUrl, "/admin/users");

    // CRITICAL SECURITY ASSERTION 1: Upstream NEVER received Basic Auth credentials
    assert.equal(
      receivedHeaders["authorization"],
      undefined,
      "CRITICAL: Unauthenticated admin request leaked Authorization header to upstream!"
    );

    // CRITICAL SECURITY ASSERTION 2: Forged sid and sid_admin were completely stripped
    assert.equal(
      receivedHeaders["cookie"],
      "tracking=safe_analytics",
      "CRITICAL: Forged session cookies were not stripped from upstream request!"
    );
  } finally {
    server.close();
  }
});

test("BFF proxy route handler ([...path]): unauthenticated admin requests NEVER leak Basic Auth and sanitize cookies", async () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "super_secret_admin_pw";

  let receivedHeaders: http.IncomingHttpHeaders | null = null;
  let receivedUrl: string | null = null;

  const server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    receivedUrl = req.url ?? null;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "admin_route_ok" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as any).port;
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${port}`;

  try {
    const clientReq = new NextRequest(`http://localhost:3000/api/admin/models`, {
      method: "GET",
      headers: {
        cookie: "sid_admin=malicious_admin; sid=malicious_user; custom_tag=allow",
      },
    });

    const ctx = { params: Promise.resolve({ path: ["admin", "models"] }) };
    const res = await runWithNextContext(clientReq, () => GET(clientReq, ctx));
    assert.equal(res.status, 200);

    assert.ok(receivedHeaders);
    assert.equal(receivedUrl, "/admin/models");

    // CRITICAL SECURITY ASSERTION: No Basic auth attached for unauthenticated caller
    assert.equal(
      receivedHeaders["authorization"],
      undefined,
      "CRITICAL: App router route handler leaked Basic Auth header to upstream!"
    );

    // CRITICAL SECURITY ASSERTION: Cookies sanitized
    assert.equal(
      receivedHeaders["cookie"],
      "custom_tag=allow",
      "CRITICAL: App router route handler did not sanitize forged session cookies!"
    );
  } finally {
    server.close();
  }
});

test("BFF proxy route handler ([...path]): blocks direct access to internal /auth/google endpoint", async () => {
  const clientReq = new NextRequest("http://localhost:3000/api/auth/google", {
    method: "POST",
  });
  const ctx = { params: Promise.resolve({ path: ["auth", "google"] }) };
  const res = await GET(clientReq, ctx);
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.equal(json.error.code, "A007");
});

test("BFF proxy: unauthenticated customer requests do not attach Basic Auth and strip forged sid", async () => {
  process.env.ADMIN_BASIC_USER = "admin";
  process.env.ADMIN_BASIC_PASSWORD = "super_secret_admin_pw";

  let receivedHeaders: http.IncomingHttpHeaders | null = null;

  const server = http.createServer((req, res) => {
    receivedHeaders = req.headers;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as any).port;
  process.env.API_INTERNAL_URL = `http://127.0.0.1:${port}`;

  try {
    const clientReq = new NextRequest(`http://localhost:3000/api/customer/profile`, {
      method: "GET",
      headers: {
        cookie: "sid=forged_customer_token; theme=dark",
      },
    });

    const proxyRes = await runWithNextContext(clientReq, () =>
      proxyFastify(clientReq, "/customer/profile", "user")
    );
    assert.equal(proxyRes.status, 200);

    assert.ok(receivedHeaders);
    assert.equal(receivedHeaders["authorization"], undefined);
    assert.equal(receivedHeaders["cookie"], "theme=dark");
  } finally {
    server.close();
  }
});

test("BFF proxy: returns structured 502 E001 JSON error on upstream network failure", async () => {
  process.env.API_INTERNAL_URL = "http://127.0.0.1:59999";

  const clientReq = new NextRequest("http://localhost:3000/api/admin/users", {
    method: "GET",
  });

  const res = await runWithNextContext(clientReq, () =>
    proxyFastify(clientReq, "/admin/users", "admin")
  );
  assert.equal(res.status, 502);
  assert.equal(res.headers.get("content-type"), "application/json");

  const body = await res.json();
  assert.deepEqual(body, {
    error: {
      code: "E001",
      message: "Gagal terhubung ke layanan backend.",
    },
  });
});
