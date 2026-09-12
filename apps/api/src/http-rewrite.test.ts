import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import { rewriteRequestUrl } from "./http-rewrite.js";

test("keeps /api/health", () => {
  assert.equal(rewriteRequestUrl("/api/health", "GET"), "/api/health");
});

test("strips /api prefix then maps legacy customer paths", () => {
  assert.equal(rewriteRequestUrl("/api/user/login", "POST"), "/customer/login");
  assert.equal(rewriteRequestUrl("/api/user/register", "POST"), "/customer/register");
  assert.equal(rewriteRequestUrl("/api/user/profile", "GET"), "/customer/profile");
  assert.equal(rewriteRequestUrl("/api/user/profile", "PATCH"), "/customer/profile");
  assert.equal(rewriteRequestUrl("/api/user/logout", "POST"), "/customer/logout");
  assert.equal(rewriteRequestUrl("/api/auth/logout", "POST"), "/customer/logout");
  assert.equal(rewriteRequestUrl("/api/me", "GET"), "/customer/profile");
  assert.equal(rewriteRequestUrl("/api/wallet", "GET"), "/customer/coin");
  assert.equal(rewriteRequestUrl("/api/wallet/ledger", "GET"), "/customer/coin/ledger");
  assert.equal(rewriteRequestUrl("/api/jobs", "GET"), "/customer/generated-lists");
  assert.equal(rewriteRequestUrl("/api/jobs/abc123", "GET"), "/customer/generated/abc123");
  assert.equal(rewriteRequestUrl("/api/jobs/abc123/file", "GET"), "/customer/generated/abc123/file");
  assert.equal(rewriteRequestUrl("/api/jobs", "POST"), "/jobs");
  assert.equal(rewriteRequestUrl("/api/catalog/generate", "GET"), "/customer/models");
  assert.equal(rewriteRequestUrl("/api/catalog/topup", "GET"), "/customer/packages");
  assert.equal(rewriteRequestUrl("/api/auth/otp/verify", "POST"), "/auth/otp-validation");
  assert.equal(rewriteRequestUrl("/api/auth/otp/request", "POST"), "/auth/otp");
  assert.equal(rewriteRequestUrl("/api/auth/otp", "POST"), "/auth/otp");
});

test("maps admin legacy paths", () => {
  assert.equal(rewriteRequestUrl("/api/admin/login", "POST"), "/admin/login");
  assert.equal(rewriteRequestUrl("/api/admin/me", "GET"), "/admin/me");
  assert.equal(rewriteRequestUrl("/api/admin/users", "GET"), "/admin/users");
  assert.equal(
    rewriteRequestUrl("/api/admin/users/u1/wallet/adjust", "POST"),
    "/admin/topup/poin/u1",
  );
  assert.equal(rewriteRequestUrl("/api/admin/models/m1", "PATCH"), "/admin/model/m1");
  assert.equal(rewriteRequestUrl("/api/admin/models", "GET"), "/admin/models");
  assert.equal(rewriteRequestUrl("/api/admin/auth/logout", "POST"), "/admin/logout");
});

test("preserves query string", () => {
  assert.equal(rewriteRequestUrl("/api/admin/users?q=a&limit=10", "GET"), "/admin/users?q=a&limit=10");
  assert.equal(rewriteRequestUrl("/health", "GET"), "/api/health");
});

test("Fastify default 404 payload is rewritten to project error shape", async () => {
  const app = Fastify({
    rewriteUrl: (req) => rewriteRequestUrl(req.url ?? "/", req.method ?? "GET"),
  });
  app.addHook("preSerialization", async (req, _reply, payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      (payload as { statusCode?: unknown }).statusCode === 404 &&
      (payload as { error?: unknown }).error === "Not Found"
    ) {
      return {
        transaction_id: req.id,
        error: { code: "E003", message: "Rute tidak ditemukan" },
      };
    }
    return payload;
  });
  app.get("/ping", async () => ({ ok: true }));

  const missing = await app.inject({ method: "GET", url: "/does-not-exist" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "E003");
  assert.equal(missing.json().error.message, "Rute tidak ditemukan");
  await app.close();
});

test("Fastify rewriteUrl routes legacy /api paths to canonical handlers", async () => {
  const app = Fastify({
    rewriteUrl: (req) => rewriteRequestUrl(req.url ?? "/", req.method ?? "GET"),
  });
  app.post("/customer/login", async () => ({ ok: true, route: "customer-login" }));
  app.get("/customer/profile", async () => ({ ok: true, route: "profile" }));
  app.get("/customer/generated-lists", async () => ({ ok: true, route: "lists" }));
  app.get("/customer/generated/:jobId/file", async () => ({ ok: true, route: "file" }));
  app.get("/admin/users", async () => ({ ok: true, route: "admin-users" }));
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: "E003", message: "Rute tidak ditemukan" } });
  });

  const login = await app.inject({ method: "POST", url: "/api/user/login", payload: {} });
  assert.equal(login.statusCode, 200);
  assert.equal(login.json().route, "customer-login");

  const profile = await app.inject({ method: "GET", url: "/api/me" });
  assert.equal(profile.statusCode, 200);
  assert.equal(profile.json().route, "profile");

  const jobs = await app.inject({ method: "GET", url: "/api/jobs" });
  assert.equal(jobs.statusCode, 200);
  assert.equal(jobs.json().route, "lists");

  const file = await app.inject({ method: "GET", url: "/api/jobs/abc123/file" });
  assert.equal(file.statusCode, 200);
  assert.equal(file.json().route, "file");

  const users = await app.inject({ method: "GET", url: "/api/admin/users?q=a" });
  assert.equal(users.statusCode, 200);
  assert.equal(users.json().route, "admin-users");

  const missing = await app.inject({ method: "GET", url: "/api/does-not-exist" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "E003");

  await app.close();
});
