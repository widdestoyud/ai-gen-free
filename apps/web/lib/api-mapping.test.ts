import assert from "node:assert/strict";
import { test } from "node:test";
import { API_MAPPINGS, resolveBackendPath } from "./api-mapping";

test("API_MAPPINGS contains library mapping", () => {
  const library = API_MAPPINGS.find((m) => m.FE === "/api/library");
  assert.ok(library);
  assert.equal(library.BE, "/customer/generated-lists");
  assert.equal(library.method, "GET");
});

test("resolveBackendPath maps FE paths to BE canonical paths", () => {
  assert.equal(resolveBackendPath("/api/library", "GET"), "/customer/generated-lists");
  assert.equal(resolveBackendPath("/api/jobs", "GET"), "/customer/generated-lists");
  assert.equal(resolveBackendPath("/api/jobs/job123", "GET"), "/customer/generated/job123");
  assert.equal(resolveBackendPath("/api/jobs/job123/file", "GET"), "/customer/generated/job123/file");
  assert.equal(resolveBackendPath("/api/wallet", "GET"), "/customer/coin");
  assert.equal(resolveBackendPath("/api/wallet/ledger", "GET"), "/customer/coin/ledger");
  assert.equal(resolveBackendPath("/api/user/profile", "GET"), "/customer/profile");
  assert.equal(resolveBackendPath("/api/user/login", "POST"), "/customer/login");
  assert.equal(resolveBackendPath("/api/user/register", "POST"), "/customer/register");
  assert.equal(resolveBackendPath("/api/admin/users", "GET"), "/admin/users");
  assert.equal(resolveBackendPath("/api/admin/users?q=test&limit=10", "GET"), "/admin/users?q=test&limit=10");
  assert.equal(resolveBackendPath("/api/health", "GET"), "/api/health");
});
