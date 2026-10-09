# Frontend Architecture, Component Standardization & BFF Survey Report

**Explorer**: `teamwork_preview_explorer` (Frontend Architecture & Optimization Explorer)  
**Date**: 2026-10-08  
**Scope**: `@ai-gen-free/web` (Next.js 15, React 19, Mantine 8, TanStack Query 5, NextAuth v5) & BFF Integration to `@ai-gen-free/api`  
**Target Milestone**: Survey & Audit for Requirements R1, R2, and R3  

---

## 1. Observation

### 1.1 Next.js App Router Architecture & Route Duplication
- **Root Layout & Provider Setup** (`apps/web/app/layout.tsx:43-77`, `apps/web/components/app-providers.tsx:22-93`):
  - Root layout initializes Mantine (`ColorSchemeScript defaultColorScheme="dark"`), Google Tag Manager, and `<AppProviders>`.
  - `AppProviders` wraps the tree in `PersistQueryClientProvider` and `MantineProvider theme={theme} defaultColorScheme="dark"`.
  - TanStack Query client configured with `staleTime: 5 mins`, `gcTime: 24 hrs`, `refetchOnWindowFocus: false`, `refetchOnMount: false`.
- **Duplicate & Redundant Page Routes**:
  - `apps/web/app/app/checkout/page.tsx:1-5`: Literally re-exports `../../checkout/page`. Both `/checkout` and `/app/checkout` exist.
  - `apps/web/app/landing-page/page.tsx:1-28`: Completely duplicates `apps/web/app/page.tsx:1-28`, serving the exact same landing page under `/landing-page`.
  - `apps/web/app/app/order/failed/page.tsx:1-21` duplicates `apps/web/app/payment/failed/page.tsx:1-21`.
  - `apps/web/app/app/order/success/page.tsx:1-21` duplicates `apps/web/app/payment/success/page.tsx:1-21`.

### 1.2 Mantine Component Patterns & Styling Policy Violations
`apps/web/AGENTS.md` explicitly specifies:
> "Wajib: Mantine 8 (`@mantine/core`). Default dark. Tidak ada `style={{ … }}`."

- **Pervasive Inline Style (`style={{ ... }}`) Violations (126+ occurrences across codebase)**:
  - `apps/web/components/app-workspace.tsx:204-214`: Raw `style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", display: "flex", ... }}` on logo wrapper.
  - `apps/web/components/google-auth-button.tsx:75, 89, 98`: Inline styles for colors, text-decoration.
  - `apps/web/components/responsive-table/responsive-table.tsx:67-70, 94`: `style={{ textAlign: col.align || "left", width: col.width }}` instead of Mantine style props (`ta`, `w`).
  - `apps/web/components/snap-payment-modal.tsx:215, 226, 332, 385, 405`: Inline background, textAlign, display styles.
  - `apps/web/app/checkout/page.tsx:16`: `style={{ minHeight: "100vh", background: "#050b14" }}` instead of Mantine `mih="100vh" bg="..."`.
  - `apps/web/views/checkout/checkout-view.tsx:558, 574, 587, 596, 603`: Inline styles on paper, text, QR image.
  - `apps/web/views/checkout/checkout-icons.tsx:79, 91, 107, 124, 131, 139, 145, 160, 169, 184, 190, 205, 226, 244, 250`: Raw `style={{ display: "flex", alignItems: "center", ... }}` and color overrides instead of `<Group>` or Mantine theme tokens.
  - `apps/web/views/payment/payment-failed-view.tsx:73, 101, 112, 119, 163` & `views/payment/payment-success-view.tsx:99, 126, 137, 144, 206, 214, 216, 228`: Inline styles on cards, text, and SVG icons.
  - `apps/web/views/app/order/components/order-client.tsx:303-306`: Raw inline gradient and border style.
- **Custom Controls Duplicating Mantine Built-ins**:
  - `apps/web/views/app/generate/components/generate-studio.tsx:208-226` & `generate-studio.tsx:544-561`: Implements custom segmented pill buttons using raw `<button type="button" className={classes.pillBtn}>` instead of Mantine's `<SegmentedControl>`.
  - `apps/web/views/app/generate/components/generate-studio.tsx:345-360`: Raw `<button>` used as `<HoverCard.Target>` instead of Mantine `<ActionIcon>`.
  - `apps/web/views/app/generate/components/generate-studio.tsx:512-524`: Raw `<button type="submit" className={classes.fancyGenerateBtn}>` instead of Mantine `<Button variant="gradient">`.
  - `apps/web/views/app/library/components/library-view.tsx:60-71`: Custom tabs using raw `<div className={classes.tabsRow}><button className={classes.tabBtn}>` instead of Mantine `<Tabs>`.
  - `apps/web/views/app/library/components/library-view.tsx:98-100`: Raw `<button className={classes.iconBtn}>` as `<Menu.Target>` instead of `<ActionIcon>`.
- **Custom SVG Icons Proliferation**:
  - Redundant SVG implementations of identical icons across multiple files (`DownloadIcon`, `SearchIcon`, `ExternalLinkIcon`, `SparkleIcon`, `PencilIcon`, etc. re-declared in `credit-history.tsx`, `order-client.tsx`, `media-detail-modal.tsx`, `checkout-icons.tsx`, `admin-workspace.tsx`, `app-workspace.tsx`).

### 1.3 State Management & Component Re-render Inefficiencies
- **Anti-Pattern: Mirroring React Query Cache / Props in Local `useState`**:
  - `apps/web/hooks/use-generate-studio.ts:182-202, 281`: `localModels` and `localDefaults` in `useState`, synchronized via `useEffect` whenever `props.models` change. Duplicates `catalogQuery.data`.
  - `apps/web/hooks/use-generate-studio.ts:251, 310, 571, 580, 612, 1005`: `jobs` state initialized from `props.jobs`, synchronized via `useEffect` on `jobsQuery.data.jobs`, and manually mutated alongside `queryClient.invalidateQueries`. Triggers double re-renders on every job status update.
- **Leaking Business Logic, HTTP Requests, and Queries into Presentation Views**:
  `apps/web/AGENTS.md` strictly establishes:
  > "Controller = Custom Hook di `hooks/`... Semua state, side effects, API requests, validasi form harus berada di custom hook. Tidak ada `fetch`, `requestJson`, atau mutasi state kompleks langsung di komponen presentasi."
  - `apps/web/views/app/billing/billing-view.tsx:48-93`: Directly calls `useQuery` for wallet and `useQuery` for ledger instead of using `useWallet` or a controller hook.
  - `apps/web/views/app/order/order-view.tsx:51-108`: Directly calls `useQuery` for packages, wallet, and invoices inside the view.
  - `apps/web/views/app/generate/components/generate-studio.tsx:102-128`: `handleMagicPrompt` performs raw `fetch("/api/generate/magic-prompt")` and manages `isMagicPromptLoading` state inside the UI component instead of inside `use-generate-studio.ts`.
  - `apps/web/views/app/billing/components/credit-history.tsx:132-149`: Ad-hoc `requestJson(`/api/generate/${selectedEntry.jobId}`)` inside component `useEffect`.
  - `apps/web/views/app/order/components/order-client.tsx:145-180`: Direct `requestJson("/api/invoices")` mutation inside presentation component.
- **Duplicated Modal State & Handlers**:
  - `apps/web/views/checkout/checkout-view.tsx:92-120` replicates verbatim the modal switching logic (`handleOpenRegisterFromLogin`, `handleOpenLoginFromRegister`, `handleOpenForgotPassword`, `handleBackToLoginFromForgot`) found in `apps/web/hooks/use-landing-page.ts:60-85`.

### 1.4 React Query Cache Synchronization & Persistence Issues
- **Fragmented / Inconsistent Query Keys for Same Upstream Resource**:
  - `apps/web/lib/query-keys.ts:18`: `catalogPackages: () => ["catalog-topup-packages"]` used in `views/checkout/checkout-view.tsx:131`.
  - `apps/web/lib/query-keys.ts:24`: `orderPackages: () => ["order-packages"]` used in `views/app/order/order-view.tsx:52`.
  - Both fetch the exact same endpoint (`/api/catalog/topup`), but their separate query keys prevent cache sharing between checkout and order views.
  - `apps/web/views/app/library/components/media-detail-modal.tsx:355`: Uses hardcoded literal array `["catalog-generate"]` instead of centralized factory `queryKeys.catalogGenerate()`.
- **Missing Cache Invalidations on State Mutations**:
  - `apps/web/hooks/use-account-settings.ts:287-318`: `saveField` updates user profile (`/api/customer/profile`), but NEVER invalidates `queryKeys.customerProfile()` or `queryKeys.userStatus()`. Checkout view retains stale user profile for up to 5 minutes.
  - `apps/web/hooks/use-account-settings.ts:462, 488`: `toggleSpicyMode` and `confirmSpicyConsent` update spicy mode on backend, but NEVER invalidate `queryKeys.userStatus()`. Studio generator continues to see outdated `spicyModeEnabled: false`.
  - `apps/web/hooks/use-library.ts:370-383`: `acceptUploadPolicy` calls `PATCH /api/customer/profile`, but NEVER invalidates `queryKeys.userStatus()` or `queryKeys.customerProfile()`. Studio generator retains null `uploadPolicyAcceptedAt`.
- **Query Cache Persistence Inaccuracy**:
  - `apps/web/components/app-providers.tsx:10-20`: `WALLET_DISALLOWED_CACHE_KEYS` excludes wallet/billing/ledger from `localStorage` sync.
  - However, `"user-status"` (which holds cooldown timestamps and policy flags) is NOT in `WALLET_DISALLOWED_CACHE_KEYS`. Stale user cooldown or policy state is persisted to `localStorage` across page reloads.

### 1.5 Next.js BFF Proxy Routes, Security & Forbidden Polling
- **Architectural Schism: Catch-all Proxy vs Shadowing Individual Route Handlers**:
  - Standard catch-all proxy exists at `apps/web/app/api/[...path]/route.ts:28-108` and utilizes `lib/api-mapping.ts`.
  - 10 individual route files duplicate/shadow this mechanism using `lib/bff-proxy.ts` or raw fetch:
    1. `apps/web/app/api/customer-profile/route.ts` (proxies to `/api/user/profile`)
    2. `apps/web/app/api/email-validation/route.ts` (proxies to `/api/auth/email-validation`)
    3. `apps/web/app/api/register/route.ts` (proxies to `/api/user/register`)
    4. `apps/web/app/api/generate/magic-prompt/route.ts` (proxies to `/generate/magic-prompt`)
    5. `apps/web/app/api/generate/chat/route.ts` (proxies to `/generate/chat`)
    6. `apps/web/app/api/reset-password/route.ts` (proxies to `/api/auth/password-reset`)
    7. `apps/web/app/api/reset-password-confirm/route.ts` (proxies to `/api/auth/password-reset-confirm`)
    8. `apps/web/app/api/reset-password-validation/route.ts` (proxies to `/api/auth/password-reset-validation`)
    9. `apps/web/app/api/otp-request/route.ts` (unused dead route)
    10. `apps/web/app/api/auth/otp/verify/route.ts` vs `apps/web/app/api/otp-validation/route.ts` (two identical implementations of NextAuth OTP sign-in).
- **Security & Cookie Ingestion Vulnerability**:
  - `apps/web/lib/cookie-header.ts:1-3`:
    ```ts
    export function mergeCookie(existing: string | null, extra: string): string {
      return existing ? `${existing}; ${extra}` : extra;
    }
    ```
    If an unauthenticated client sends a forged `Cookie: sid=attacker_token` in the incoming request, `mergeCookie` appends rather than replaces it. If Fastify parses the first cookie parameter, a forged token could precede or interfere with the server-authenticated session.
  - `apps/web/app/api/[...path]/route.ts:52-54, 63-65`:
    Falls back to `req.cookies.get("sid")?.value` when `session?.sid` is null. An untrusted cookie from the client header is forwarded directly to the backend.
- **Unhandled Upstream Exceptions in Catch-all Proxy**:
  - `apps/web/app/api/[...path]/route.ts:78`:
    `const upstream = await fetch(target, init);` lacks a `try / catch` wrapper. If Fastify is unreachable (network timeout, connection reset, container restart), Next.js returns an unhandled 500 HTML error instead of a structured JSON response (`{ error: { code: "E001", message: ... } }`).
- **Forbidden Polling Loops (`setInterval` Calling APIs)**:
  `apps/web/AGENTS.md` explicitly forbids:
  > "Dilarang: Melakukan polling atau refetch berkala ke API menggunakan interval (`refetchInterval` pada TanStack Query atau polling berkala via `setInterval`). Sinkronisasi realtime WAJIB event-driven via SSE."
  - `apps/web/components/snap-payment-modal.tsx:139-146`: Runs `setInterval(async () => { await checkPaymentStatus(invoiceId); }, 3000)` polling loop.
  - `apps/web/views/jobs/components/job-client.tsx:34-42`: Runs `window.setInterval(() => { void refresh(); }, 1500)` polling `/api/generate/${job.id}` instead of using the existing SSE endpoint `/api/generate/:id/events`.
  - `apps/web/views/jobs/components/job-client.tsx:63-69`: Runs `window.setInterval(() => { void loadMe(); }, 4000)` polling `/api/me`.
  - `apps/web/hooks/use-payment.ts:393-425`: Implements an explicit polling utility `pollPaymentStatus` with a 3000ms loop.
- **Redundant Duplicate SSE Connections**:
  - `apps/web/components/app-workspace.tsx:155-189` already runs a global SSE connection to `/api/invoices/events` invalidating `wallet()`, `billingLedger()`, `orderInvoices()`, and `customerProfile()`.
  - `apps/web/views/app/order/order-view.tsx:109-140` mounts a second identical SSE connection to `/api/invoices/events`, duplicating connection overhead and cache invalidations.

---

## 2. Logic Chain

```
[Observation 1.1: Route duplication /app/checkout & /landing-page & payment pages]
  ──> Increases bundle size and confuses canonical SEO routing.
  ──> Unified routing: Canonicalize /checkout, /app/order, /payment/failed, /payment/success.

[Observation 1.2: 126+ inline style={{ ... }} occurrences across web app]
  ──> Violates project rule "Tidak ada style={{ ... }}".
  ──> Mantine 8 provides style props (ta, w, h, bg, c, bd) and CSS modules classes.
  ──> Refactoring to Mantine props & CSS modules restores design system consistency and dark-mode compliance.

[Observation 1.2: Custom pill buttons, tabs, raw buttons instead of Mantine components]
  ──> Duplicates Mantine built-in logic (<SegmentedControl>, <Tabs>, <ActionIcon>).
  ──> Adopting Mantine components improves keyboard accessibility, ARIA support, and theme adherence.

[Observation 1.3: localModels & jobs duplicated in useState with sync useEffect]
  ──> Anti-pattern: mirroring React Query cache in component state causes extra renders on every network fetch.
  ──> TanStack Query already holds server state; components should consume query.data directly.

[Observation 1.3 & 1.4: Direct useQuery / fetch calls in BillingPageView, OrderPageView, GenerateStudio]
  ──> Violates ADR 0013 (Hook as Controller).
  ──> Views become tightly coupled to network fetching logic.
  ──> Centralizing queries into custom hook controllers makes presentation views pure and testable.

[Observation 1.4: Fragmented query keys & uninvalidated queries on profile/spicy update]
  ──> User updating profile in /app/profile does not reflect in checkout because customerProfile query is stale for 5 mins.
  ──> User enabling spicy mode does not reflect in studio because userStatus query is not invalidated.
  ──> Unifying query keys and adding explicit invalidations fixes cross-view desynchronization.

[Observation 1.5: 10 ad-hoc route files shadowing [...path]/route.ts + mergeCookie vulnerability]
  ──> Scattered proxy routes create maintenance burden, bypass API_MAPPINGS registry, and risk cookie pollution.
  ──> Consolidating all proxy requests into canonical API_MAPPINGS + catch-all proxy simplifies BFF architecture.
  ──> Sanitizing cookies in mergeCookie ensures client-sent cookies cannot overwrite authenticated sid.

[Observation 1.5: Forbidden setInterval API polling in snap-payment-modal and job-client]
  ──> Violates AGENTS.md realtime rule. Floods Fastify server with redundant requests.
  ──> Platform already provides SSE endpoints (/api/invoices/events and /api/generate/:id/events).
  ──> Replacing setInterval polling with EventSource listeners eliminates wasteful network traffic.
```

---

## 3. Caveats

1. **Read-Only Investigation**: No source code modifications were performed during this audit; all findings and line references correspond to the current benchmark baseline.
2. **Third-Party Payment Webhooks**: Webhooks from Midtrans, Xendit, and DANA are received at `/api/webhooks/*` and proxied to Fastify. Changes to BFF proxying must preserve raw body buffers for signature verification.
3. **NextAuth v5 Beta**: `@ai-gen-free/web` uses `next-auth: 5.0.0-beta.32`. All session adjustments must maintain compatibility with `createAuth` JWT strategy.
4. **Desktop vs Mobile Studio Composer**: The Studio composer in `generate-studio.tsx` has responsive adaptations (e.g. mobile controls row vs desktop dock). When standardizing to Mantine `<SegmentedControl>`, responsive breakpoints must be respected.

---

## 4. Conclusion & Concrete Refactoring Plan (R3 & BFF aspects of R1/R2)

### Summary of Survey Results
The `@ai-gen-free/web` application is fundamentally functional (Next.js build succeeds cleanly, 102 backend tests pass), but exhibits notable architectural debt in three main areas:
1. **Component Standardization**: 126+ inline `style={{ ... }}` violations and non-standard custom controls where Mantine 8 built-ins (`<SegmentedControl>`, `<Tabs>`, `<ActionIcon>`) should be used.
2. **State & Query Synchronization**: Leaking queries into presentation views, duplicate state mirroring in `useState`, and fragmented query keys causing stale UI states across views.
3. **BFF Proxy & Polling**: Duplicate individual route handlers bypassing `API_MAPPINGS`, insecure cookie concatenation, unhandled upstream errors, and forbidden `setInterval` polling loops where SSE streams are available.

### Concrete Refactoring Roadmap for Implementation

#### Module A: Mantine Standardization & Styling Cleanup (R3)
| Target File | Lines | Issue | Proposed Solution |
|---|---|---|---|
| `components/app-workspace.tsx` | 204–214 | Inline `style={{ ... }}` on logo wrapper | Replace with Mantine `<Box className={classes.logoBadge}>` with CSS module styling. |
| `components/responsive-table/responsive-table.tsx` | 67–70, 94 | Inline `style={{ textAlign, width }}` | Replace with Mantine `Table.Th` / `Table.Td` style props `ta={col.align \|\| "left"}` and `w={col.width}`. |
| `views/app/generate/components/generate-studio.tsx` | 208–226, 544–561 | Custom button pill segmented control | Replace with Mantine `<SegmentedControl data={[{ label: 'Standard', value: 'normal' }, { label: 'Spicy', value: 'spicy' }]} value={ctrl.spicyFilter} onChange={ctrl.setSpicyFilter} />`. |
| `views/app/generate/components/generate-studio.tsx` | 345–360 | Raw `<button>` for Magic Prompt | Replace with `<ActionIcon variant="subtle" size="md" ...>`. |
| `views/app/library/components/library-view.tsx` | 60–71 | Custom tab buttons with raw HTML `<button>` | Replace with Mantine `<Tabs value={ctrl.tab} onChange={ctrl.setTab}>` with `<Tabs.List>` and `<Tabs.Tab>`. |
| `views/app/library/components/library-view.tsx` | 98–100 | Raw `<button>` inside `<Menu.Target>` | Replace with `<ActionIcon variant="subtle" size="lg" aria-label="Filter dan Urutan">`. |
| `views/checkout/checkout-view.tsx` & `checkout-icons.tsx` | 79–250 (icons), 558–603 (view) | Pervasive inline `style={{ ... }}` | Replace with Mantine `<Group>`, `<Stack>`, style props (`bg`, `c`, `bd`, `ta`), and CSS module classes. |
| `views/payment/payment-failed-view.tsx` & `payment-success-view.tsx` | 73–163, 99–228 | Inline styles on cards, stacks, icons | Convert all inline styles to Mantine style props (`w="100%"`, `ta="center"`, `bg="..."`). |

#### Module B: State Management & View-Controller SoC Separation (R3)
| Target File | Lines | Issue | Proposed Solution |
|---|---|---|---|
| `hooks/use-generate-studio.ts` | 182–202, 281 | `localModels` & `localDefaults` in `useState` mirroring query cache | Remove `localModels`/`localDefaults` and their sync `useEffect`. Consume `catalogQuery.data.models` directly. |
| `hooks/use-generate-studio.ts` | 251, 310, 571, 612 | `jobs` mirrored in `useState` | Remove redundant `jobs` state. Use `jobsQuery.data.jobs` as the single source of truth; use optimistic updates on `queryClient.setQueryData(queryKeys.generatedJobs(), ...)` instead of `setJobs`. |
| `views/app/generate/components/generate-studio.tsx` | 102–128 | `handleMagicPrompt` fetch logic inside view | Move `handleMagicPrompt` and `isMagicPromptLoading` into `useGenerateStudio` controller hook. |
| `views/app/billing/billing-view.tsx` | 48–93 | Inline `useQuery` calls in presentation component | Extract into a custom controller hook `useBillingPage` or consume `useWallet` controller hook. |
| `views/app/order/order-view.tsx` | 51–108 | Inline `useQuery` calls and duplicate SSE connection in view | Extract into a custom controller hook `useOrderPage`. Remove redundant `EventSource` connection (already provided by `AppWorkspace`). |
| `views/checkout/checkout-view.tsx` | 92–120 | Duplicate modal switching handlers | Extract shared auth modal coordination logic into a shared helper or reuse `useLandingPage` auth modal controller. |

#### Module C: React Query Cache Unification & Synchronization (R3)
| Target File | Lines | Issue | Proposed Solution |
|---|---|---|---|
| `lib/query-keys.ts` | 18, 24 | Fragmented query keys `catalogPackages` vs `orderPackages` | Consolidate to single query key `queryKeys.catalogPackages()` for both checkout and order views. |
| `views/app/library/components/media-detail-modal.tsx` | 355 | Hardcoded literal `["catalog-generate"]` | Replace with centralized factory call `queryKeys.catalogGenerate()`. |
| `hooks/use-account-settings.ts` | 287–318 | Profile update does not invalidate query cache | Add `await queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile() });` and `queryClient.invalidateQueries({ queryKey: queryKeys.userStatus() });` on successful save. |
| `hooks/use-account-settings.ts` | 462, 488 | Spicy mode toggle does not invalidate user status | Add `await queryClient.invalidateQueries({ queryKey: queryKeys.userStatus() });`. |
| `hooks/use-library.ts` | 370–383 | Upload policy acceptance does not invalidate user status | Add `await queryClient.invalidateQueries({ queryKey: queryKeys.userStatus() });`. |
| `components/app-providers.tsx` | 10–20 | `user-status` not excluded from localStorage storage persister | Add `"user-status"` to `WALLET_DISALLOWED_CACHE_KEYS` to prevent stale policy/cooldown data in `localStorage`. |

#### Module D: BFF Proxy Consolidation, Security & Polling Elimination (R1/R2)
| Target File | Lines | Issue | Proposed Solution |
|---|---|---|---|
| `app/api/[...path]/route.ts` | 78–107 | Unhandled upstream network exceptions | Wrap `fetch(target, init)` in `try/catch`. On network error, return structured JSON `{ error: { code: "E001", message: "Gagal terhubung ke layanan backend." } }` with 502/503 status. |
| `lib/cookie-header.ts` | 1–3 | `mergeCookie` appends rather than sanitizing cookies | Sanitize incoming cookie header by removing any existing `sid=` or `sid_admin=` before appending authenticated session cookie. |
| `app/api/[...path]/route.ts` | 52–54, 63–65 | Unchecked fallback to client-supplied `sid` cookie | Only attach `sid` if verified by `auth()` session (`session.sid`). Strip unverified client cookies. |
| `components/snap-payment-modal.tsx` | 139–146 | 3-second `setInterval` polling loop | Replace with SSE listener on `/api/invoices/events` with invoice ID matching, eliminating interval polling. |
| `views/jobs/components/job-client.tsx` | 34–42, 63–69 | 1.5s and 4.0s `setInterval` polling loops | Replace with `new EventSource(`/api/generate/${job.id}/events`)` for realtime progress streaming (same pattern as studio). |
| `hooks/use-payment.ts` | 393–425 | Deprecated `pollPaymentStatus` utility | Remove or replace with event-driven promise resolution via SSE. |
| `app/api/customer-profile/route.ts` etc. | All | 10 ad-hoc route files shadowing catch-all proxy | Register routes in `lib/api-mapping.ts` canonical table and remove redundant individual route files. |

---

## 5. Verification Method

To verify these findings and confirm post-refactoring integrity:

1. **Backend Test Suite Baseline**:
   ```bash
   pnpm --filter @ai-gen-free/api test
   ```
   *Expected*: All 102 tests pass (0 failures, 0 regressions).

2. **Root Workspace Test Suite**:
   ```bash
   pnpm test
   ```
   *Expected*: Passes with exit code 0 across all package tests.

3. **Web Production Build Compilation**:
   ```bash
   pnpm --filter @ai-gen-free/web build
   ```
   *Expected*: Next.js build compiles cleanly with zero TypeScript errors and zero lint failures.

4. **API Mapping Unit Tests**:
   ```bash
   npx tsx --test apps/web/lib/api-mapping.test.ts
   ```
   *Expected*: Verifies that all canonical and alias frontend paths resolve to correct Fastify backend endpoints.

5. **Style Compliance Audit**:
   ```bash
   grep -rn "style={{" apps/web/components apps/web/views
   ```
   *Expected*: Count should reduce towards 0 as inline styles are replaced by Mantine style props and CSS modules.
