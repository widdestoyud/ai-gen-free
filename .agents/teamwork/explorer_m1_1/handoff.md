# Handoff Report: Fastify Server & Route Hardening Implementation Plan (M1)

**Author:** teamwork_preview_explorer (Role: Fastify Server & Route Hardening Explorer)  
**Date:** 2026-10-08T08:38:00Z  
**Target Milestone:** M1 (Backend Security Hardening & Session Protection — R1)  
**Working Directory:** `/home/ubuntu/projects/ai-gen-free/.agents/teamwork/explorer_m1_1`  
**Status:** Investigation Complete (Read-Only)

---

## 1. Observation

Direct observations from codebase inspection, package configurations, and test suite execution:

### A. Fastify Server Configuration & Security Headers (`apps/api/src/index.ts`)
1. **Missing `trustProxy`**:
   - `apps/api/src/index.ts` lines 31–42:
     ```typescript
     const app = Fastify({
       logger: true,
       rewriteUrl: (req) => rewriteRequestUrl(req.url ?? "/", req.method ?? "GET"),
       genReqId: (req) => { ... },
       requestIdHeader: "x-transaction-id",
     });
     ```
     `trustProxy` is not configured. When running behind Next.js BFF proxy or reverse proxies (Caddy/Nginx/Cloudflare), `req.ip` falls back to socket remote address or untrusted direct IP.
2. **Missing `@fastify/helmet`**:
   - `apps/api/package.json` lines 20–29 contains `@fastify/cookie`, `@fastify/cors`, `@fastify/multipart`, but lacks `@fastify/helmet`.
   - `apps/api/src/index.ts` lines 203–210: Registers CORS, cookie, and multipart, but does not register `@fastify/helmet`. Responses do not emit HSTS, CSP, X-Content-Type-Options, or Referrer-Policy headers.
   - Fastify version is `^5.6.0` (Fastify 5). The compatible helmet plugin version is `@fastify/helmet` `^13.1.1`.
3. **Existing Error Handling for Schema Validation**:
   - `apps/api/src/index.ts` lines 139–142 already handles Fastify schema errors:
     ```typescript
     } else if (rawCode === "FST_ERR_VALIDATION" || (error as any).validation) {
       code = ErrorCodes.VALIDATION_ERROR;
       message = "Data yang dikirim tidak valid.";
       status = 400;
     }
     ```
     When Fastify schema validation fails, it automatically returns HTTP 400 with `ErrorCodes.VALIDATION_ERROR` ("E002") and transaction ID.

### B. IP Resolution Divergence (`apps/api/src/http.ts` vs `apps/api/src/routes/auth.ts`)
1. **Divergent Implementation**:
   - `apps/api/src/http.ts` lines 5–12:
     ```typescript
     export function requestIp(req: { ip: string; headers: IncomingHttpHeaders }): string {
       const forwarded = req.headers["x-forwarded-for"];
       const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
       if (typeof raw === "string" && raw.length > 0) {
         return raw.split(",")[0]!.trim();
       }
       return req.ip;
     }
     ```
     `http.ts` only inspects `x-forwarded-for` and does not handle `cf-connecting-ip`, `x-real-ip`, or IPv6 prefix cleaning (`::ffff:`).
   - `apps/api/src/routes/auth.ts` lines 33–47:
     ```typescript
     function clientIp(req: { ip: string; headers: Record<string, unknown> }): string {
       const cfConnecting = req.headers["cf-connecting-ip"];
       if (typeof cfConnecting === "string" && cfConnecting.trim().length > 0) {
         return cfConnecting.trim();
       }
       const forwarded = req.headers["x-forwarded-for"];
       if (typeof forwarded === "string" && forwarded.length > 0) {
         return forwarded.split(",")[0]!.trim();
       }
       const realIp = req.headers["x-real-ip"];
       if (typeof realIp === "string" && realIp.trim().length > 0) {
         return realIp.trim();
       }
       return req.ip;
     }
     ```
     `routes/auth.ts` implements a local, unexported `clientIp` that diverges from `requestIp`. Yet `requestIp` is already imported at line 21: `import { requestIp, sendError } from "../http.js";`.
   - `routes/auth.ts` uses `clientIp` in 12 distinct locations (lines 81, 116, 184, 225, 253, 278, 294, 319, 371, 390, 416, 448), while `routes/jobs.ts`, `routes/wallet.ts`, `routes/payment.ts`, `routes/admin.ts`, and `routes/uploads.ts` all invoke `requestIp`.

### C. Route Input Validation Schemas
1. **Unvalidated Request Payloads**:
   - `apps/api/src/routes/auth.ts`: 12 endpoints accept raw untyped `req.body` with manual casting `(req.body ?? {}) as any`. No Fastify route `{ schema: { body: ... } }` is defined.
   - `apps/api/src/routes/jobs.ts`: `POST /generate/siray/:modelSlug`, `POST /generate/falai/:modelSlug`, `POST /generate/fal/:modelSlug`, `POST /generate/image-edit`, `POST /jobs`, `POST /generate/chat`, and `POST /generate/magic-prompt` rely entirely on `(req.body ?? {}) as any` and helper extraction functions.
   - `apps/api/src/routes/payment.ts`: `POST /invoices/:id/pay` casts `(req.body ?? {}) as any`.

### D. Redis Rate Limiting Atomicity & Test Suite Baseline (`apps/api/src/auth/rate-limit.ts`)
1. **Non-Atomic Multi-Roundtrip Rate Limiter**:
   - `apps/api/src/auth/rate-limit.ts` lines 20–33:
     ```typescript
     const current = await redis.incr(key);
     if (current === 1) {
       await redis.expire(key, rule.windowSeconds);
     }
     if (current > rule.maxAttempts) {
       const ttl = await redis.ttl(key);
       if (ttl < rule.lockoutSeconds) {
         await redis.expire(key, rule.lockoutSeconds);
       }
     }
     const ttl = await redis.ttl(key);
     ```
     If the process or Redis restarts between `incr` and `expire`, the key remains with TTL = -1 forever, causing permanent lockouts. It requires 4 sequential network round trips per checked request.
2. **Test Suite `MockRedis` Constraint**:
   - `apps/api/src/auth/auth-flow.test.ts` lines 17–46 defines an in-memory `MockRedis` class implementing only `incr(key)`, `expire(key, seconds)`, and `ttl(key)`. It does NOT implement `eval(...)` or `defineCommand(...)`.
   - Any rate limiter rewrite that unconditionally invokes `redis.eval(...)` without checking `typeof (redis as any).eval === "function"` will break existing unit tests in `auth-flow.test.ts`.
3. **Current Test Suite Baseline**:
   - Running `pnpm --filter @ai-gen-free/api test` outputs:
     `ℹ tests 102 | pass 102 | fail 0 | duration ~30s`. All 102 existing tests pass cleanly.

---

## 2. Logic Chain

1. **Premise**: Fastify runs without `trustProxy: true`, while the production deployment routes web requests through Next.js BFF (`apps/web/app/api/[...path]/route.ts`) and upstream reverse proxies.  
   **Inference**: Without `trustProxy: true`, Fastify cannot properly evaluate proxy hops from `X-Forwarded-For`. Enabling `trustProxy: true` allows Fastify's built-in `proxy-addr` engine to extract the true client IP, ensuring rate-limiting keys accurately track end clients rather than the BFF gateway IP.

2. **Premise**: Fastify responses currently lack security headers, exposing endpoints to MIME-sniffing, missing clickjacking protections, and lack of HSTS enforcement.  
   **Inference**: Registering `@fastify/helmet` with custom CORS/CORP configuration (`crossOriginResourcePolicy: { policy: "cross-origin" }`, `crossOriginEmbedderPolicy: false`) protects the API while ensuring cross-origin asset streaming (images, video previews) to the Next.js frontend remains fully functional.

3. **Premise**: `apps/api/src/routes/auth.ts` defines its own `clientIp` helper while all other route files use `requestIp` from `apps/api/src/http.ts`.  
   **Inference**: Unifying the logic in `requestIp` (incorporating Cloudflare `cf-connecting-ip`, leftmost `x-forwarded-for`, `x-real-ip`, IPv6 `::ffff:` stripping, and fallback to `req.ip`) and removing `clientIp` eliminates duplication and ensures identical IP resolution behavior across all endpoints.

4. **Premise**: Fastify routes lack formal request validation schemas, allowing arbitrary JSON payloads to reach service functions. However, service functions (e.g. `registerUser`) provide rich, domain-specific Indonesian error codes (`A010`, `A011`, `A018`) for business rule failures.  
   **Inference**: Route schemas should enforce structural integrity (ensuring expected fields are strings, booleans, or objects, preventing prototype pollution or type mismatches) while allowing service business logic to perform domain-specific validation (password complexity rules, domain whitelist). This prevents Fastify's generic `E002` from masking domain-specific user feedback.

5. **Premise**: The Redis rate limiter in `apps/api/src/auth/rate-limit.ts` uses separate `incr` and `expire` calls that are vulnerable to partial-execution crashes, but `auth-flow.test.ts` uses an in-memory `MockRedis` lacking `eval`.  
   **Inference**: Using an atomic Lua script when `typeof redis.eval === "function"` ensures atomic 1-roundtrip execution in production Redis, while providing a graceful sequential fallback for test `MockRedis` instances guarantees 100% test compatibility.

---

## 3. Caveats

1. **MockRedis in Tests**: The in-memory `MockRedis` in `apps/api/src/auth/auth-flow.test.ts` is a test-only class. The production rate-limiter implementation must include runtime feature detection (`typeof (redis as any).eval === "function"`) so that real Redis instances benefit from atomic Lua execution while tests continue to pass without modification.
2. **`@fastify/helmet` Cross-Origin Asset Streaming**: If `crossOriginResourcePolicy` is left at helmet's default (`same-origin`), browsers will block image requests from Next.js web (`localhost:3000`) loading API assets (`localhost:4000/customer/generated/:id/file`). Setting `crossOriginResourcePolicy: { policy: "cross-origin" }` and `crossOriginEmbedderPolicy: false` is strictly required.
3. **Pnpm Dependency Installation**: `@fastify/helmet` (`^13.1.1`) must be added to `apps/api/package.json` and installed via `pnpm install`.
4. **Scope Boundaries**: This explorer report covers Fastify server configuration, security headers, IP resolution, route schemas, and rate-limiting atomicity. BFF proxy modifications and Prisma database query optimizations are scoped to peer tasks.

---

## 4. Conclusion & Actionable Implementation Plan

Below are the exact code edits, imports, schemas, and configurations required for Milestone 1.

### Change 1: Add `@fastify/helmet` Dependency
- **File**: `apps/api/package.json`
- **Location**: In `"dependencies"`
- **Diff**:
  ```diff
   "dependencies": {
     "@ai-gen-free/core": "workspace:*",
     "@ai-gen-free/db": "workspace:*",
     "@ai-gen-free/providers-dana": "workspace:*",
     "@ai-gen-free/providers-fal": "workspace:*",
     "@ai-gen-free/providers-midtrans": "workspace:*",
     "@ai-gen-free/providers-xendit": "workspace:*",
     "@ai-gen-free/storage": "workspace:*",
     "@ai-gen-free/wallet": "workspace:*",
     "@fastify/cookie": "^11.1.2",
     "@fastify/cors": "^11.1.0",
  +  "@fastify/helmet": "^13.1.1",
     "@fastify/multipart": "^10.1.1",
     "bullmq": "^5.58.5",
  ```
- **Execution**: Run `pnpm --filter @ai-gen-free/api add @fastify/helmet@^13.1.1` (or add to `package.json` and run `pnpm install`).

---

### Change 2: Fastify `trustProxy: true` & `@fastify/helmet` Registration
- **File**: `apps/api/src/index.ts`
- **Location**: Lines 1–42 (imports & Fastify init), and lines 203–211 (plugin registrations)
- **Code Edits**:
  ```typescript
  // 1. Add import near top (e.g. line 5)
  import helmet from "@fastify/helmet";

  // 2. Enable trustProxy in Fastify options (line 31)
  const app = Fastify({
    logger: true,
    trustProxy: true,
    rewriteUrl: (req) => rewriteRequestUrl(req.url ?? "/", req.method ?? "GET"),
    genReqId: (req) => {
      const existing = req.headers["x-transaction-id"];
      if (typeof existing === "string" && existing.length >= 8 && existing.length <= 128) {
        return existing;
      }
      return `tx-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
    },
    requestIdHeader: "x-transaction-id",
  });

  // 3. Register @fastify/helmet (after cors registration, around line 208)
  await app.register(cors, {
    origin,
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  ```

---

### Change 3: Unified `requestIp` in `apps/api/src/http.ts` and Clean Up `routes/auth.ts`

#### Step 3A: Replace `apps/api/src/http.ts` lines 5–12
```typescript
import type { IncomingHttpHeaders } from "node:http";
import { AppError } from "@ai-gen-free/core";
import { AuthError } from "./auth/service.js";

/**
 * Ekstraksi IP klien secara terpadu dan aman:
 * 1. Prioritaskan header Cloudflare (cf-connecting-ip) jika ada
 * 2. Ambil hop terluar (kiri) dari x-forwarded-for
 * 3. Fallback ke x-real-ip
 * 4. Fallback ke req.ip bawaan Fastify (didukung trustProxy: true)
 * 5. Normalisasi IPv6 mapped IPv4 (menghapus ::ffff:)
 */
export function requestIp(req: {
  ip?: string;
  headers?: IncomingHttpHeaders | Record<string, unknown>;
}): string {
  const headers = req.headers ?? {};

  // 1. Cloudflare header
  const cfConnecting = headers["cf-connecting-ip"];
  if (typeof cfConnecting === "string" && cfConnecting.trim().length > 0) {
    return cfConnecting.trim().replace(/^::ffff:/, "");
  }

  // 2. X-Forwarded-For (client is leftmost IP)
  const forwarded = headers["x-forwarded-for"];
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof rawForwarded === "string" && rawForwarded.trim().length > 0) {
    const clientHop = rawForwarded.split(",")[0]?.trim();
    if (clientHop && clientHop.length > 0) {
      return clientHop.replace(/^::ffff:/, "");
    }
  }

  // 3. X-Real-IP
  const realIp = headers["x-real-ip"];
  const rawRealIp = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof rawRealIp === "string" && rawRealIp.trim().length > 0) {
    return rawRealIp.trim().replace(/^::ffff:/, "");
  }

  // 4. Fastify resolved IP
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim().replace(/^::ffff:/, "");
  }

  return "127.0.0.1";
}
```

#### Step 3B: In `apps/api/src/routes/auth.ts`
- Delete lines 33–47 (`function clientIp(...)`).
- Replace all 12 occurrences of `clientIp(req)` with `requestIp(req)`:
  - Line 81: `ip: requestIp(req)`
  - Line 116: `const ip = requestIp(req);`
  - Line 184: `ip: requestIp(req)`
  - Line 225: `ip: requestIp(req)`
  - Line 253: `ip: requestIp(req)`
  - Line 278: `ip: requestIp(req)`
  - Line 294: `ip: requestIp(req)`
  - Line 319: `req: { ip: requestIp(req), headers: req.headers }`
  - Line 371: `ip: requestIp(req)`
  - Line 390: `req: { ip: requestIp(req), headers: req.headers }`
  - Line 416: `ip: requestIp(req)`
  - Line 448: `req: { ip: requestIp(req), headers: req.headers }`

---

### Change 4: Fastify Route Input Validation Schemas

#### Step 4A: `apps/api/src/routes/auth.ts`
Attach `{ schema: { body: ... } }` to auth route registrations:

1. **`POST /customer/register`**:
   ```typescript
   app.post(
     "/customer/register",
     {
       schema: {
         body: {
           type: "object",
           required: ["email", "password"],
           properties: {
             email: { type: "string", minLength: 1 },
             password: { type: "string", minLength: 1 },
           },
           additionalProperties: true,
         },
       },
     },
     handleRegister,
   );
   ```

2. **`POST /auth/google`**:
   ```typescript
   app.post(
     "/auth/google",
     {
       schema: {
         body: {
           type: "object",
           required: ["idToken"],
           properties: {
             idToken: { type: "string", minLength: 1 },
             deviceId: { type: "string" },
           },
           additionalProperties: true,
         },
       },
     },
     async (req: any, reply: any) => { ... },
   );
   ```

3. **`POST /auth/email-validation`**:
   ```typescript
   app.post(
     "/auth/email-validation",
     {
       schema: {
         body: {
           type: "object",
           required: ["token"],
           properties: {
             token: { type: "string", minLength: 1 },
           },
           additionalProperties: true,
         },
       },
     },
     handleEmailValidation,
   );
   ```

4. **`POST /customer/login`**:
   ```typescript
   app.post(
     "/customer/login",
     {
       schema: {
         body: {
           type: "object",
           required: ["email", "password"],
           properties: {
             email: { type: "string", minLength: 1 },
             password: { type: "string", minLength: 1 },
             deviceId: { type: "string" },
             token: { type: "string" },
             sessionToken: { type: "string" },
           },
           additionalProperties: true,
         },
       },
     },
     handleLogin,
   );
   ```

5. **`POST /auth/otp`**:
   ```typescript
   app.post(
     "/auth/otp",
     {
       schema: {
         body: {
           type: "object",
           required: ["email"],
           properties: {
             email: { type: "string", minLength: 1 },
           },
           additionalProperties: true,
         },
       },
     },
     handleResendOtp,
   );
   ```

6. **`POST /auth/otp-validation`**:
   ```typescript
   app.post(
     "/auth/otp-validation",
     {
       schema: {
         body: {
           type: "object",
           required: ["email", "code"],
           properties: {
             email: { type: "string", minLength: 1 },
             code: { type: "string", minLength: 1 },
             deviceId: { type: "string" },
           },
           additionalProperties: true,
         },
       },
     },
     handleOtpValidation,
   );
   ```

7. **`PATCH /customer/profile` & `PUT /customer/profile`**:
   ```typescript
   const profileUpdateSchema = {
     schema: {
       body: {
         type: "object",
         properties: {
           displayName: { type: "string" },
           phoneNumber: { type: "string" },
           ktp: { type: "string" },
           address: { type: "string" },
           gender: { type: "string" },
           email: { type: "string" },
           acceptUploadPolicy: { type: "boolean" },
           dateOfBirth: { type: "string" },
           spicyModeEnabled: { type: "boolean" },
         },
         additionalProperties: true,
       },
     },
   };
   app.patch("/customer/profile", profileUpdateSchema, handlePatchProfile);
   app.put("/customer/profile", profileUpdateSchema, handlePatchProfile);
   ```

8. **`POST /customer/logout`**:
   ```typescript
   app.post(
     "/customer/logout",
     {
       schema: {
         body: {
           type: "object",
           properties: {
             token: { type: "string" },
             sessionToken: { type: "string" },
           },
           additionalProperties: true,
         },
       },
     },
     handleLogout,
   );
   ```

9. **`POST /customer/password-change` & `POST /customer/change-password`**:
   ```typescript
   const passwordChangeSchema = {
     schema: {
       body: {
         type: "object",
         required: ["currentPassword", "newPassword"],
         properties: {
           currentPassword: { type: "string", minLength: 1 },
           newPassword: { type: "string", minLength: 1 },
         },
         additionalProperties: true,
       },
     },
   };
   app.post("/customer/password-change", passwordChangeSchema, handleChangePassword);
   app.post("/customer/change-password", passwordChangeSchema, handleChangePassword);
   ```

10. **`POST /auth/password-reset`**:
    ```typescript
    app.post(
      "/auth/password-reset",
      {
        schema: {
          body: {
            type: "object",
            required: ["email"],
            properties: {
              email: { type: "string", minLength: 1 },
            },
            additionalProperties: true,
          },
        },
      },
      handlePasswordReset,
    );
    ```

11. **`POST /auth/password-reset-validation`**:
    ```typescript
    app.post(
      "/auth/password-reset-validation",
      {
        schema: {
          body: {
            type: "object",
            required: ["token"],
            properties: {
              token: { type: "string", minLength: 1 },
            },
            additionalProperties: true,
          },
        },
      },
      handlePasswordResetValidation,
    );
    ```

12. **`POST /auth/password-reset-confirm`**:
    ```typescript
    app.post(
      "/auth/password-reset-confirm",
      {
        schema: {
          body: {
            type: "object",
            required: ["token", "password"],
            properties: {
              token: { type: "string", minLength: 1 },
              password: { type: "string", minLength: 1 },
            },
            additionalProperties: true,
          },
        },
      },
      handlePasswordResetConfirm,
    );
    ```

#### Step 4B: `apps/api/src/routes/jobs.ts`
Attach validation schemas to generation and job endpoints:

1. **`POST /generate/siray/:modelSlug`**:
   ```typescript
   app.post(
     "/generate/siray/:modelSlug",
     {
       schema: {
         params: {
           type: "object",
           required: ["modelSlug"],
           properties: { modelSlug: { type: "string", minLength: 1 } },
         },
         body: {
           type: "object",
           properties: {
             prompt: { type: "string" },
             params: { type: "object", additionalProperties: true },
           },
           additionalProperties: true,
         },
       },
     },
     async (req, reply) => { ... },
   );
   ```

2. **`POST /generate/falai/:modelSlug` & `POST /generate/fal/:modelSlug`**:
   ```typescript
   const falSchema = {
     schema: {
       params: {
         type: "object",
         required: ["modelSlug"],
         properties: { modelSlug: { type: "string", minLength: 1 } },
       },
       body: {
         type: "object",
         properties: {
           prompt: { type: "string" },
           params: { type: "object", additionalProperties: true },
         },
         additionalProperties: true,
       },
     },
   };
   app.post("/generate/falai/:modelSlug", falSchema, handleFalGenerate);
   app.post("/generate/fal/:modelSlug", falSchema, handleFalGenerate);
   ```

3. **`POST /jobs`**:
   ```typescript
   app.post(
     "/jobs",
     {
       schema: {
         body: {
           type: "object",
           properties: {
             mode: { type: "string" },
             modelId: { type: "string" },
             prompt: { type: "string" },
             params: { type: "object", additionalProperties: true },
             providerId: { type: "string" },
           },
           additionalProperties: true,
         },
       },
     },
     async (req, reply) => { ... },
   );
   ```

4. **`POST /generate/chat` & `POST /chat/completions`**:
   ```typescript
   const chatSchema = {
     schema: {
       body: {
         type: "object",
         properties: {
           sessionId: { type: "string" },
           title: { type: "string" },
           messages: {
             type: "array",
             items: {
               type: "object",
               required: ["role", "content"],
               properties: {
                 role: { type: "string" },
                 content: { type: "string" },
               },
             },
           },
           prompt: { type: "string" },
           model: { type: "string" },
           temperature: { type: "number" },
           max_tokens: { type: "number" },
           systemInstruction: { type: "string" },
           saveSession: { type: "boolean" },
         },
         additionalProperties: true,
       },
     },
   };
   app.post("/generate/chat", chatSchema, handleChatGenerate);
   app.post("/chat/completions", chatSchema, handleChatGenerate);
   ```

5. **`POST /generate/magic-prompt` & `POST /chat/magic-prompt`**:
   ```typescript
   const magicPromptSchema = {
     schema: {
       body: {
         type: "object",
         required: ["prompt"],
         properties: {
           prompt: { type: "string", minLength: 1 },
           model: { type: "string" },
           style: { type: "string" },
         },
         additionalProperties: true,
       },
     },
   };
   app.post("/generate/magic-prompt", magicPromptSchema, handleMagicPrompt);
   app.post("/chat/magic-prompt", magicPromptSchema, handleMagicPrompt);
   ```

6. **`PATCH /customer/generated/:jobId`**:
   ```typescript
   app.patch(
     "/customer/generated/:jobId",
     {
       schema: {
         params: {
           type: "object",
           required: ["jobId"],
           properties: { jobId: { type: "string", minLength: 1 } },
         },
         body: {
           type: "object",
           properties: { alias: { type: "string" } },
           additionalProperties: true,
         },
       },
     },
     async (req, reply) => { ... },
   );
   ```

#### Step 4C: `apps/api/src/routes/payment.ts`
Attach validation schema to `POST /invoices/:id/pay`:
```typescript
app.post(
  "/invoices/:id/pay",
  {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", minLength: 1 } },
      },
      body: {
        type: "object",
        properties: {
          driver: { type: "string" },
          provider: { type: "string" },
          customerEmail: { type: "string" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
        },
        additionalProperties: true,
      },
    },
  },
  async (req, reply) => { ... },
);
```

---

### Change 5: Atomic Redis Rate-Limiting Script (`apps/api/src/auth/rate-limit.ts`)
- **File**: `apps/api/src/auth/rate-limit.ts`
- **Location**: Full file replacement
- **Proposed Content**:
```typescript
import type IORedis from "ioredis";
import type { RateLimitRule } from "@ai-gen-free/core";

export interface RateLimitResult {
  allowed: boolean;
  currentAttempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

/**
 * Lua Script untuk evaluasi rate-limit secara atomik dalam 1 round-trip ke Redis:
 * 1. Menjalankan INCR pada key
 * 2. Jika key baru dibuat (atau tersisa tanpa TTL dari crash sebelumnya), set EXPIRE windowSeconds
 * 3. Jika current > maxAttempts dan sisa TTL kurang dari lockoutSeconds, set EXPIRE lockoutSeconds
 * 4. Mengembalikan [current, ttl]
 */
const ATOMIC_RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
    ttl = tonumber(ARGV[1])
end
if current > tonumber(ARGV[2]) then
    local lockout = tonumber(ARGV[3])
    if ttl < lockout then
        redis.call('EXPIRE', KEYS[1], lockout)
        ttl = lockout
    end
end
return { current, ttl }
`;

/**
 * Memeriksa batas laju request ke Redis berdasarkan RateLimitRule.
 * Mendukung window sliding / fixed expiry dan lockout period secara atomik.
 */
export async function enforceRateLimit(
  redis: IORedis,
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  let current: number;
  let ttl: number;

  if (typeof (redis as any).eval === "function") {
    // Jalur atomik production (IORedis dengan Lua script)
    const result = (await (redis as any).eval(
      ATOMIC_RATE_LIMIT_LUA,
      1,
      key,
      String(rule.windowSeconds),
      String(rule.maxAttempts),
      String(rule.lockoutSeconds),
    )) as [number, number];
    current = Number(result[0]);
    ttl = Number(result[1]);
  } else {
    // Jalur fallback kompatibilitas unit test (untuk MockRedis tanpa dukungan eval)
    current = await redis.incr(key);
    const existingTtl = await redis.ttl(key);
    if (existingTtl === -1 || current === 1) {
      await redis.expire(key, rule.windowSeconds);
    }
    if (current > rule.maxAttempts) {
      const currentTtl = await redis.ttl(key);
      if (currentTtl < rule.lockoutSeconds) {
        await redis.expire(key, rule.lockoutSeconds);
      }
    }
    ttl = await redis.ttl(key);
  }

  const allowed = current <= rule.maxAttempts;
  const remaining = Math.max(0, rule.maxAttempts - current);

  return {
    allowed,
    currentAttempts: current,
    remainingAttempts: remaining,
    retryAfterSeconds: Math.max(0, ttl),
  };
}
```

---

## 5. Verification Method

### A. Independent Test Suite Verification
Run the backend test command:
```bash
pnpm --filter @ai-gen-free/api test
```
*Expected Result:*
- All 102 baseline tests pass with 0 failures and 0 regressions.
- Specifically verifies:
  - `apps/api/src/auth/auth-flow.test.ts`: Passes all 4 OTP rate-limiting attempts (Attempt 1–3 allowed, Attempt 4 locked out).
  - `apps/api/src/routes/empty-body.test.ts`: Passes empty JSON parsing on Fastify instance.
  - `apps/api/src/routes/chat.test.ts`: Passes unauthenticated rejection (`401 A006`) with request payload.
  - `apps/api/src/http-rewrite.test.ts`: Passes rewrite url and 404 payload shape rewriting.
  - `apps/api/src/activity/activity.test.ts`: Passes client info & IP extractor tests.

### B. Invalidation Conditions
1. **TrustProxy Invalidation**:
   Inspect `apps/api/src/index.ts`. If `Fastify({ ... })` does not include `trustProxy: true`, reverse proxy IP spoofing vulnerability persists.
2. **Helmet Invalidation**:
   Inspect `apps/api/src/index.ts`. If `await app.register(helmet, ...)` is missing, security headers (CSP, HSTS, X-Content-Type-Options) are absent from API responses.
3. **Unified RequestIp Invalidation**:
   Inspect `apps/api/src/routes/auth.ts`. If `clientIp` remains defined or if `requestIp` in `apps/api/src/http.ts` does not check `cf-connecting-ip` and leftmost `x-forwarded-for`, IP resolution remains fragmented.
4. **Rate Limit Atomicity Invalidation**:
   Inspect `apps/api/src/auth/rate-limit.ts`. If `enforceRateLimit` does not use the atomic Lua script when `redis.eval` is available, the race condition / permanent lockout bug on Redis restart remains.
5. **Schema Invalidation**:
   Inspect `apps/api/src/routes/auth.ts`, `apps/api/src/routes/jobs.ts`, and `apps/api/src/routes/payment.ts`. If route definitions omit `{ schema: ... }`, unvalidated input injection persists.
