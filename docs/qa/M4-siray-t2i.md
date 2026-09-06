# QA — M4 Siray t2i

**Verdict:** pass (fail-closed: semua kasus AGENTS.md wajib punya bukti file).  
**Unit:** `pnpm test` → **29/29 pass** (tsx `--test` Siray adapter, catalog/params, `process-job`).  
**Live runner:** `node scripts/qa-m4-run.mjs` **tidak dijalankan** — Docker daemon tidak aktif (`npipe:////./pipe/dockerDesktopLinuxEngine` tidak ada). Klaim di bawah **bukan** hasil Compose; jangan diperlakukan sebagai pass live.

Jalur produksi M4: adapter `packages/providers-siray` di worker, katalog t2i Siray, hold/capture/release + mutex + cooldown M3 tetap.

## Kasus wajib AGENTS.md

| # | Case | Result | Evidence | Reproduction |
|---|---|---|---|---|
| 1 | Dua tab submit — hanya satu `queued`/`running` | **pass** | Unique partial index `job_one_active_per_user` di `prisma/migrations/20260904120000_init/migration.sql` (`WHERE status IN ('queued','running')`). `submitJob` cek aktif lalu `409 JOB_IN_PROGRESS`; `P2002` non-idempotency juga `409` (`apps/api/src/jobs/service.ts`). UI tab lain: `WaitAlert` “Sedang generate” + tombol disabled (`apps/web/app/generate/generate-client.tsx`). | Dua `POST /api/jobs` paralel, `Idempotency-Key` berbeda: satu `202`, satu `409 JOB_IN_PROGRESS`. Hilangkan index → tes wajib merah (`prisma/README.md`). Runner: `scripts/qa-m4-run.mjs` case “Dua tab”. |
| 2 | Login perangkat kedua mencabut sesi pertama | **pass** | `verifyOtp` dalam transaksi: `session.deleteMany({ userId, kind })` lalu `session.create` (`apps/api/src/auth/service.ts`). Satu baris `Session` per `(userId, kind)`. Cookie lama gagal `userFromCookie`. M4 tidak mengubah jalur auth. | Login email+OTP di perangkat B; `GET /api/me` dengan cookie perangkat A → `401`. Tidak diulang live di sesi QA ini (bukti kode + M1). |
| 3 | Job gagal: hold dilepas, cooldown **tidak** terpasang | **pass** | `failJob` → `wallet.releaseJob` (`release:{jobId}`) lalu `store.fail` **tanpa** `nextGenerateAt` / `users.nextGenerateAt` (`apps/worker/src/process-job.ts`, `apps/worker/src/store.ts`). Tes: `failed job: release hold, no cooldown`; `empty token / not configured`; `timeout 5 minutes`; `retry exhausted`; `dummy fail` — semua pass. `captureJob` tidak dipanggil. | Token kosong / policy 4xx / timeout 5 menit: status `failed`, saldo kembali, `nextGenerateAt` null, submit berikutnya tidak `429 COOLDOWN`. |
| 4 | Job sukses: capture sekali (idempoten) + cooldown | **pass** | Urutan wajib: `ObjectStorage.put` + `JobAsset` **sebelum** `captureJob({ idempotencyKey: capture:{jobId} })` lalu `store.succeed` set `Job` + `User.nextGenerateAt` (`process-job.ts` `completeSuccess`; `packages/wallet/src/ledger.ts`; `store.ts`). Unique `LedgerEntry.idempotencyKey`. Tes: `success: put output then capture then cooldown; no second submit` — capture 1×, `nextGenerateAt` terisi, re-entry job terminal tidak submit/capture ulang. Cooldown default 43200s (`AppSetting`). | Sukses t2i: 1 baris `capture:{jobId}`, saldo −N, `next_generate_at` terpasang; `POST /jobs` berikutnya `429 COOLDOWN`. |
| 5 | Completion provider duplikat tidak double-capture | **pass** | Job sudah terminal → `processGenerateJob` return. Asset output sudah ada → skip `put`/download. `JobAsset` `@@unique([jobId, kind])` + `P2002` di `putOutputAsset`. `captureJob` cek `capture:{jobId}` + `P2002`. Tes: `duplicate poll after asset exists: one capture, one asset` (0 submit, 0 download, captures=1, assets=1). Tidak ada webhook Siray di M4; poll worker idempoten seolah webhook. | Poll `SUCCESS` dua kali / worker retry setelah asset: tetap 1 objek storage, 1 `JobAsset` output, 1 capture. |
| 6 | User A tidak bisa `GET` job user B | **pass** | `getJobForUser`: `findFirst({ id, userId })`; tidak ada → `AppError NOT_FOUND` 404, bukan 403 (`apps/api/src/jobs/service.ts`, `apps/api/src/routes/jobs.ts`, `apps/api/src/http.ts`). UI `/jobs/:id` 404 → “Job tidak ditemukan.” | User B `GET /api/jobs/:idA` → `404 { error: { code: "NOT_FOUND" } }`. Runner: `scripts/qa-m4-run.mjs` “User B GET job A = 404”. |
| 7 | Web UI tidak import Siray/Prisma | **pass** | Grep `apps/web/**/*.{ts,tsx}`: tidak ada `prisma`, `@prisma`, `bullmq`, `siray`, `@ai-gen-free/providers-siray`, `@ai-gen-free/*`. `apps/web/package.json` hanya Next/Mantine/NextAuth. `packages/core` tidak mengimpor Siray/Prisma. Compose `web`: **tanpa** `env_file`, **tanpa** `SIRAY_*`. Token hanya di `worker` (`docker-compose.yml`). UI produksi tanpa checkbox dummy (grep `simulasikan`/`params.fail` kosong). | `rg prisma\|siray\|bullmq apps/web --glob '*.ts*'`; audit `docker-compose.yml` service `web`. |

## Kasus M4 tambahan (kontrak)

| Case | Result | Evidence |
|---|---|---|
| Katalog t2i Siray enabled, dummy off | **pass** | Seed: Flux `enabled: true` cost 10; `dummy-t2i` `enabled` hanya jika `ENABLE_DUMMY_T2I=true` (`prisma/seed.ts`). `GET /api/catalog/generate` filter `enabled=true` (`apps/api/src/jobs/catalog.ts`). Tes `catalog.test.ts` pass. |
| `cost` / `providerId` klien diabaikan | **pass** | `submitJob` memakai `model.costPoints` + `model.providerId` dari katalog; body `cost` tidak dibaca untuk hold (`apps/api/src/jobs/service.ts`). Tes params: key `cost` dibuang. |
| Mode non-t2i / model disabled → `VALIDATION_ERROR`, tanpa hold | **pass** | `pickEnabledModel` / `resolveModel` lempar `VALIDATION_ERROR` sebelum transaksi hold. Tes `non-t2i is VALIDATION_ERROR`, `explicit modelId must match an enabled row`. |
| `POST /jobs` 202 sebelum inferensi Siray | **pass** | Route enqueue BullMQ `{ jobId }`, `reply.code(202)` (`apps/api/src/routes/jobs.ts`). API tidak import `SirayProvider`. Worker composition root yang `submit`/`getStatus` (`apps/worker/src/index.ts`). Tes Siray: `POST /v1/images/generations/async`, bukan `image.run()`. |
| `output.url` signed storage platform, bukan URL Siray | **pass** | Worker `fetchOutputBytes` server-side lalu `put` key `outputs/{userId}/{jobId}.{ext}`. `serializeJob` `storage.signGetUrl(..., 600)` hanya jika `succeeded` + `JobAsset.kind=output` (`service.ts`). Adapter boleh melihat `api.siray.ai` di `outputUrls`; klien tidak. |
| Siray `429` di bawah retry: bukan `failed`, hold tetap | **pass** | `RetryableProviderError`; `lastAttempt=false` rethrow, status tetap `running`, wallet mock menolak capture/release. Tes: `429 under retry budget is not failed`; `siray.test.ts` `429 is retryable`. Attempts 5 + backoff worker. |
| Token kosong / policy / timeout | **pass** | `SirayProvider.assertConfigured` → `PROVIDER_NOT_CONFIGURED` tanpa HTTP. Policy fail_code → `PROVIDER_POLICY`. Wall-clock 5 menit → `PROVIDER_TIMEOUT`. Semua release, no cooldown (tes pass). |
| `Idempotency-Key` replay | **pass** | Unique `(userId, idempotencyKey)`; replay return `202` job yang sama sebelum hold kedua (`submitJob`). |
| UI generate dari katalog, tanpa dummy fail | **pass** | `/generate` load `GET /api/catalog/generate`; biaya `selected.costPoints`; submit `mode: t2i` + UUID key, navigasi `/jobs/{id}`, poll 1.5s (`generate-client.tsx`, `job-client.tsx`). Tidak ada checkbox gagal. Mantine, tanpa `style={{ }}`. |

## Catatan fail-closed

- Index mutex **hanya** di SQL migrasi (Prisma tidak mengekspresikan partial unique). Jangan hapus `job_one_active_per_user`.
- Capture **setelah** `put`; gagal copy output = retryable, hold belum di-release.
- Live Siray (token nyata, signed MinIO, race HTTP) belum dieksekusi di sesi ini. Ulangi `node scripts/qa-m4-run.mjs` setelah `docker compose up` sebelum merge jika gerbang manusia mensyaratkan bukti Compose.
- Merge **tidak** diblokir oleh kasus wajib: tidak ada **fail**.
