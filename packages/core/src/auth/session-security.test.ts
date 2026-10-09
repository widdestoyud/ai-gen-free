import test from "node:test";
import assert from "node:assert/strict";
import {
  isAutomatedToolUserAgent,
  extractUaFingerprint,
  isUserAgentMatching,
  isSubnetMatching,
  verifySessionBinding,
} from "./session-security.js";

test("isAutomatedToolUserAgent detects automation & penetration testing tools", () => {
  assert.equal(isAutomatedToolUserAgent("PostmanRuntime/7.39.0"), true);
  assert.equal(isAutomatedToolUserAgent("Mozilla/5.0 (compatible; BurpSuite)"), true);
  assert.equal(isAutomatedToolUserAgent("curl/8.5.0"), true);
  assert.equal(isAutomatedToolUserAgent("python-requests/2.31.0"), true);
  assert.equal(isAutomatedToolUserAgent("Go-http-client/1.1"), true);
  assert.equal(isAutomatedToolUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36"), false);
});

test("extractUaFingerprint extracts OS and Browser family", () => {
  const winChrome = extractUaFingerprint("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36");
  assert.equal(winChrome.os, "windows");
  assert.equal(winChrome.browser, "chrome");

  const macSafari = extractUaFingerprint("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15");
  assert.equal(macSafari.os, "macos");
  assert.equal(macSafari.browser, "safari");

  const postman = extractUaFingerprint("PostmanRuntime/7.39.0");
  assert.equal(postman.browser, "postman");
});

test("isUserAgentMatching blocks stolen token used in Postman, Burp, or different browser", () => {
  const browserUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36";
  const sameBrowserDiffVersion = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36";
  const postmanUa = "PostmanRuntime/7.39.0";
  const curlUa = "curl/8.5.0";
  const linuxFirefoxUa = "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0";

  // Same browser family & OS -> Allowed
  assert.equal(isUserAgentMatching(browserUa, sameBrowserDiffVersion), true);

  // Stolen to Postman -> Rejected!
  assert.equal(isUserAgentMatching(browserUa, postmanUa), false);

  // Stolen to cURL -> Rejected!
  assert.equal(isUserAgentMatching(browserUa, curlUa), false);

  // Stolen to Linux Firefox -> Rejected!
  assert.equal(isUserAgentMatching(browserUa, linuxFirefoxUa), false);

  // Missing incoming UA -> Rejected!
  assert.equal(isUserAgentMatching(browserUa, undefined), false);
});

test("isSubnetMatching handles IPv4 /24 and IPv6 /64 correctly", () => {
  // Same IPv4 subnet (/24)
  assert.equal(isSubnetMatching("203.0.113.10", "203.0.113.25"), true);

  // Different IPv4 subnet
  assert.equal(isSubnetMatching("203.0.113.10", "198.51.100.5"), false);

  // Localhost
  assert.equal(isSubnetMatching("127.0.0.1", "127.0.0.1"), true);
  assert.equal(isSubnetMatching("::1", "127.0.0.1"), true);
});

test("verifySessionBinding validates all security dimensions", () => {
  const session = {
    ip: "203.0.113.10",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
  };

  // Valid legitimate user
  const legitResult = verifySessionBinding(session, {
    ip: "203.0.113.15",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
  });
  assert.equal(legitResult.valid, true);

  // Attacker via Postman
  const postmanAttack = verifySessionBinding(session, {
    ip: "203.0.113.10",
    userAgent: "PostmanRuntime/7.39.0",
  });
  assert.equal(postmanAttack.valid, false);
  assert.equal(postmanAttack.reason, "USER_AGENT_MISMATCH");

  // Attacker from different country/IP network
  const ipAttack = verifySessionBinding(session, {
    ip: "103.20.10.5",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
  });
  assert.equal(ipAttack.valid, false);
  assert.equal(ipAttack.reason, "IP_MISMATCH");
});
