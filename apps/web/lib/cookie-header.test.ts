import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeCookie, mergeCookie } from "./cookie-header";

test("sanitizeCookie: strips standard untrusted sid and sid_admin cookies", () => {
  assert.equal(sanitizeCookie("sid=untrusted_session_123"), "");
  assert.equal(sanitizeCookie("sid_admin=untrusted_admin_456"), "");
  assert.equal(
    sanitizeCookie("theme=dark; sid=evil_token; lang=id; sid_admin=evil_admin"),
    "theme=dark; lang=id"
  );
});

test("sanitizeCookie: handles case variations and adversarial casing bypass attempts", () => {
  assert.equal(sanitizeCookie("SID=forged_token"), "");
  assert.equal(sanitizeCookie("sId=forged_token"), "");
  assert.equal(sanitizeCookie("sid=forged_token"), "");
  assert.equal(sanitizeCookie("SID_ADMIN=forged_admin"), "");
  assert.equal(sanitizeCookie("Sid_Admin=forged_admin"), "");
  assert.equal(sanitizeCookie("sId_AdMiN=forged_admin"), "");
  assert.equal(sanitizeCookie("sid_admin=forged_admin"), "");
  assert.equal(
    sanitizeCookie("SID=1; Sid_Admin=2; valid_token=abc; sId=3"),
    "valid_token=abc"
  );
});

test("sanitizeCookie: handles whitespace padding, tabs, and newline attempts", () => {
  assert.equal(sanitizeCookie("   sid   = evil_token "), "");
  assert.equal(sanitizeCookie("\tsid_admin\t=\tevil_admin\t"), "");
  assert.equal(sanitizeCookie("\r\nsid=evil"), "");
  assert.equal(sanitizeCookie("   sid_admin   = 123   "), "");
  assert.equal(
    sanitizeCookie("  theme=light ;   sid=bad   ;  font=sans  "),
    "theme=light; font=sans"
  );
});

test("sanitizeCookie: handles valueless cookies, empty assignments, and multiple delimiters", () => {
  assert.equal(sanitizeCookie("sid"), "");
  assert.equal(sanitizeCookie("sid_admin"), "");
  assert.equal(sanitizeCookie("SID"), "");
  assert.equal(sanitizeCookie("sid="), "");
  assert.equal(sanitizeCookie("sid_admin="), "");
  assert.equal(sanitizeCookie(";;;sid=evil;;;"), "");
  assert.equal(sanitizeCookie(" ; ; ; "), "");
  assert.equal(sanitizeCookie(";;;sid=evil;;;other=1;;;"), "other=1");
});

test("sanitizeCookie: handles null, undefined, and empty string gracefully", () => {
  assert.equal(sanitizeCookie(null), "");
  assert.equal(sanitizeCookie(undefined), "");
  assert.equal(sanitizeCookie(""), "");
});

test("sanitizeCookie: preserves legitimately named similar cookies", () => {
  assert.equal(sanitizeCookie("sid_something=val"), "sid_something=val");
  assert.equal(sanitizeCookie("my_sid=val"), "my_sid=val");
  assert.equal(sanitizeCookie("sidadmin=val"), "sidadmin=val");
  assert.equal(sanitizeCookie("admin_sid=val"), "admin_sid=val");
  assert.equal(sanitizeCookie("sid_token=val"), "sid_token=val");
  assert.equal(sanitizeCookie("sid_admin_role=val"), "sid_admin_role=val");
});

test("sanitizeCookie: strips multiple duplicate tokens and complex injection chains", () => {
  const attackPayload =
    "sid=evil1; tracking=safe; sid_admin=evil2; sid=evil3; pref=1; SID=evil4; SID_ADMIN=evil5";
  assert.equal(sanitizeCookie(attackPayload), "tracking=safe; pref=1");
});

test("mergeCookie: strips untrusted cookies and appends trusted extra token", () => {
  const result = mergeCookie(
    "sid=attacker_token; sid_admin=attacker_admin; tracking=1",
    "sid=trusted_server_session_xyz"
  );
  assert.equal(result, "tracking=1; sid=trusted_server_session_xyz");
});

test("mergeCookie: merges trusted admin session safely", () => {
  const result = mergeCookie(
    "sid=evil; sid_admin=forged; theme=dark",
    "sid_admin=trusted_admin_token"
  );
  assert.equal(result, "theme=dark; sid_admin=trusted_admin_token");
});

test("mergeCookie: handles null/empty existing or extra cookies", () => {
  assert.equal(mergeCookie(null, "sid=trusted"), "sid=trusted");
  assert.equal(mergeCookie(undefined, "sid=trusted"), "sid=trusted");
  assert.equal(mergeCookie("", "sid=trusted"), "sid=trusted");
  assert.equal(mergeCookie("theme=dark", null), "theme=dark");
  assert.equal(mergeCookie("theme=dark", undefined), "theme=dark");
  assert.equal(mergeCookie("theme=dark", ""), "theme=dark");
  assert.equal(mergeCookie("theme=dark", "   "), "theme=dark");
  assert.equal(mergeCookie(null, null), "");
  assert.equal(mergeCookie(undefined, undefined), "");
  assert.equal(mergeCookie("sid=evil", null), "");
  assert.equal(mergeCookie("sid=evil", ""), "");
});
