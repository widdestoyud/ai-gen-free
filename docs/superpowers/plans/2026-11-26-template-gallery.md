# Template Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Galeri template (infinite scroll, Try Template) di `/app/generate` plus manajemen template di `/admin/templates`.

**Architecture:** Tabel baru `Template` + `TemplateImage` (Prisma, tanpa TTL), gambar di R2 prefix `templates/`. `apps/api` modul baru `src/templates/` (parse murni + service + routes) untuk endpoint admin dan customer. Worker mengenali ref `template-image:<id>`. Web: halaman admin baru mengikuti pola `views/admin/packages`, studio mendapat tab Tasks/Templates, komponen galeri, dan logika apply murni di `lib/template-apply.ts`.

**Tech Stack:** Prisma/PostgreSQL, Fastify 5, BullMQ worker, sharp, Next.js 15, Mantine 8, TanStack Query 5 (`useInfiniteQuery`), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-26-template-gallery-design.md`

## Global Constraints

- Ikuti `AGENTS.md`. Tidak ada `style={{…}}` di `apps/web`; pakai Mantine + `*.module.css`.
- Payload aksi = JSON body (ADR 0016). Query string hanya untuk `page`, `limit`, `q`, `category`, `sort`, `spicy`, `isSpicy`, `isActive`, `sortBy`, `sortOrder`.
- Semua daftar = paginasi/filter/sort server-side di query Prisma (ADR 0018). Dilarang slice/filter di browser.
- Dilarang `refetchInterval` / `setInterval` polling.
- Setiap endpoint FE baru wajib tercatat di `apps/web/lib/api-mapping.ts`.
- Endpoint customer hanya mengembalikan ID model abstrak (`t2i-standard`, `t2i-spicy`, `i2i-standard`, `i2i-spicy`), tanpa nama upstream/provider, tanpa `storageKey`.
- Storage key template wajib cocok `^templates\/[a-z0-9]+\.webp$`.
- Batch customer: `limit` default **12**, maks 24. Admin: default 20, maks 100.
- Gambar referensi per template: **0–4**. Aspect ratio: `1:1, 16:9, 9:16, 3:2, 2:3, 4:5, 5:4, 3:4, 4:3`.
- Error API: `{ error: { code, message } }` via `sendError`. Postman: tetap tepat 1 koleksi + 1 environment.
- Commit kecil per task: `cmd /c git add …` lalu `cmd /c git commit -m "…"`.

## Review Focus

1. User yang belum `spicyModeEnabled` meminta `spicy=1` atau mengirim ref gambar dari template spicy → harus ditolak (API 403, worker tidak me-resolve). Tes: Task 3 (`resolveSpicyScope`), Task 4 (`isTemplateRefAllowed`).
2. Admin mengirim key di luar `templates/` (mis. `uploads/customer/u1/x.webp`) → validasi gagal; key itu tidak pernah dihapus dari R2. Tes: Task 2.
3. Template dinonaktifkan/dihapus padahal masih ada di Prompt Box user → worker gagal resolve, job gagal, poin dilepas (alur existing). Tes: Task 4.
4. Batch terakhir berisi tepat `limit` item → `hasMore` harus `false` (ambil `limit+1`). Tes: Task 3 (`toPage`).
5. Import URL admin ke `localhost` / `169.254.169.254` / IP privat → ditolak (SSRF). Tes: Task 3.

---

### Task 1: Schema `Template` + `TemplateImage`, migrasi, ADR 0019

**Files:**
- Modify: `prisma/schema.prisma` (tambah 2 model di akhir file)
- Create: `prisma/migrations/20261126130000_template_gallery/migration.sql`
- Create: `docs/adr/0019-template-gallery.md`
- Modify: `docs/adr/README.md` (daftar ADR)

**Interfaces:**
- Produces: model Prisma `Template { id, title, prompt, category?, modelId?, aspectRatio, isSpicy, isActive, sortOrder, usageCount, coverStorageKey, coverWidth, coverHeight, createdAt, updatedAt, images TemplateImage[] }` dan `TemplateImage { id, templateId, storageKey, alias?, position, width, height, createdAt }` (relasi `onDelete: Cascade`). Index: `@@index([isActive, isSpicy, sortOrder, createdAt])`, `@@index([isActive, isSpicy, usageCount])`, `@@index([category, isActive])`, `@@index([templateId, position])`.

- [ ] **Step 1: Tambah model di `schema.prisma`** — `id String @id @default(cuid())`, `prompt String @db.Text`, `aspectRatio String @default("1:1")`, `isSpicy Boolean @default(false)`, `isActive Boolean @default(true)`, `sortOrder Int @default(0)`, `usageCount Int @default(0)`. Tidak ada field `expiresAt`.
- [ ] **Step 2: Generate SQL migrasi**
  Run: `cmd /c pnpm exec prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261126130000_template_gallery/migration.sql`
  Expected: file berisi `CREATE TABLE "Template"` dan `CREATE TABLE "TemplateImage"` + index. (Jika DB remote tak terjangkau, gunakan `--from-migrations prisma/migrations --shadow-database-url <db lokal>`.)
- [ ] **Step 3: Generate client & terapkan**
  Run: `cmd /c pnpm db:generate && cmd /c pnpm db:migrate`
  Expected: `All migrations have been successfully applied.`
- [ ] **Step 4: Tulis ADR 0019** — keputusan: tabel template permanen tanpa TTL, prefix R2 `templates/` di luar `isRetentionKey`, ref `template-image:<id>` di params job, gating spicy server-side, hapus objek R2 saat template dihapus/gambar diganti.
- [ ] **Step 5: Commit**
  `cmd /c git add prisma docs/adr && cmd /c git commit -m "feat(db): add Template and TemplateImage tables (ADR 0019)"`

---

### Task 2: Parser & validasi template (murni)

**Files:**
- Create: `apps/api/src/templates/parse.ts`
- Create: `apps/api/src/templates/parse.test.ts`
- Modify: `package.json` (root, tambahkan `apps/api/src/templates/parse.test.ts` ke script `test`)
- Modify: `apps/api/package.json` (script `test`, tambahkan file yang sama)

**Interfaces:**
- Produces:
  - `TEMPLATE_KEY_RE = /^templates\/[a-z0-9]+\.webp$/`
  - `TEMPLATE_MODEL_IDS = ["t2i-standard","t2i-spicy","i2i-standard","i2i-spicy"] as const`
  - `type TemplateInput = { title: string; prompt: string; category: string | null; modelId: string | null; aspectRatio: string; isSpicy: boolean; isActive: boolean; sortOrder: number; cover: { key: string; width: number; height: number }; images: { key: string; alias: string | null; width: number; height: number }[] }`
  - `parseTemplateInput(raw: unknown): TemplateInput` — lempar `AppError(ErrorCodes.VALIDATION_ERROR, …)`
  - `type CustomerListQuery = { page: number; limit: number; q: string | null; category: string | null; sort: "default" | "trending" | "newest"; spicy: boolean }`
  - `parseCustomerListQuery(raw: unknown): CustomerListQuery`
  - `type AdminListQuery = { page: number; limit: number; q: string | null; category: string | null; isSpicy: boolean | null; isActive: boolean | null; sortBy: "sortOrder" | "createdAt" | "usageCount" | "title"; sortOrder: "asc" | "desc" }`
  - `parseAdminListQuery(raw: unknown): AdminListQuery`

Aturan: `title` 1–120 karakter (trim), `prompt` 1–4000, `category` ≤40 atau null, `alias` `^[a-zA-Z0-9_]{1,24}$` atau null, `images` 0–4, `sortOrder` integer, semua key wajib `TEMPLATE_KEY_RE`, `modelId` null atau anggota `TEMPLATE_MODEL_IDS`. `page` ≥1 (default 1). `limit` customer default 12 maks 24; admin default 20 maks 100. `q` trim, maks 100, kosong → null. `spicy` = `"1"` → true, lainnya false.

- [ ] **Step 1: Tulis tes gagal** di `parse.test.ts`:

```ts
test("parseTemplateInput accepts valid text-only template", () => {
  const out = parseTemplateInput({ title: " Cafe ", prompt: "girl in cafe", aspectRatio: "9:16",
    cover: { key: "templates/abc123.webp", width: 768, height: 1024 }, images: [] });
  assert.equal(out.title, "Cafe");
  assert.equal(out.isSpicy, false);
  assert.equal(out.isActive, true);
  assert.equal(out.modelId, null);
});
test("parseTemplateInput rejects key outside templates/", () => {
  assert.throws(() => parseTemplateInput({ ...valid, cover: { key: "uploads/customer/u1/x.webp", width: 1, height: 1 } }),
    (e: AppError) => e.code === ErrorCodes.VALIDATION_ERROR);
  assert.throws(() => parseTemplateInput({ ...valid, images: [{ key: "templates/../outputs/u1/a.webp", width: 1, height: 1 }] }));
});
test("parseTemplateInput rejects >4 images, bad ratio, raw model name", () => {
  assert.throws(() => parseTemplateInput({ ...valid, images: Array(5).fill(img) }));
  assert.throws(() => parseTemplateInput({ ...valid, aspectRatio: "21:9" }));
  assert.throws(() => parseTemplateInput({ ...valid, modelId: "black-forest-labs/flux-1.1-pro" }));
});
test("parseCustomerListQuery defaults and caps", () => {
  assert.deepEqual(parseCustomerListQuery({}), { page: 1, limit: 12, q: null, category: null, sort: "default", spicy: false });
  assert.equal(parseCustomerListQuery({ limit: "500" }).limit, 24);
  assert.equal(parseCustomerListQuery({ spicy: "1" }).spicy, true);
});
test("parseAdminListQuery defaults", () => {
  const q = parseAdminListQuery({ isActive: "false", sortBy: "title" });
  assert.equal(q.limit, 20); assert.equal(q.isActive, false); assert.equal(q.sortBy, "title"); assert.equal(q.sortOrder, "asc");
});
```
- [ ] **Step 2: Jalankan, pastikan gagal**
  Run: `cmd /c pnpm exec tsx --test apps/api/src/templates/parse.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implementasi `parse.ts`** sesuai Interfaces (pola mirip `apps/api/src/admin/parse.ts`).
- [ ] **Step 4: Jalankan ulang** → PASS.
- [ ] **Step 5: Commit** `feat(api): template input and list query parsers`

---

### Task 3: Service & route admin + customer di `apps/api`

**Files:**
- Create: `packages/core/src/net/safe-url.ts` (pindahkan `isSafePublicUrl` dari worker; export dari `packages/core/src/index.ts`)
- Modify: `apps/worker/src/resolve-inputs.ts` (import `isSafePublicUrl` dari `@ai-gen-free/core`, re-export agar tes lama tetap jalan)
- Create: `apps/api/src/templates/service.ts`
- Create: `apps/api/src/templates/service.test.ts`
- Create: `apps/api/src/routes/templates.ts`
- Modify: `apps/api/src/index.ts` (register route templates seperti route lain)
- Modify: `package.json` root + `apps/api/package.json` (tambah `service.test.ts` ke `test`)

**Interfaces:**
- Consumes: `parseTemplateInput`, `parseCustomerListQuery`, `parseAdminListQuery`, `TEMPLATE_KEY_RE` (Task 2); `compressUploadImage` dari `apps/api/src/uploads/service.ts`; `ObjectStorage` (`put`, `delete`, `signGetUrl`).
- Produces (murni, dites):
  - `diffRemovedKeys(before: string[], after: string[]): string[]`
  - `resolveSpicyScope(requested: boolean, userSpicyEnabled: boolean): boolean` — `requested && !enabled` → lempar `AppError` dengan kode & status yang sama seperti penolakan spicy di `apps/api/src/jobs/service.ts:50`.
  - `toPage<T>(rows: T[], limit: number): { items: T[]; hasMore: boolean }`
  - `type CustomerTemplateView = { id: string; title: string; prompt: string; category: string | null; modelId: string | null; aspectRatio: string; isSpicy: boolean; coverUrl: string; images: { id: string; url: string; alias: string | null; width: number; height: number }[] }`
  - `toCustomerView(row: TemplateWithImages, urlOf: (key: string) => Promise<string>): Promise<CustomerTemplateView>`
- Produces (service, `createTemplateService({ storage })`):
  - `adminList(q: AdminListQuery) → { items: AdminTemplateView[]; total: number; page: number; limit: number }` (AdminTemplateView = CustomerTemplateView + `isActive`, `sortOrder`, `usageCount`, `createdAt`, `updatedAt`, `cover.key`, `images[].key`)
  - `adminGet(id)`, `adminCreate(actorId, input: TemplateInput)`, `adminUpdate(actorId, id, input)`, `adminDelete(actorId, id)` — tulis `AuditLog` (`template.create|update|delete`); update/delete menghapus key lama dari R2 **setelah** transaksi DB sukses (best-effort, log `template.asset_delete_failed`).
  - `uploadAsset(input: { buffer: Uint8Array; contentType: string } | { sourceUrl: string }) → { key: string; url: string; width: number; height: number }` — `sourceUrl` wajib lolos `isSafePublicUrl`; key `templates/<cuid>.webp`.
  - `customerList(userId, q: CustomerListQuery) → { items: CustomerTemplateView[]; page: number; limit: number; hasMore: boolean }` — hanya `isActive: true`, `isSpicy: resolveSpicyScope(q.spicy, user.spicyModeEnabled)`; sort `default` = `[sortOrder asc, createdAt desc]`, `trending` = `[usageCount desc, createdAt desc]`, `newest` = `[createdAt desc]`; `q` → `title`/`prompt` `contains` insensitive; `take: limit + 1`.
  - `customerCategories(userId, spicy: boolean) → { categories: string[] }` (distinct, aktif, non-null, urut alfabet)
  - `recordUse(userId, id) → { ok: true }` — increment `usageCount` hanya jika aktif dan spicy diizinkan; selain itu 404.
  - URL gambar: `STORAGE_PUBLIC_ENDPOINT` jika ada, kalau tidak `storage.signGetUrl(key, 3600)` (pola `getStoragePublicOrSignedUrl` di worker).
- Routes (`routes/templates.ts`, guard `requireAdmin` / sesi customer sesuai pola `routes/wallet.ts` & `routes/jobs.ts`):
  - `GET /admin/templates`, `POST /admin/templates`, `GET|PATCH|DELETE /admin/templates/:id`, `POST /admin/templates/assets` (multipart `file` atau JSON `{ sourceUrl }`)
  - `GET /customer/templates`, `GET /customer/templates/categories`, `POST /customer/templates/:id/use`

- [ ] **Step 1: Tulis tes gagal** `service.test.ts`:

```ts
test("diffRemovedKeys returns keys no longer referenced", () => {
  assert.deepEqual(diffRemovedKeys(["templates/a.webp","templates/b.webp"], ["templates/b.webp","templates/c.webp"]), ["templates/a.webp"]);
});
test("resolveSpicyScope gates spicy", () => {
  assert.equal(resolveSpicyScope(false, false), false);
  assert.equal(resolveSpicyScope(true, true), true);
  assert.throws(() => resolveSpicyScope(true, false));
});
test("toPage: exactly limit rows means no more", () => {
  assert.deepEqual(toPage([1,2,3], 3), { items: [1,2,3], hasMore: false });
  assert.deepEqual(toPage([1,2,3,4], 3), { items: [1,2,3], hasMore: true });
});
test("toCustomerView never leaks storage keys", async () => {
  const v = await toCustomerView(rowFixture, async (k) => `https://cdn.test/${k.split("/")[1]}`);
  assert.ok(!JSON.stringify(v).includes("templates/"));
  assert.equal(v.images.length, rowFixture.images.length);
});
test("isSafePublicUrl blocks SSRF targets", () => {
  for (const u of ["http://localhost/a.png","http://169.254.169.254/x","http://10.0.0.5/a","http://api:4000/x"]) assert.equal(isSafePublicUrl(u), false);
  assert.equal(isSafePublicUrl("https://images.example.com/a.png"), true);
});
```
- [ ] **Step 2: Jalankan** `cmd /c pnpm exec tsx --test apps/api/src/templates/service.test.ts` → FAIL.
- [ ] **Step 3: Pindahkan `isSafePublicUrl` ke core** dan perbarui import worker.
- [ ] **Step 4: Implementasi `service.ts` + `routes/templates.ts`**, register di `index.ts`.
- [ ] **Step 5: Jalankan tes baru + tes worker lama**
  Run: `cmd /c pnpm exec tsx --test apps/api/src/templates/service.test.ts apps/worker/src/resolve-inputs.test.ts` → PASS.
- [ ] **Step 6: Smoke test via Docker** — `docker compose up -d --build api` lalu `curl -s http://127.0.0.1:4001/customer/templates` tanpa sesi → 401 berformat `{ error: { code, message } }`.
- [ ] **Step 7: Commit** `feat(api): template admin CRUD, asset upload, customer listing`

---

### Task 4: Worker me-resolve ref `template-image:<id>`

**Files:**
- Modify: `apps/worker/src/resolve-inputs.ts`
- Modify: `apps/worker/src/resolve-inputs.test.ts`
- Modify: `apps/worker/src/retention.test.ts`

**Interfaces:**
- Produces:
  - `TEMPLATE_IMAGE_REF_PREFIX = "template-image:"`
  - `parseTemplateImageRef(ref: string): string | null` — `^template-image:(c[a-z0-9]{24})$` → id, selain itu null.
  - `isTemplateRefAllowed(t: { isActive: boolean; isSpicy: boolean }, userSpicyEnabled: boolean): boolean`
  - Di `resolveSingleImageBuffer`: cabang pertama (sebelum regex ID lama). Jika `parseTemplateImageRef` mengembalikan id → `prisma.templateImage.findUnique({ where: { id }, include: { template: { select: { isActive, isSpicy } } } })` + `prisma.user.findUnique({ select: { spicyModeEnabled } })`; jika tidak ada / `!isTemplateRefAllowed` → `return null`; jika ok → `storage.get(storageKey)` lalu lanjut ke normalisasi PNG yang sudah ada. Ref template **tidak** boleh jatuh ke cabang regex ID lama.

- [ ] **Step 1: Tulis tes gagal**

```ts
test("parseTemplateImageRef", () => {
  assert.equal(parseTemplateImageRef("template-image:cmu1efgfz0001qz0zntv0iy2z"), "cmu1efgfz0001qz0zntv0iy2z");
  assert.equal(parseTemplateImageRef("template-image:../x"), null);
  assert.equal(parseTemplateImageRef("https://cdn/x.webp"), null);
});
test("isTemplateRefAllowed", () => {
  assert.equal(isTemplateRefAllowed({ isActive: false, isSpicy: false }, true), false);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: true }, false), false);
  assert.equal(isTemplateRefAllowed({ isActive: true, isSpicy: true }, true), true);
});
// retention.test.ts
test("template objects are never retention keys", () => {
  assert.equal(isRetentionKey("templates/abc123.webp"), false);
});
```
- [ ] **Step 2: Jalankan** `cmd /c pnpm exec tsx --test apps/worker/src/resolve-inputs.test.ts apps/worker/src/retention.test.ts` → FAIL.
- [ ] **Step 3: Implementasi** sesuai Interfaces.
- [ ] **Step 4: Jalankan ulang** → PASS.
- [ ] **Step 5: Commit** `feat(worker): resolve template-image refs with spicy/active guard`

---

### Task 5: Fondasi web — API mapping, query keys, i18n, logika apply murni

**Files:**
- Modify: `apps/web/lib/api-mapping.ts` + `apps/web/lib/api-mapping.test.ts`
- Modify: `apps/web/lib/query-keys.ts`
- Create: `apps/web/lib/template-apply.ts` + `apps/web/lib/template-apply.test.ts`
- Modify: `apps/web/hooks/use-generate-studio.ts` (hanya tipe `StudioRef` + baris submit)
- Modify: `apps/web/messages/id.json`, `apps/web/messages/en.json`
- Modify: `package.json` root (tambah `apps/web/lib/template-apply.test.ts`)

**Interfaces:**
- Mapping baru (taruh entri spesifik **sebelum** pola `:id`):
  `GET /api/templates → /customer/templates`, `GET /api/templates/categories → /customer/templates/categories`, `POST /api/templates/:id/use → /customer/templates/:id/use`, `GET|POST /api/admin/templates → /admin/templates`, `POST /api/admin/templates/assets → /admin/templates/assets`, `GET|PATCH|DELETE /api/admin/templates/:id → /admin/templates/:id`.
- `queryKeys.templates(filters: { q: string | null; category: string | null; sort: string; spicy: boolean })` dan `queryKeys.templateCategories(spicy: boolean)`.
- `StudioRef`: `kind` menjadi `"generation" | "upload" | "template"`, tambah `submitUrl?: string`. Di `submit()`: `url: r.submitUrl ?? r.url` untuk `refs`, `image`, `images`.
- `template-apply.ts`:
  - `type CustomerTemplate` = bentuk `CustomerTemplateView` dari Task 3.
  - `type ComposerSnapshot = { prompt: string; refIds: string[] }`
  - `needsOverwriteConfirm(current: ComposerSnapshot, lastApplied: ComposerSnapshot | null): boolean` — composer kosong → false; sama persis dengan `lastApplied` (prompt identik, refIds sama urutan) → false; selain itu → true.
  - `templateToStudioRefs(t: CustomerTemplate): StudioRef[]` — `id: "tpl-" + image.id`, `kind: "template"`, `url: image.url`, `submitUrl: "template-image:" + image.id`, `alias`, `width`, `height`; lalu `resequenceRefs`.
- i18n namespace: `generate.tabs.{tasks,templates}`, `generate.templates.{try,search_placeholder,sort_all,sort_trending,sort_newest,adult_toggle,empty,end,load_error,overwrite_title,overwrite_body,overwrite_confirm,overwrite_cancel,spicy_need_dob}`, `admin.nav.templates`, `admin.templates.*` (judul, kolom tabel, label form, filter, konfirmasi hapus, toast).

- [ ] **Step 1: Tulis tes gagal**

```ts
// template-apply.test.ts
test("empty composer needs no confirm", () => assert.equal(needsOverwriteConfirm({ prompt: "  ", refIds: [] }, null), false));
test("typed prompt needs confirm", () => assert.equal(needsOverwriteConfirm({ prompt: "hi", refIds: [] }, null), true));
test("manual upload needs confirm", () => assert.equal(needsOverwriteConfirm({ prompt: "", refIds: ["up1"] }, null), true));
test("untouched applied template → no confirm", () => {
  const a = { prompt: "cafe girl", refIds: ["tpl-1"] };
  assert.equal(needsOverwriteConfirm({ ...a }, a), false);
});
test("edited applied template → confirm", () => {
  const a = { prompt: "cafe girl", refIds: ["tpl-1"] };
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl, red dress", refIds: ["tpl-1"] }, a), true);
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl", refIds: ["tpl-1", "up9"] }, a), true);
  assert.equal(needsOverwriteConfirm({ prompt: "cafe girl", refIds: [] }, a), true);
});
test("templateToStudioRefs builds submit refs", () => {
  const refs = templateToStudioRefs(tplFixture);
  assert.equal(refs[0].kind, "template");
  assert.equal(refs[0].submitUrl, `template-image:${tplFixture.images[0].id}`);
});
// api-mapping.test.ts
test("template mappings", () => {
  assert.equal(resolveBackendPath("/api/templates", "GET"), "/customer/templates");
  assert.equal(resolveBackendPath("/api/templates/categories", "GET"), "/customer/templates/categories");
  assert.equal(resolveBackendPath("/api/templates/t1/use", "POST"), "/customer/templates/t1/use");
  assert.equal(resolveBackendPath("/api/admin/templates/assets", "POST"), "/admin/templates/assets");
  assert.equal(resolveBackendPath("/api/admin/templates/t1", "PATCH"), "/admin/templates/t1");
});
```
- [ ] **Step 2: Jalankan** `cmd /c pnpm exec tsx --test apps/web/lib/template-apply.test.ts apps/web/lib/api-mapping.test.ts` → FAIL.
- [ ] **Step 3: Implementasi** mapping, query keys, `template-apply.ts`, perubahan `StudioRef`/submit, string i18n (id + en, kunci identik; tes i18n existing di `apps/web/lib/i18n/` harus tetap lulus).
- [ ] **Step 4: Jalankan** `cmd /c pnpm --filter @ai-gen-free/web test` → PASS.
- [ ] **Step 5: Commit** `feat(web): template api mapping, apply logic, i18n`

---

### Task 6: Halaman admin `/admin/templates`

**Files:**
- Create: `apps/web/app/admin/templates/page.tsx` (server; baca `searchParams` → `fetchAdminApi("/api/admin/templates?…")`)
- Create: `apps/web/views/admin/templates/{index.ts,types.ts,admin-templates-view.tsx}`
- Create: `apps/web/views/admin/templates/components/templates-table.tsx` (+ `.module.css`)
- Create: `apps/web/views/admin/templates/components/template-form-modal.tsx`
- Create: `apps/web/views/admin/templates/components/template-image-picker.tsx` (+ `.module.css`)
- Modify: `apps/web/components/admin-workspace.tsx` (nav `{ href: "/admin/templates", label: t("nav.templates"), … }` setelah packages)

**Interfaces:**
- Consumes: endpoint admin Task 3 lewat `requestJson("/api/admin/templates…")`; `AdminTemplateView`.
- `TemplateImagePicker` props: `{ value: { key: string; url: string; width: number; height: number } | null; onChange(v): void; label: string }` — area drag & drop native (`onDragOver`/`onDrop`) + `<input type="file" accept="image/jpeg,image/png,image/webp">` tersembunyi + `TextInput` "Tempel URL" (tombol Ambil). Keduanya `POST /api/admin/templates/assets`.
- Form: judul, prompt (Textarea), kategori (`Autocomplete` dari kategori yang ada), model target (`Select`: kosong / 4 ID abstrak), aspect ratio (`Select`), Safe/Spicy (`SegmentedControl`), aktif (`Switch`), urutan (`NumberInput`), cover (picker, wajib), referensi 0–4 (picker + alias).
- Tabel: thumbnail cover, judul, kategori, mode badge, status switch (PATCH `isActive` langsung), usage, aksi edit/hapus (modal konfirmasi). Filter (search debounce 300 ms, mode, kategori, status) + `Pagination` Mantine → semua mengubah URL search params (`router.push`), data diambil ulang server-side.

- [ ] **Step 1: Implementasi** page + view + komponen mengikuti pola `views/admin/packages` (pemakaian `requestJson`, notifikasi, `AdminPageShell`).
- [ ] **Step 2: Typecheck**
  Run: `cmd /c pnpm --filter @ai-gen-free/web exec tsc --noEmit` → tanpa error.
- [ ] **Step 3: Verifikasi manual di browser** (`docker compose up -d --build api web`, buka `http://localhost:3001/admin/templates`):
  buat template text-only; buat template dengan 2 referensi via upload + 1 via URL; edit & ganti cover → objek R2 lama hilang (cek log `template.asset_delete_failed` tidak muncul); nonaktifkan; hapus; filter + paginasi mengubah URL dan hasil.
- [ ] **Step 4: Commit** `feat(web): admin template management page`

---

### Task 7: Studio — tab Tasks/Templates + galeri infinite scroll

**Files:**
- Create: `apps/web/hooks/use-template-gallery.ts`
- Create: `apps/web/views/app/generate/components/studio-tabs.tsx`
- Create: `apps/web/views/app/generate/components/template-gallery.tsx` (+ `template-gallery.module.css`)
- Create: `apps/web/views/app/generate/components/template-card.tsx`
- Modify: `apps/web/views/app/generate/components/generate-studio.tsx` (blok stage baris ~140–206: bungkus konten lama ke tab Tasks, ganti `EmptyState` lama dengan tab Templates)
- Modify: `apps/web/views/app/generate/components/generate-studio.module.css`

**Interfaces:**
- `useTemplateGallery(opts: { spicyEnabled: boolean })` → `{ filters, setQuery, setCategory, setSort, adultOn, setAdultOn, items: CustomerTemplate[], categories: string[], fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError, sentinelRef }` — `useInfiniteQuery` dengan `queryKey: queryKeys.templates(filters)`, `initialPageParam: 1`, `getNextPageParam: (last) => last.hasMore ? last.page + 1 : undefined`, `limit=12`; `sentinelRef` memakai `IntersectionObserver` (`rootMargin: "400px"`) memanggil `fetchNextPage` saat `hasNextPage && !isFetchingNextPage`. Search debounce 300 ms. Tanpa `refetchInterval`.
- `StudioTabs` props: `{ value: "tasks" | "templates"; onChange; activeJobCount: number }` — badge tampil jika `activeJobCount > 0`.
- Tab default: `"templates"` jika tidak ada job aktif & tidak ada output terakhir, selain itu `"tasks"`; setelah submit sukses → otomatis `"tasks"`.
- `TemplateCard` props: `{ template: CustomerTemplate; revealed: boolean; onReveal(id: string): void; onTry(t: CustomerTemplate): void; tryLabel: string }`.
- Desain (terapkan skill **taste-skill** `design-taste-frontend`: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` lalu audit hasilnya):
  - Grid CSS `grid-template-columns: repeat(4, 1fr)`; `@media (max-width: 1023px)` 3 kolom; `@media (max-width: 767px)` 2 kolom; gap 12px (8px mobile).
  - Card `aspect-ratio: 3 / 4`, radius 12px, `object-fit: cover`, `loading="lazy"`, `decoding="async"`.
  - Overlay: gradien gelap dari bawah + tombol "Try Template" di tengah, transisi opacity/scale 180 ms; tampil saat `:hover`/`:focus-within` dan saat `revealed` (class). Pada `@media (hover: none)` overlay hanya muncul via `revealed`.
  - Thumbnail referensi pojok kanan atas: maks 3 bulat-sudut 28px bertumpuk, border 2px, chip `+N` jika >3.
  - Header tab + filter bar `position: sticky; top: 0`; area grid `overflow-y: auto` dalam `.stage`; dock Prompt Box tidak berubah.
  - State: skeleton 12 card saat loading awal, 4 skeleton saat next page, teks `templates.empty` jika kosong, `templates.end` saat `!hasNextPage`, `ErrorAlert` + tombol coba lagi saat error.

- [ ] **Step 1: Implementasi** hook + komponen + integrasi tab (konten Tasks = blok stage lama tanpa perubahan perilaku).
- [ ] **Step 2: Typecheck** `cmd /c pnpm --filter @ai-gen-free/web exec tsc --noEmit` → tanpa error.
- [ ] **Step 3: Verifikasi browser** (buat ≥30 template via admin dulu): lebar 1280 → 4 kolom, 900 → 3, 390 → 2; scroll memuat batch 12 berikutnya tanpa duplikat; Prompt Box tetap terlihat; Network tab tidak menunjukkan request berkala.
- [ ] **Step 4: Commit** `feat(web): studio tasks/templates tabs with infinite template gallery`

---

### Task 8: Studio — Try Template, konfirmasi timpa, gate spicy

**Files:**
- Create: `apps/web/hooks/use-spicy-consent.ts`
- Create: `apps/web/views/app/generate/components/template-overwrite-modal.tsx`
- Modify: `apps/web/hooks/use-generate-studio.ts` (tambah `applyTemplate`, `lastAppliedRef`)
- Modify: `apps/web/views/app/generate/components/template-gallery.tsx`, `generate-studio.tsx`

**Interfaces:**
- Consumes: `needsOverwriteConfirm`, `templateToStudioRefs` (Task 5); `SpicyConsentModal` dari `@/components/spicy-consent-modal`; `PATCH /api/customer/profile { spicyModeEnabled: true }`.
- `useGenerateStudio` menambah:
  - `applyTemplate(t: CustomerTemplate): void` — set `prompt = t.prompt`, `selectedRefs = templateToStudioRefs(t)`, `aspect = t.aspectRatio`, `mediaType = "image"`, `spicyFilter = t.isSpicy ? "spicy" : "normal"`, `modelId = t.modelId` jika ada di katalog terfilter (selain itu default `pickInitialModel`); simpan `lastApplied = { prompt, refIds }`; fokus `textareaRef`; fire-and-forget `POST /api/templates/:id/use`.
  - `composerSnapshot(): ComposerSnapshot` dan `lastApplied: ComposerSnapshot | null`.
- `useSpicyConsent({ initialEnabled: boolean; hasDob: boolean })` → `{ enabled, request(): boolean, modalOpened, confirm(): Promise<boolean>, close(), saving, error }` — `request()` mengembalikan `true` jika sudah aktif; jika belum dan tanpa tanggal lahir → set `error = t("templates.spicy_need_dob")` (dengan link ke `/app/profile`); jika belum tapi ada DOB → buka modal. `confirm()` PATCH lalu `invalidateQueries(queryKeys.userStatus())` & `customerProfile()`. Logika sama dengan `use-account-settings.ts:460-530`.
- Alur klik Try Template: (1) jika `t.isSpicy && !spicy.request()` → simpan sebagai pending, berhenti; setelah `confirm()` sukses lanjut ke (2). (2) jika `needsOverwriteConfirm(composerSnapshot(), lastApplied)` → buka `TemplateOverwriteModal` (Batal / Timpa); (3) `applyTemplate(t)`.
- Toggle 18+ di filter bar memakai `spicy.request()` yang sama; jika belum diizinkan toggle tetap off.
- `app/app/generate/page.tsx` meneruskan `dateOfBirth` ada/tidak dari `/api/me` ke studio (`initialHasDob`).

- [ ] **Step 1: Implementasi** hook + modal + integrasi.
- [ ] **Step 2: Typecheck & unit test web** `cmd /c pnpm --filter @ai-gen-free/web exec tsc --noEmit && cmd /c pnpm --filter @ai-gen-free/web test` → lulus.
- [ ] **Step 3: Verifikasi browser (skenario wajib):**
  1. Composer kosong → Try Template A → terisi tanpa modal.
  2. Lalu Try Template B → langsung timpa tanpa modal.
  3. Ketik tambahan di prompt → Try Template C → modal muncul; Batal = tidak berubah; Timpa = terisi C.
  4. Upload gambar manual lalu Try Template → modal muncul.
  5. Akun non-spicy klik toggle 18+ / template spicy → alur DOB/consent existing; setelah setuju template diterapkan.
  6. Generate dari template dengan referensi → job sukses (worker me-resolve `template-image:`), tab pindah ke Tasks.
  7. Mobile 390px: tap card → overlay; tap tombol → terisi & textarea fokus.
- [ ] **Step 4: Commit** `feat(web): try template with overwrite confirm and spicy gate`

---

### Task 9: Postman, dokumentasi, verifikasi akhir

**Files:**
- Modify: `postman/ai-gen-free.postman_collection.json` (folder "Templates": 3 request customer, 6 request admin; body JSON contoh; prompt contoh pakai prefix `[TEST:DEV]`)
- Modify: `docs/architecture.md` (modul templates + prefix R2 `templates/`)
- Modify: `apps/web/AGENTS.md` / `apps/api/AGENTS.md` hanya jika ada konvensi baru yang perlu dicatat

- [ ] **Step 1: Update Postman & docs** (tetap 1 koleksi, 1 environment).
- [ ] **Step 2: Jalankan seluruh tes**
  Run: `cmd /c pnpm test` → semua PASS.
- [ ] **Step 3: Build image**
  Run: `docker compose up -d --build redis migrate api worker web` → semua container healthy (`docker compose ps`).
- [ ] **Step 4: Ulangi skenario browser Task 6 & Task 8** di `http://localhost:3001` dan catat hasilnya di deskripsi PR.
- [ ] **Step 5: Commit** `docs: template gallery postman and architecture notes`
