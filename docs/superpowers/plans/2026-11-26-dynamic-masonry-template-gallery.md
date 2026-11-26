# Dynamic Masonry Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the template gallery on `/app/generate` into a Pinterest/Midjourney-style dynamic masonry grid where card heights naturally adapt to each photo's native aspect ratio (16:9, 9:16, 1:1, 4:5, 3:2, etc.) without cropping or rigid 4-column lock, matching user reference `Screenshot 2026-11-26 153835.png`.

**Architecture:**
- Backend API (`toCustomerView`): expose `coverWidth` and `coverHeight` (already stored in DB `Template.coverWidth` / `Template.coverHeight`) as optional numbers on `CustomerTemplateView`, falling back to aspect ratio string (e.g. `9:16` -> 9/16, `16:9` -> 16/9, `1:1` -> 1/1).
- Frontend DTO (`CustomerTemplate`): include `coverWidth` and `coverHeight`.
- Layout System: Replace rigid CSS Grid `grid-template-columns: repeat(4, ...)` with a CSS column masonry layout (`columns: 4 240px; column-gap: 12px;` with responsive breakpoints `columns: 2` on mobile, `columns: 3` on tablets, `columns: 4` to `columns: 5` on ultra-wide screens), with cards using `break-inside: avoid; margin-bottom: 12px;`.
- Image Container: Remove rigid `aspect-ratio: 3 / 4` on `.card` and `.coverImage`. Use dynamic aspect ratio container `aspect-ratio: var(--aspect, ...)` or natural intrinsic height with `object-fit: cover; width: 100%; height: auto; display: block;` so each photo renders crisp, full, and completely undistorted.
- Skeleton Loaders: Render staggered dynamic skeleton cards with varied realistic aspect ratios (`3/4`, `9/16`, `1/1`, `16/9`) instead of identical rigid rectangles.

**Tech Stack:** Next.js 15, Mantine 7, CSS Modules, TypeScript Strict, Node test runner (`tsx --test`).

**Spec:** User reference image `D:\rnd\ai-gen-free\referensi\Screenshot 2026-11-26 153835.png` and ADR 0017/ADR 0019.

## Global Constraints
- Maintain 100% test pass on web and api (`cmd /c pnpm --filter @ai-gen-free/web test`, `cmd /c pnpm --filter @ai-gen-free/api test`).
- No inline styles `style={{ ... }}` in `apps/web`; dynamic aspect ratios are passed via CSS variables or standard CSS classes.
- Responsive requirement: mobile screens (width < 768px) must show 2 columns, tablet 3 columns, desktop 4 columns, large screens 4-5 columns as screen width permits.
- Infinite scroll sentinel must remain at the bottom outside column breaks so dynamic column heights don't interfere with intersection observer triggering.
- Hover overlay ("Try Template" button + title caption) and reference thumbnails cluster must float seamlessly on dynamically sized cards without clipping or overflow.

## Review Focus
1. Extremely tall or ultra-wide images (e.g. 9:16 portrait or 21:9 banner) should not break column balance or cause awkward stretching.
2. Incomplete or 0 `coverWidth`/`coverHeight` in older DB rows should gracefully fall back to the template's `aspectRatio` property (e.g. `"9:16"`, `"16:9"`, `"1:1"`).
3. Mobile touch behavior (first tap reveals button/caption, second tap or button tap triggers try) must remain responsive without jitter when card heights vary.
4. Infinite scroll trigger element (`sentinel`) must remain reachable and observe intersection reliably at the bottom of the column layout.
5. Touch/mobile scrolling performance with CSS columns must remain smooth (60fps) using GPU hardware acceleration.

---

### Task 1: Expose Cover Dimensions in API DTO & Web Type

**Files:**
- Modify: `apps/api/src/templates/service.ts:35-46`
- Modify: `apps/api/src/templates/service.ts:140-170`
- Modify: `apps/api/src/templates/service.test.ts:470-510`
- Modify: `apps/web/lib/template-apply.ts:11-22`
- Test: `apps/web/lib/template-apply.test.ts`

**Interfaces:**
- `CustomerTemplateView`: adds `coverWidth?: number; coverHeight?: number;`
- `CustomerTemplate`: adds `coverWidth?: number; coverHeight?: number;`

- [ ] **Step 1: Write the failing test for CustomerTemplate cover dimensions**
In `apps/web/lib/template-apply.test.ts`, add a test verifying `CustomerTemplate` helper calculating `getTemplateAspectRatio(template)`:
```ts
test("getTemplateAspectRatio returns numeric ratio or fallback", () => {
  assert.equal(getTemplateAspectRatio({ ...tplFixture, coverWidth: 1080, coverHeight: 1920 }), "9 / 16");
  assert.equal(getTemplateAspectRatio({ ...tplFixture, coverWidth: 0, coverHeight: 0, aspectRatio: "16:9" }), "16 / 9");
  assert.equal(getTemplateAspectRatio({ ...tplFixture, coverWidth: undefined, coverHeight: undefined, aspectRatio: "invalid" }), "3 / 4");
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cmd /c pnpm --filter @ai-gen-free/web test`
Expected: FAIL with `getTemplateAspectRatio is not a function`.

- [ ] **Step 3: Implement `getTemplateAspectRatio` in `apps/web/lib/template-apply.ts` and update types**
Update `CustomerTemplateView` in `apps/api/src/templates/service.ts` to include `coverWidth: row.coverWidth` and `coverHeight: row.coverHeight`.
Update `CustomerTemplate` in `apps/web/lib/template-apply.ts` and export `getTemplateAspectRatio(template: Pick<CustomerTemplate, "coverWidth" | "coverHeight" | "aspectRatio">): string`.

- [ ] **Step 4: Run test to verify it passes**
Run: `cmd /c pnpm --filter @ai-gen-free/web test && pnpm --filter @ai-gen-free/api test`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/templates/service.ts apps/api/src/templates/service.test.ts apps/web/lib/template-apply.ts apps/web/lib/template-apply.test.ts
git commit -m "feat(templates): expose cover dimensions in template api and web helper"
```

---

### Task 2: Implement Dynamic CSS Masonry Grid in Template Gallery

**Files:**
- Modify: `apps/web/views/app/generate/components/template-gallery.module.css:168-245`
- Modify: `apps/web/views/app/generate/components/template-gallery.tsx:160-235`

**Interfaces:**
- CSS class `.masonryGrid`: uses CSS column layout `columns: 4 250px; column-gap: 12px;`
- Responsive media queries:
  - `@media (max-width: 1280px)`: `columns: 3 220px;`
  - `@media (max-width: 767px)`: `columns: 2 150px; column-gap: 8px;`
- Skeletons: varied heights (`aspect-ratio: 9/16`, `aspect-ratio: 1/1`, `aspect-ratio: 3/4`, `aspect-ratio: 4/5`) simulating dynamic masonry cards while loading.

- [ ] **Step 1: Update `template-gallery.module.css` with masonry column structure**
Replace `.grid` with `.masonry`:
```css
.masonry {
  column-count: 4;
  column-gap: 12px;
  width: 100%;
}

@media (min-width: 1600px) {
  .masonry {
    column-count: 5;
    column-gap: 14px;
  }
}

@media (max-width: 1200px) {
  .masonry {
    column-count: 3;
    column-gap: 12px;
  }
}

@media (max-width: 767px) {
  .masonry {
    column-count: 2;
    column-gap: 8px;
  }
}
```
Define `.masonryItem` with `break-inside: avoid; margin-bottom: 12px; display: inline-block; width: 100%;`.

- [ ] **Step 2: Update `template-gallery.tsx` markup and staggered skeletons**
In `template-gallery.tsx`, wrap items in `.masonryItem`.
Generate staggered aspect ratios for skeleton cards using `[ "3 / 4", "9 / 16", "1 / 1", "4 / 5", "16 / 9" ][idx % 5]`.

- [ ] **Step 3: Verify build and test**
Run: `cmd /c pnpm --filter @ai-gen-free/web test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add apps/web/views/app/generate/components/template-gallery.tsx apps/web/views/app/generate/components/template-gallery.module.css
git commit -m "feat(web): transform template gallery into dynamic masonry grid"
```

---

### Task 3: Dynamic Template Card Proportions & Image Display

**Files:**
- Modify: `apps/web/views/app/generate/components/template-card.tsx:1-92`
- Modify: `apps/web/views/app/generate/components/template-card.module.css:1-120`

**Interfaces:**
- `TemplateCard`: removes rigid `aspect-ratio: 3 / 4` from `.card`.
- Utilizes `getTemplateAspectRatio(template)` to set CSS custom property `--template-aspect` on the article container, ensuring zero image cropping/letterboxing, full crisp display matching native aspect ratio, with hover overlay perfectly matching the card bounds.

- [ ] **Step 1: Update `template-card.tsx` to apply dynamic aspect ratio**
In `template-card.tsx`:
```tsx
const aspectValue = getTemplateAspectRatio(template);
```
Pass `style={{ "--template-aspect": aspectValue } as React.CSSProperties}` or render dynamic aspect ratio so the image preserves its complete native proportions.

- [ ] **Step 2: Update `template-card.module.css`**
Update `.card`:
```css
.card {
  position: relative;
  width: 100%;
  aspect-ratio: var(--template-aspect, 3 / 4);
  border-radius: 12px;
  overflow: hidden;
  background: var(--mantine-color-dark-7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 200ms ease;
  break-inside: avoid;
  margin-bottom: 12px;
}
```
Update `.coverImage`:
```css
.coverImage {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
```
At mobile (max-width: 767px), ensure `margin-bottom: 8px;` and `border-radius: 10px;`.

- [ ] **Step 3: Run web tests**
Run: `cmd /c pnpm --filter @ai-gen-free/web test`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add apps/web/views/app/generate/components/template-card.tsx apps/web/views/app/generate/components/template-card.module.css
git commit -m "feat(web): render dynamic photo proportions on template card"
```

---

### Task 4: Visual & Interactive Verification in Docker Environment

**Files:**
- Test/Verification on live dev instance: `http://localhost:3001/app/generate`

- [ ] **Step 1: Rebuild and reload Docker web container**
Run: `docker compose up -d --build web`
Expected: Container `ai-gen-free-web-1` builds and starts cleanly.

- [ ] **Step 2: Inspect in browser and verify dynamic masonry rendering**
Verify:
1. Photos of different dimensions (tall portrait 9:16, square 1:1, landscape 16:9, etc.) render with dynamic heights without cropping heads or feet.
2. Grid arranges in 4-5 dynamic columns on desktop and cleanly collapses into 2 columns on mobile viewport (<768px).
3. Hovering over any card reveals "Try Template" in the center and title at the bottom.
4. Clicking "Try Template" populates the prompt box and template references seamlessly.
5. Infinite scroll continues to load next batches without layout jitter.

- [ ] **Step 3: Commit any final visual polish**
```bash
git add apps/web/views/app/generate/components/
git commit -m "style(studio): refine masonry layout spacing and responsiveness"
```
