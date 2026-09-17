import assert from "node:assert/strict";
import { test } from "node:test";
import { API_MAPPINGS, resolveBackendPath } from "./api-mapping";

test("API_MAPPINGS contains library mapping", () => {
  const library = API_MAPPINGS.find((m) => m.FE === "/api/library");
  assert.ok(library);
  assert.equal(library.BE, "/customer/library");
  assert.equal(library.method, "GET");
});

test("resolveBackendPath maps FE paths to BE canonical paths", () => {
  assert.equal(resolveBackendPath("/api/generate", "POST"), "/jobs");
  assert.equal(resolveBackendPath("/api/generate", "GET"), "/customer/generated-lists");
  assert.equal(resolveBackendPath("/api/generate/cmu1efgfz0001qz0zntv0iy2z", "GET"), "/customer/generated/cmu1efgfz0001qz0zntv0iy2z");
  assert.equal(resolveBackendPath("/api/generate/job123/events", "GET"), "/customer/generated/job123/events");
  assert.equal(resolveBackendPath("/api/generate/job123/file", "GET"), "/customer/generated/job123/file");
  assert.equal(resolveBackendPath("/api/library", "GET"), "/customer/library");
  assert.equal(resolveBackendPath("/api/jobs", "GET"), "/customer/generated-lists");
  assert.equal(resolveBackendPath("/api/jobs/job123", "GET"), "/customer/generated/job123");
  assert.equal(resolveBackendPath("/api/jobs/job123/events", "GET"), "/customer/generated/job123/events");
  assert.equal(resolveBackendPath("/api/jobs/job123/file", "GET"), "/customer/generated/job123/file");
  assert.equal(resolveBackendPath("/api/wallet", "GET"), "/customer/coin");
  assert.equal(resolveBackendPath("/api/wallet/ledger", "GET"), "/customer/coin/ledger");
  assert.equal(resolveBackendPath("/api/user/profile", "GET"), "/customer/profile");
  assert.equal(resolveBackendPath("/api/user/login", "POST"), "/customer/login");
  assert.equal(resolveBackendPath("/api/user/register", "POST"), "/customer/register");
  assert.equal(resolveBackendPath("/api/admin/users", "GET"), "/admin/users");
  assert.equal(resolveBackendPath("/api/admin/models/settings", "GET"), "/admin/models/settings");
  assert.equal(resolveBackendPath("/api/admin/models/settings", "PUT"), "/admin/models/settings");
  assert.equal(resolveBackendPath("/api/admin/models/m1", "PATCH"), "/admin/model/m1");
  assert.equal(resolveBackendPath("/api/admin/models", "GET"), "/admin/models");
  assert.equal(resolveBackendPath("/api/customer-uploads", "POST"), "/customer/uploads");
  assert.equal(resolveBackendPath("/api/customer-uploads/up_123", "DELETE"), "/customer/uploads/up_123");
  assert.equal(resolveBackendPath("/api/customer-uploads/up_123", "PATCH"), "/customer/uploads/up_123");
  assert.equal(resolveBackendPath("/api/customer-uploads/up_123/file", "GET"), "/customer/uploads/up_123/file");
  assert.equal(resolveBackendPath("/api/customer-images", "GET"), "/customer/uploads");
  assert.equal(resolveBackendPath("/api/customer-images/up_123", "DELETE"), "/customer/uploads/up_123");
  assert.equal(resolveBackendPath("/api/customer-images/up_123", "PATCH"), "/customer/uploads/up_123");
  assert.equal(resolveBackendPath("/api/customer-images/up_123/file", "GET"), "/customer/uploads/up_123/file");
  assert.equal(resolveBackendPath("/api/customer-images?limit=50&offset=0", "GET"), "/customer/uploads?limit=50&offset=0");
  assert.equal(resolveBackendPath("/api/customer/uploads", "POST"), "/customer/uploads");
  assert.equal(resolveBackendPath("/api/customer/uploads/up_123", "DELETE"), "/customer/uploads/up_123");
  assert.equal(resolveBackendPath("/api/customer/uploads/up_123/file", "GET"), "/customer/uploads/up_123/file");
  assert.equal(resolveBackendPath("/api/admin/uploads", "POST"), "/admin/uploads");
  assert.equal(resolveBackendPath("/api/admin/uploads/up_123/file", "GET"), "/admin/uploads/up_123/file");
  assert.equal(resolveBackendPath("/api/health", "GET"), "/api/health");
});
