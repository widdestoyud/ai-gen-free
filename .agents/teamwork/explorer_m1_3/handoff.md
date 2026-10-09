# Handoff Report: BFF Proxy Hardening, Basic Auth Isolation & Cookie Security

**Explorer**: teamwork_preview_explorer (Role: BFF Proxy Hardening & Cookie Security Explorer)  
**Date**: 2026-10-08T08:42:00Z  
**Target Milestone**: Milestone 1 — Backend Security Hardening & Session Protection (R1)  
**Handoff Type**: Hard (Task Complete)  
**Artifact Directory**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3`

---

## 1. Observation

Direct observations and evidence from code analysis, static inspections, and test verifications:

### 1.1 BFF Basic Auth Credential Leak & Insecure Fallback in `apps/web/app/api/[...path]/route.ts`
- **Location**: `apps/web/app/api/[...path]/route.ts`, lines 46–67:
  ```typescript
  const isAdmin = path[0] === "admin";
  if (isAdmin) {
    const session = await adminAuth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
    } else {
      const rawSid = req.cookies.get("sid_admin")?.value;
      if (rawSid) headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${rawSid}`));
    }
    for (const [key, value] of Object.entries(adminBasicHeaders())) {
      if (!headers.has(key)) headers.set(key, value);
    }
  } else {
    const session = await auth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid=${session.sid}`));
    } else {
      const rawSid = req.cookies.get("sid")?.value;
      if (rawSid) headers.set("cookie", mergeCookie(headers.get("cookie"), `sid=${rawSid}`));
    }
  }
  ```
- **Vulnerabilities**:
  1. Lines 55–57 execute unconditionally outside the `if (session?.sid)` block. Any unauthenticated caller making a request to `/api/admin/*` causes Next.js BFF to attach `adminBasicHeaders()` (`Authorization: Basic <base64>` built from `ADMIN_BASIC_USER` and `ADMIN_BASIC_PASSWORD`). The upstream Fastify backend receives superuser Basic Auth credentials on unauthenticated requests.
  2. Lines 52–53 and lines 63–64 fall back to `req.cookies.get("sid_admin")?.value` and `req.cookies.get("sid")?.value`. When NextAuth session verification fails (`session?.sid` is null), raw unverified client cookie tokens are forwarded to the backend rather than being rejected or stripped.
  3. Mirror vulnerability exists in `apps/web/lib/bff-proxy.ts`, lines 34–41, where `adminBasicHeaders()` is also added outside `if (session?.sid)`.

### 1.2 Insecure Cookie Concatenation in `apps/web/lib/cookie-header.ts`
- **Location**: `apps/web/lib/cookie-header.ts`, lines 1–4:
  ```typescript
  export function mergeCookie(existing: string | null, extra: string): string {
    return existing ? `${existing}; ${extra}` : extra;
  }
  ```
- **Vulnerability**:
  - `mergeCookie` blindly appends `${extra}` to `${existing}` without sanitizing incoming cookies.
  - In `route.ts` line 42, `req.headers.forEach(...)` copies client request headers to the outgoing `headers` object, including client-supplied `Cookie` headers.
  - If a malicious client sends `Cookie: sid=untrusted_token; sid_admin=forged_admin`, `mergeCookie` produces `sid=untrusted_token; sid_admin=forged_admin; sid=legit_session`.
  - Upstream Fastify cookie parser (`@fastify/cookie`) evaluates duplicate cookie keys by taking the first occurrence, allowing client-injected cookies to override or tamper with server-verified session state.
  - If a client is unauthenticated, unstripped client `sid` or `sid_admin` cookies in `headers.get("cookie")` are forwarded intact to Fastify.

### 1.3 Timing Side-Channel in `apps/web/middleware.ts`
- **Location**: `apps/web/middleware.ts`, lines 20–28:
  ```typescript
  const i = decoded.indexOf(":");
  const u = i >= 0 ? decoded.slice(0, i) : "";
  const p = i >= 0 ? decoded.slice(i + 1) : "";
  if (!user || !pass || u !== user || p !== pass) {
    return new NextResponse("Autentikasi admin gagal", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }
  ```
- **Vulnerabilities**:
  1. `u !== user` and `p !== pass` perform standard JavaScript string equality. V8 compares strings character-by-character from the first index and aborts on the first mismatched byte, creating measurable timing variations.
  2. The logical OR operator `||` short-circuits: if `u !== user` is true, `p !== pass` is not evaluated. An attacker can determine whether the username was valid by measuring response latency.
  3. Direct usage of `crypto.timingSafeEqual(Buffer.from(u), Buffer.from(user))` without length normalization throws an unhandled `RangeError: Input buffers must have the same length` when input lengths differ.

### 1.4 Unhandled Upstream Network Disconnects in `apps/web/app/api/[...path]/route.ts`
- **Location**: `apps/web/app/api/[...path]/route.ts`, lines 78–108:
  ```typescript
  const upstream = await fetch(target, init);
  ...
  return new Response(upstream.body, { status: upstream.status, headers: out });
  ```
- **Vulnerabilities**:
  1. `fetch(target, init)` is not wrapped in a `try / catch` block. If the upstream Fastify service is unreachable, restarting, or encounters a socket reset / timeout (`ECONNREFUSED`, `ETIMEDOUT`, `ECONNRESET`), Next.js throws an unhandled exception and serves a generic HTML 500 error.
  2. Web frontend fetch wrappers (TanStack Query, `fetchJson`) expect JSON responses; parsing HTML 500 triggers `SyntaxError: Unexpected token '<'` and uncaught React runtime crashes.
  3. `PROJECT.md` line 62 interface contract mandates:
     `On upstream network failure, BFF returns { error: { code: "E001", message: "Gagal terhubung ke layanan backend." } } with HTTP 502/503.`
  4. Reading request body `Buffer.from(await req.arrayBuffer())` in lines 76 lacks error handling if a client disconnects mid-stream.

### 1.5 Baseline Execution & Verification Commands
- Baseline web build: `pnpm --filter @ai-gen-free/web build` succeeds cleanly (`exit 0`, Next.js 15.5.25 App Router compilation).
- Baseline backend tests: `pnpm --filter @ai-gen-free/api test` succeeds with **102 passing tests, 0 failures** (`exit 0`).
- Web tests execution: Native `node:test` via `tsx --test` runs in <500ms.

---

## 2. Logic Chain

1. **Premise**: `apps/web/app/api/[...path]/route.ts:55` appends `adminBasicHeaders()` unconditionally whenever `path[0] === "admin"`.  
   **Deduction**: Even if `adminAuth()` returns null or has no session, the outgoing request to Fastify has superuser `Authorization: Basic ...` attached. Any unauthenticated caller accessing `/api/admin/*` through the Next.js BFF is granted administrative Basic Auth rights at the backend layer.  
   **Required Action**: Move the `adminBasicHeaders()` loop strictly inside `if (session?.sid)` so Basic Auth credentials are ONLY attached when NextAuth has cryptographically verified an active admin session.

2. **Premise**: `apps/web/app/api/[...path]/route.ts:52-54, 63-65` falls back to `req.cookies.get(...)?.value` when `session?.sid` is missing.  
   **Deduction**: An unauthenticated client sending raw `sid` or `sid_admin` cookies bypasses NextAuth authentication checks and causes the proxy to forward arbitrary cookies to the backend.  
   **Required Action**: Eliminate the raw cookie fallback entirely. Only forward `sid` or `sid_admin` if verified by `auth()` / `adminAuth()`.

3. **Premise**: Incoming client `Cookie` headers are copied to `headers` at `route.ts:43`, and `mergeCookie(headers.get("cookie"), extra)` merely concatenates strings (`${existing}; ${extra}`).  
   **Deduction**: An attacker can inject forged `sid` or `sid_admin` cookies in the client request. If Fastify parses the first cookie occurrence, the attacker's cookie takes precedence over the authentic session. If the request is unauthenticated, the forged token reaches Fastify unchecked.  
   **Required Action**: Enhance `apps/web/lib/cookie-header.ts` with `sanitizeCookie` that splits the cookie string, filters out any `sid` and `sid_admin` tokens (case-insensitively and trimmed), and rewrite `mergeCookie` to append the trusted session token to the sanitized cookie list. Call `sanitizeCookie` on incoming request headers upfront in both `route.ts` and `bff-proxy.ts`.

4. **Premise**: In `apps/web/middleware.ts:23`, `u !== user || p !== pass` uses non-constant-time comparison and short-circuits. Direct `timingSafeEqual` throws `RangeError` if byte lengths do not match.  
   **Deduction**: Standard equality leaks character matches and secret lengths via timing side-channels. A robust solution must guarantee constant-time execution across arbitrary string lengths without throwing.  
   **Required Action**: Implement `safeCompare(a, b)` by computing `createHash("sha256").update(a).digest()` and `createHash("sha256").update(b).digest()`. Both hashes are exactly 32 bytes regardless of input lengths, allowing `timingSafeEqual(hashA, hashB)` to compare in constant time without exceptions. In `middleware.ts`, evaluate both `const userValid = safeCompare(u, user)` and `const passValid = safeCompare(p, pass)` unconditionally to eliminate short-circuit leaks.

5. **Premise**: `fetch(target, init)` in `route.ts:78` and `bff-proxy.ts:53` is unwrapped. If Fastify is unreachable, Next.js throws an unhandled exception and returns 500 HTML.  
   **Deduction**: This violates the interface contract defined in `PROJECT.md:62` and crashes frontend clients.  
   **Required Action**: Wrap `fetch(target, init)` in a `try / catch` block. Catch any network exception and return a structured JSON response with HTTP status 502:
   ```json
   {
     "error": {
       "code": "E001",
       "message": "Gagal terhubung ke layanan backend."
     }
   }
   ```
   Wrap top-level route dispatching in `handleProxy` with identical structured error handling.

---

## 3. Caveats

1. **Read-Only Explorer Constraint**: In accordance with the Explorer subagent role, no changes were directly applied to `apps/web/` production files. All proposed changes have been authored as standalone `.patch` files and `proposed_<filename>` artifacts in `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/` and verified with automated unit tests.
2. **Environment Variable Configuration**: In `apps/web/middleware.ts`, if `ADMIN_BASIC_USER` or `ADMIN_BASIC_PASSWORD` is undefined or empty string, `middleware()` immediately returns 401 `"Autentikasi admin gagal"` to prevent empty-string authentication bypass.
3. **Next.js Edge Runtime Compatibility**: `node:crypto` (`createHash`, `timingSafeEqual`) is fully supported in Next.js 15 Edge Runtime and compiled cleanly in `apps/web` without warnings.
4. **Third-Party Payment Webhooks**: Incoming webhooks from payment providers (`/api/webhooks/*`) pass through BFF proxying to Fastify. The body streaming logic (`Buffer.from(await req.arrayBuffer())`) preserves raw byte arrays for HMAC/MD5 signature validation.

---

## 4. Conclusion & Actionable Implementation Plan

The root causes of the BFF security vulnerabilities and upstream resilience defects have been pinpointed, and complete drop-in replacement code and unified diff patches have been created and verified.

### 4.1 Summary of Proposed Changes by Target File

| Target File | Primary Change | Security / Resilience Benefit |
|---|---|---|
| `apps/web/lib/cookie-header.ts` | Add `sanitizeCookie()`; update `mergeCookie()` to strip `sid` and `sid_admin` | Eliminates cookie injection and unauthenticated cookie forwarding |
| `apps/web/middleware.ts` | Import `timingSafeEqual`, `createHash`; add `safeCompare()`; eliminate short-circuit | Eliminates timing side-channels and length leakage on Basic Auth |
| `apps/web/app/api/[...path]/route.ts` | Strip untrusted cookies; attach `adminBasicHeaders()` ONLY if `session?.sid`; remove `rawSid` fallback; wrap `fetch` with 502 E001 structured error | Prevents Basic Auth credential leak; eliminates unverified session proxying; satisfies RFC error contract |
| `apps/web/lib/bff-proxy.ts` | Sanitize incoming cookies; move `adminBasicHeaders()` inside `session?.sid`; wrap `fetch` in try/catch returning 502 E001 | Harmonizes ad-hoc proxy routes with catch-all BFF security standards |

---

### 4.2 Exact Implementation Code & Diffs

#### Component A: `apps/web/lib/cookie-header.ts`
**Artifact**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_cookie-header.ts`  
**Patch**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/cookie-header.patch`

```typescript
/**
 * Strips untrusted session tokens (`sid`, `sid_admin`) from a raw Cookie header string.
 */
export function sanitizeCookie(existing: string | null | undefined): string {
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

/**
 * Merges a trusted session cookie into existing cookies after stripping
 * any untrusted client-supplied session identifiers.
 */
export function mergeCookie(existing: string | null | undefined, extra?: string | null): string {
  const sanitized = sanitizeCookie(existing);
  const extraTrimmed = extra?.trim();
  if (!extraTrimmed) return sanitized;
  return sanitized ? `${sanitized}; ${extraTrimmed}` : extraTrimmed;
}
```

#### Component B: `apps/web/middleware.ts`
**Artifact**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_middleware.ts`  
**Patch**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/middleware.patch`

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_BASIC_USER ?? "";
  const pass = process.env.ADMIN_BASIC_PASSWORD ?? "";
  const header = req.headers.get("authorization");

  if (!header?.startsWith("Basic ")) {
    return new NextResponse("Autentikasi admin diperlukan", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  let decoded = "";
  try {
    decoded = atob(header.slice(6));
  } catch {
    decoded = "";
  }

  const i = decoded.indexOf(":");
  const u = i >= 0 ? decoded.slice(0, i) : "";
  const p = i >= 0 ? decoded.slice(i + 1) : "";

  if (!user || !pass) {
    return new NextResponse("Autentikasi admin gagal", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  const userValid = safeCompare(u, user);
  const passValid = safeCompare(p, pass);

  if (!userValid || !passValid) {
    return new NextResponse("Autentikasi admin gagal", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

#### Component C: `apps/web/app/api/[...path]/route.ts`
**Artifact**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_route.ts`  
**Patch**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/route.patch`

Key sections:
```typescript
  // 1. Strip untrusted cookies upfront:
  const rawCookie = headers.get("cookie");
  if (rawCookie) {
    const sanitized = sanitizeCookie(rawCookie);
    if (sanitized) headers.set("cookie", sanitized);
    else headers.delete("cookie");
  }

  // 2. Strict session-bound credentials isolation:
  const isAdmin = path[0] === "admin";
  if (isAdmin) {
    const session = await adminAuth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
      for (const [key, value] of Object.entries(adminBasicHeaders())) {
        if (!headers.has(key)) headers.set(key, value);
      }
    }
  } else {
    const session = await auth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid=${session.sid}`));
    }
  }

  // 3. Upstream fetch with structured error handling:
  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    console.error(`[BFF Proxy Error] Upstream connection failure to ${target}:`, error);
    return new Response(
      JSON.stringify({
        error: {
          code: "E001",
          message: "Gagal terhubung ke layanan backend.",
        },
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
```

#### Component D: `apps/web/lib/bff-proxy.ts`
**Artifact**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_bff-proxy.ts`  
**Patch**: `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/bff-proxy.patch`

---

## 5. Verification Method

To verify these changes upon implementation by the implementer agent:

### 5.1 Automated Unit Tests
Run the unit test suites created for cookie sanitization and constant-time authentication:
```bash
pnpm --filter @ai-gen-free/web exec tsx --test \
  /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_cookie-header.test.ts \
  /home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_3/proposed_middleware.test.ts
```
*Expected*: All 15 tests pass with exit code 0.

### 5.2 Next.js Web Build Compilation
Verify that Edge Runtime and App Router compile cleanly with zero TypeScript errors:
```bash
pnpm --filter @ai-gen-free/web build
```
*Expected*: Exit code 0, all routes compiled cleanly.

### 5.3 Backend Baseline Test Suite
Verify that backend tests experience 0 regressions:
```bash
pnpm --filter @ai-gen-free/api test
```
*Expected*: All 102 tests pass, 0 failures.

### 5.4 Invalidation Conditions
- If unauthenticated requests to `/api/admin/*` carry `authorization: Basic ...`, BFF credential leak is NOT resolved.
- If client-sent `Cookie: sid=forged` appears in upstream request headers, cookie sanitization failed.
- If `safeCompare("short", "longerstring")` throws `RangeError`, timing-safe buffer length normalization is broken.
- If upstream network disconnects produce HTML 500 responses instead of `{ error: { code: "E001", ... } }`, structured error handling is incomplete.
