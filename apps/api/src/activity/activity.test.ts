import test from "node:test";
import assert from "node:assert/strict";
import { extractClientInfo, parseUserAgent } from "../lib/client-info.js";

test("Client Info Extractor: Cloudflare headers extraction", () => {
  const req = {
    ip: "127.0.0.1",
    headers: {
      "cf-connecting-ip": "114.124.200.15",
      "cf-ipcity": "Jakarta",
      "cf-ipcountry": "ID",
      "cf-region": "Jakarta",
      "cf-asorganization": "PT Telekomunikasi Selular",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  };

  const info = extractClientInfo(req);
  assert.equal(info.ip, "114.124.200.15");
  assert.equal(info.city, "Jakarta");
  assert.equal(info.country, "ID");
  assert.equal(info.region, "Jakarta");
  assert.equal(info.provider, "PT Telekomunikasi Selular");
  assert.equal(info.os, "Windows 10/11");
  assert.equal(info.browser, "Chrome 120");
  assert.equal(info.deviceType, "desktop");
});

test("Client Info Extractor: X-Forwarded-For fallback and Mobile User-Agent", () => {
  const req = {
    ip: "10.0.0.1",
    headers: {
      "x-forwarded-for": "180.252.160.10, 10.0.0.1",
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    },
  };

  const info = extractClientInfo(req);
  assert.equal(info.ip, "180.252.160.10");
  assert.equal(info.os, "iOS 17.4");
  assert.equal(info.browser, "Safari 17");
  assert.equal(info.deviceType, "mobile");
});

test("Client Info Extractor: Local / Private IP detection", () => {
  const req = {
    ip: "127.0.0.1",
    headers: {
      "user-agent": "curl/7.68.0",
    },
  };

  const info = extractClientInfo(req);
  assert.equal(info.ip, "127.0.0.1");
  assert.equal(info.provider, "Local Network / Development");
  assert.equal(info.country, "ID (Lokal)");
  assert.equal(info.deviceType, "bot");
});

test("User Agent Parser: Android Mobile", () => {
  const ua =
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36";
  const parsed = parseUserAgent(ua);
  assert.equal(parsed.os, "Android 14");
  assert.equal(parsed.browser, "Chrome 122");
  assert.equal(parsed.deviceType, "mobile");
});

test("User Agent Parser: macOS Safari", () => {
  const ua =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15";
  const parsed = parseUserAgent(ua);
  assert.equal(parsed.os, "macOS 10.15.7");
  assert.equal(parsed.browser, "Safari 16");
  assert.equal(parsed.deviceType, "desktop");
});
