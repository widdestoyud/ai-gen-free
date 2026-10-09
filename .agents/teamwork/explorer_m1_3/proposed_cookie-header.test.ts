import test from "node:test";
import assert from "node:assert/strict";

/**
 * Mirror of proposed apps/web/lib/cookie-header.ts implementation
 */
function sanitizeCookie(existing: string | null | undefined): string {
  if (!existing) return "";
  return existing
    .split(";")
    .map((c) => c.trim())
    .filter((c) => {
      if (!c) return false;
      const eqIdx = c.indexOf("=");
      const name = (eqIdx === -1 ? c : c.slice(0, eqIdx)).trim().toLowerCase();
      return name !== "sid" && name !== "sid_admin";
    })
    .join("; ");
}

function mergeCookie(existing: string | null | undefined, extra?: string | null): string {
  const sanitized = sanitizeCookie(existing);
  const extraTrimmed = extra?.trim();
  if (!extraTrimmed) return sanitized;
  return sanitized ? `${sanitized}; ${extraTrimmed}` : extraTrimmed;
}

test("sanitizeCookie: handles null, undefined, empty string", () => {
  assert.equal(sanitizeCookie(null), "");
  assert.equal(sanitizeCookie(undefined), "");
  assert.equal(sanitizeCookie(""), "");
  assert.equal(sanitizeCookie("   "), "");
});

test("sanitizeCookie: strips client-supplied sid cookie", () => {
  assert.equal(sanitizeCookie("sid=forged_token_123"), "");
  assert.equal(sanitizeCookie("theme=dark; sid=forged_token_123; locale=id"), "theme=dark; locale=id");
});

test("sanitizeCookie: strips client-supplied sid_admin cookie", () => {
  assert.equal(sanitizeCookie("sid_admin=evil_admin_token"), "");
  assert.equal(sanitizeCookie("sid_admin=evil; font=lg; sid=evil2"), "font=lg");
});

test("sanitizeCookie: handles mixed case and whitespace", () => {
  assert.equal(sanitizeCookie("  SID =malicious ; other=val  "), "other=val");
  assert.equal(sanitizeCookie("  sId_AdMiN =malicious ; ok=1"), "ok=1");
});

test("sanitizeCookie: preserves cookies with similar names", () => {
  assert.equal(sanitizeCookie("side=left; sid_token=abc; my_sid=xyz"), "side=left; sid_token=abc; my_sid=xyz");
});

test("mergeCookie: merges extra into null or empty existing cookies", () => {
  assert.equal(mergeCookie(null, "sid=trusted"), "sid=trusted");
  assert.equal(mergeCookie(undefined, "sid_admin=trusted_admin"), "sid_admin=trusted_admin");
  assert.equal(mergeCookie("", "sid=trusted"), "sid=trusted");
});

test("mergeCookie: strips existing sid before appending trusted sid", () => {
  const incoming = "theme=dark; sid=client_bad; locale=id";
  const result = mergeCookie(incoming, "sid=server_trusted");
  assert.equal(result, "theme=dark; locale=id; sid=server_trusted");
});

test("mergeCookie: strips existing sid_admin before appending trusted sid_admin", () => {
  const incoming = "sid_admin=client_evil; sid=client_evil2; theme=dark";
  const result = mergeCookie(incoming, "sid_admin=server_admin_trusted");
  assert.equal(result, "theme=dark; sid_admin=server_admin_trusted");
});

test("mergeCookie: returns sanitized cookie when extra is null or empty", () => {
  const incoming = "theme=dark; sid=client_bad";
  assert.equal(mergeCookie(incoming, null), "theme=dark");
  assert.equal(mergeCookie(incoming, ""), "theme=dark");
  assert.equal(mergeCookie(incoming, undefined), "theme=dark");
  assert.equal(mergeCookie("sid=client_bad", null), "");
});
