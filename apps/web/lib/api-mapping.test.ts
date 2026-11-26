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

test("API_MAPPINGS contains template mappings in specific-before-wildcard order", () => {
  const findIdx = (fe: string, method: string) =>
    API_MAPPINGS.findIndex((m) => m.FE === fe && m.method === method);

  const custListIdx = findIdx("/api/templates", "GET");
  const custCatIdx = findIdx("/api/templates/categories", "GET");
  const custUseIdx = findIdx("/api/templates/:id/use", "POST");
  assert.ok(custListIdx >= 0);
  assert.ok(custCatIdx >= 0);
  assert.ok(custUseIdx >= 0);
  assert.ok(custCatIdx < custUseIdx);

  const adminListIdx = findIdx("/api/admin/templates", "GET");
  const adminCreateIdx = findIdx("/api/admin/templates", "POST");
  const adminAssetIdx = findIdx("/api/admin/templates/assets", "POST");
  const adminGetIdx = findIdx("/api/admin/templates/:id", "GET");
  const adminPatchIdx = findIdx("/api/admin/templates/:id", "PATCH");
  const adminDeleteIdx = findIdx("/api/admin/templates/:id", "DELETE");

  assert.ok(adminListIdx >= 0);
  assert.ok(adminCreateIdx >= 0);
  assert.ok(adminAssetIdx >= 0);
  assert.ok(adminGetIdx >= 0);
  assert.ok(adminPatchIdx >= 0);
  assert.ok(adminDeleteIdx >= 0);
  assert.ok(adminAssetIdx < adminGetIdx);
  assert.ok(adminAssetIdx < adminPatchIdx);
  assert.ok(adminAssetIdx < adminDeleteIdx);
});

test("resolveBackendPath maps template FE paths to BE canonical paths", () => {
  assert.equal(resolveBackendPath("/api/templates", "GET"), "/customer/templates");
  assert.equal(
    resolveBackendPath("/api/templates?page=2&limit=12&sort=trending&spicy=0", "GET"),
    "/customer/templates?page=2&limit=12&sort=trending&spicy=0",
  );
  assert.equal(resolveBackendPath("/api/templates/categories", "GET"), "/customer/templates/categories");
  assert.equal(
    resolveBackendPath("/api/templates/categories?spicy=1", "GET"),
    "/customer/templates/categories?spicy=1",
  );
  assert.equal(resolveBackendPath("/api/templates/t1/use", "POST"), "/customer/templates/t1/use");
  assert.equal(resolveBackendPath("/api/templates/images/img123/file", "GET"), "/customer/templates/images/img123/file");
  assert.equal(
    resolveBackendPath("/api/templates/images/img123/file?thumb=1", "GET"),
    "/customer/templates/images/img123/file?thumb=1",
  );

  assert.equal(resolveBackendPath("/api/admin/templates", "GET"), "/admin/templates");
  assert.equal(
    resolveBackendPath("/api/admin/templates?page=1&limit=20", "GET"),
    "/admin/templates?page=1&limit=20",
  );
  assert.equal(resolveBackendPath("/api/admin/templates", "POST"), "/admin/templates");
  assert.equal(resolveBackendPath("/api/admin/templates/assets", "POST"), "/admin/templates/assets");
  assert.equal(resolveBackendPath("/api/admin/templates/t1", "GET"), "/admin/templates/t1");
  assert.equal(resolveBackendPath("/api/admin/templates/t1", "PATCH"), "/admin/templates/t1");
  assert.equal(resolveBackendPath("/api/admin/templates/t1", "DELETE"), "/admin/templates/t1");
});
