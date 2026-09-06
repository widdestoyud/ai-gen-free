# M4 contract — Siray t2i

**SA** — unit `M4-siray-t2i`. Depends on M3 (202 + hold/capture/release + mutex + cooldown).  
**ADR:** tidak ada keputusan terkunci yang dicabut. 0004, 0005, 0007, 0008, 0009 tetap berlaku.

Jalur produksi v1: text-to-image lewat adapter Siray. Dummy (`providerId=dummy`, `params.fail`) **bukan** jalur produksi. Face swap orang nyata **bukan** unit ini.

## Invarian (job + wallet)

1. `POST /api/jobs` menjawab `202` dengan `job_id` **sebelum** inferensi Siray. Request HTTP API dan Next.js **dilarang** `submit`/`getStatus`/`image.run()`.
2. Biaya = `ModelCatalog.costPoints` untuk `(mode, modelId)` yang `enabled=true`. Body `cost`, `providerId`, `balance`, `role` dari klien **diabaikan**.
3. Satu transaksi submit: sesi valid → tidak ada job `queued|running` → `now >= users.nextGenerateAt` → `available >= cost` → insert job `queued` + ledger `hold:{jobId}` pending → enqueue `{ jobId }`.
4. Satu job aktif per user: unique index `job_one_active_per_user` (`queued|running`). Tab kedua → `409 JOB_IN_PROGRESS`.
5. Replay `Idempotency-Key` (8–128, unique `(userId, idempotencyKey)`) → `202` job yang sama; **tidak** ada hold kedua.
6. Sukses: byte output sudah di `ObjectStorage` **sebelum** capture → `capture:{jobId}` sekali → `succeeded` → `users.nextGenerateAt = now + generate_cooldown_seconds`. Cooldown **hanya** setelah sukses.
7. Gagal terminal (policy/4xx, timeout 5 menit, token kosong, retry habis): `release:{jobId}` → `failed` → **jangan** ubah `nextGenerateAt`. User boleh submit lagi.
8. Siray `429` / 5xx / jaringan di bawah batas retry: job DB tetap `queued` atau `running`; BullMQ boleh `delayed`; hold **tidak** dilepas; klien **tidak** melihat `failed`.
9. `JobStatus` Prisma **tidak** menambah `delayed`. “Delayed” = state antrian BullMQ. Mutex tetap `queued|running`.
10. Poll/status sukses duplikat: satu objek output, satu capture (`P2002` / cek `capture:{jobId}`).
11. Jika `providerJobId` sudah tersimpan, worker **tidak** `submit` ulang — hanya `getStatus`.
12. `GET` job user lain → `404 NOT_FOUND` (bukan 403).
13. `output.url` ke klien = signed URL bucket platform (TTL pendek). URL Siray **bukan** salinan yang dikirim ke browser.
14. `apps/web` dan `packages/core` tidak mengimpor SDK/`packages/providers-siray`. `SIRAY_API_TOKEN` hanya di `worker` (ADR 0007); service `web` Compose tidak boleh mewarisi token dari `env_file`.

## Routes (prefix `/api`)

Auth: cookie `sid` (NextAuth JWT di web → BFF kirim `sid` ke Fastify). Error body: `{ error: { code, message } }` + field ekstra di root jika ada.

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/catalog/generate` | sid | `{ models }` hanya `enabled=true` |
| POST | `/jobs` | sid + `Idempotency-Key` | `202` accept |
| GET | `/jobs` | sid | `{ jobs }` milik sendiri (max 30, terbaru dulu) |
| GET | `/jobs/:id` | sid | satu job milik sendiri; orang lain `404` |

Tidak ada webhook Siray di M4 (poll worker saja). Completion path harus idempoten seolah webhook bisa datang nanti.

### `GET /catalog/generate`

```json
{
  "models": [
    {
      "mode": "t2i",
      "modelId": "black-forest-labs/flux-1.1-pro-t2i",
      "displayName": "Flux 1.1 Pro",
      "providerId": "siray",
      "costPoints": 10
    }
  ]
}
```

- Filter `enabled=true`. Urut `createdAt` naik (atau `sortOrder` jika kolom ada).
- Produksi M4: minimal satu baris t2i `providerId=siray`. `dummy-t2i` `enabled=false`.
- UI tidak mengarang daftar, harga, atau `providerId`. `providerId` boleh dikirim ke UI tetapi **bukan** input otoritatif saat submit.

### `POST /jobs`

Header: `Idempotency-Key` wajib.

```json
{
  "mode": "t2i",
  "modelId": "black-forest-labs/flux-1.1-pro-t2i",
  "prompt": "…",
  "params": { "aspectRatio": "1:1" },
  "cost": 999
}
```

- `mode` wajib. Selain `t2i` yang enabled → `VALIDATION_ERROR`, tanpa hold, tanpa Siray.
- `modelId`: harus baris katalog `enabled=true` untuk `mode` itu. Jika dihilangkan dan **tepat satu** model enabled untuk mode itu, pakai baris itu; jika 0 atau >1 → `VALIDATION_ERROR`.
- `prompt`: string trim, 1–4000 karakter.
- `params`: objek opsional. Whitelist v1: `aspectRatio` (`1:1` default; enum Flux: `1:1` `16:9` `9:16` `3:2` `2:3` `4:5` `5:4` `3:4` `4:3`). Key lain dibuang. `params.fail` **diabaikan** jika `providerId !== dummy`.
- `cost` / `providerId` di body diabaikan.

`202`:

```json
{
  "job_id": "cl…",
  "status": "queued",
  "cost_held": 10,
  "queue_position": 1
}
```

`queue_position` = `1 + count(queued where createdAt < this.createdAt)`.

### `GET /jobs/:id` dan item `GET /jobs`

```json
{
  "id": "cl…",
  "status": "queued | running | succeeded | failed | canceled",
  "mode": "t2i",
  "modelId": "black-forest-labs/flux-1.1-pro-t2i",
  "prompt": "…",
  "cost": 10,
  "progressPct": 0,
  "errorCode": null,
  "queuePosition": 1,
  "createdAt": "…Z",
  "finishedAt": null,
  "nextGenerateAt": null,
  "output": null
}
```

Setelah `succeeded`, `output` (bukan URL Siray):

```json
{
  "url": "https://…signed…",
  "contentType": "image/png",
  "availableUntil": "…Z",
  "signedExpiresAt": "…Z"
}
```

- Signed GET TTL **600 detik**. `availableUntil` = `JobAsset.expiresAt` (14 hari dari simpan).
- `output` hanya jika `status=succeeded` dan ada `JobAsset.kind=output`.
- `errorCode` terisi hanya jika `failed` (kode di tabel bawah, bukan `fail_reason` Siray mentah).

## Kode error HTTP

| HTTP | `error.code` | Kapan |
|---:|---|---|
| 401 | `UNAUTHENTICATED` | tidak ada / sesi invalid |
| 400 | `VALIDATION_ERROR` | key/prompt/mode/model/params; katalog disabled atau mode non-t2i |
| 402 | `INSUFFICIENT_POINTS` | `available < costPoints` |
| 409 | `JOB_IN_PROGRESS` | sudah ada `queued\|running` |
| 429 | `COOLDOWN` | `now < nextGenerateAt`; root `retry_after_seconds` |
| 404 | `NOT_FOUND` | job bukan milik pemanggil atau tidak ada |

Pesan `message` Bahasa Indonesia. Jangan bocorkan eksistensi job orang lain.

## `Job.errorCode` (gagal terminal, bukan HTTP submit)

Ditulis worker; UI memetakan ke copy Indonesia. Hold dilepas; cooldown tidak dipasang.

| code | Artinya |
|---|---|
| `PROVIDER_NOT_CONFIGURED` | `SIRAY_API_TOKEN` kosong / 401–403 auth key |
| `PROVIDER_POLICY` | 4xx policy/moderation (`InvalidParameter`, `SensitiveContentDetected`, `ContentPolicyViolation`, `*SensitiveContentDetected`) |
| `PROVIDER_TIMEOUT` | wall-clock image > 5 menit sejak `startedAt` (domain; video 20 menit nanti) |
| `PROVIDER_ERROR` | 4xx terminal lain (model not found, account overdue, dll.) |
| `PROVIDER_UNAVAILABLE` | 429 / 5xx / jaringan — **batas retry habis** |

Bukan error klien: Siray `429` / `ServerOverloaded` / 5xx / ECONNRESET **sebelum** batas retry.

## Worker + provider

Queue BullMQ `generate`, payload `{ jobId }`, FIFO, `WORKER_CONCURRENCY` default 3.

Router: `Job.providerId` → adapter terdaftar di composition root worker. **Bukan** `if` di `JobService` / wallet.

| `providerId` | Paket | Kapan |
|---|---|---|
| `siray` | `packages/providers-siray` | produksi M4 |
| `dummy` | `apps/worker` dummy (M3) | tes / katalog enabled=false di seed produksi |

Port tetap `GenerationProvider` (`submit` + `getStatus`). Adapter **tidak** memakai `client.image.run()` blocking. HTTP:

- Base: `SIRAY_API_BASE` default `https://api.siray.ai`
- Auth: `Authorization: Bearer ${SIRAY_API_TOKEN}`
- Submit t2i: `POST /v1/images/generations/async` body `{ model, prompt, aspect_ratio }` → `data.task_id` → `Job.providerJobId`
- Poll: `GET /v1/images/generations/async/{task_id}` tiap 3–5 detik
- Status Siray → port: `NOT_START|SUBMITTED|QUEUED` → `queued`; `IN_PROGRESS` → `running`; `SUCCESS` → `succeeded`; `FAILURE` → `failed`

Token bucket **di adapter** (patokan: ≤ concurrency worker, default 1 rps burst 3). Jika bucket kosong, lempar error retryable (job delay, bukan `failed`).

Retry (hanya jaringan/429/5xx): BullMQ attempts **5**, backoff eksponensial (5s, 15s, 45s, …). Setelah itu `PROVIDER_UNAVAILABLE` + release.

Alur sukses (wajib urutan):

1. `queued` → `running` (`startedAt`)
2. `submit` jika `providerJobId` null; persist `task_id`
3. `getStatus` sampai `succeeded` / `failed` / timeout
4. Worker **GET** byte dari `outputUrls` (follow redirect, server-side)
5. `ObjectStorage.put` key `outputs/{userId}/{jobId}.{ext}`
6. `JobAsset` output (`expiresAt = now + 14d`, `contentType`, `bytes`, `sha256` jika mudah)
7. Jika output asset untuk job sudah ada → jangan `put` kedua
8. `captureJob` (`capture:{jobId}`)
9. Job `succeeded` + `users.nextGenerateAt`

Gagal terminal: `releaseJob` (`release:{jobId}`) + `failed` + `errorCode` + `finishedAt`. Jangan set cooldown.

## Katalog / seed (usulan Prisma)

Seed produksi M4:

| mode | modelId | displayName | providerId | costPoints | enabled |
|---|---|---|---|---:|---|
| t2i | `black-forest-labs/flux-1.1-pro-t2i` | Flux 1.1 Pro | siray | 10 | true |
| t2i | `dummy-t2i` | Dummy | dummy | 10 | **false** |

Usulan kolom (BE yang apply): `ModelCatalog.displayName String`. Tanpa kolom, API tetap mengisi `displayName` dari seed/map server — UI tidak memotong slug.

Mode enum lain boleh ada; `POST /jobs` menolak yang tidak enabled.

## Events (internal)

Bukan websocket. Log worker/API, redaksi prompt:

- `job.accepted` `{ jobId, userId, costHeld, modelId, providerId }`
- `job.provider_submitted` `{ jobId, providerJobId }`
- `job.completed` `{ jobId, status, errorCode? }`

Jangan kirim foto input / prompt kesusilaan ke Sentry.

## Unit DAG — siapa boleh menyentuh apa

```
M4-siray-t2i.contract.md (SA, file ini)
        │
        ├─ BE (setelah gerbang manusia)
        │     packages/providers-siray/**
        │     apps/worker/**          (router + poll + copy + capture/release)
        │     apps/api/src/jobs/**    (catalog resolve modelId, GET output signed)
        │     packages/core/src/errors.ts   (kode baru jika perlu)
        │     packages/core/src/ports/generation.ts  (hanya jika port wajib berubah)
        │     prisma/seed.ts (+ schema displayName jika di-apply)
        │     docker-compose.yml      (token di worker; jangan ke web)
        │
        ├─ FE (paralel setelah kontrak beku; jangan sentuh BE)
        │     apps/web/app/generate/**
        │     apps/web/app/jobs/**
        │     apps/web/lib/job-status.ts
        │     apps/web/components/*   hanya jika pola UI belum ada
        │
        └─ QA
              docs/qa/M4-siray-t2i.md
```

### BE wajib

- Implement `SirayProvider` dengan `fetch` ke API Siray; daftar di worker composition root.
- `resolveModel(mode, modelId?)` dari katalog, bukan hardcode.
- Dummy tetap bisa dijalankan **hanya** jika baris katalog dummy enabled (tes).
- Compose: `SIRAY_API_TOKEN` / `SIRAY_API_BASE` di service `worker`. Jangan teruskan ke `web` lewat `env_file` utuh jika itu membocorkan token.

### FE wajib

- Form `/generate`: model t2i enabled dari katalog, nama manusia, biaya server, prompt, Generate.
- Pilih model jika `models.filter(m => m.mode==="t2i").length > 1`.
- Submit + `Idempotency-Key` (UUID), navigasi `/jobs/{id}`, poll 1–2 s sampai terminal. Refresh = GET.
- Tampilkan `queuePosition` / progress. Job aktif → jangan submit paralel; tampilkan “sedang generate”.
- Sukses: `<Image>` signed URL, copy “tersedia sampai {tanggal}” (14 hari), cooldown dari `nextGenerateAt`.
- Gagal: pesan dari `errorCode`, poin kembali, tanpa cooldown.
- **Hapus** checkbox “simulasikan gagal” dari UI produksi.
- Mantine, tanpa `style={{ }}`. Tidak memotong poin. Tidak `fetch` sampai gambar jadi.

### Dilarang silang

| Aktor | Jangan |
|---|---|
| FE | Prisma, BullMQ, `packages/providers-siray`, `SIRAY_*`, ledger |
| BE | `apps/web/**` |
| Worker | Percaya body klien; capture sebelum `put`; serahkan URL Siray ke API response |
| core | Import `siray`, Fastify, Next, AWS SDK |

## Tes fail-closed (untuk QA)

- Dua tab submit: satu `queued`/`running`, lain `409 JOB_IN_PROGRESS`.
- `cost` palsu di body: hold = katalog.
- Mode non-t2i / catalog disabled: `VALIDATION_ERROR`, tanpa hold, tanpa HTTP Siray.
- Token kosong / 4xx policy / timeout 5 menit: release, tidak cooldown.
- 429 Siray di bawah retry: bukan `failed`, hold tetap.
- Sukses: objek di storage kita sebelum capture; signed URL host platform.
- Poll duplikat: satu capture, satu `JobAsset` output.
- User B `GET` job A: `404`.
- Bundle web / `packages/core`: tidak ada import Siray.
- UI produksi tanpa checkbox dummy.

## Out of scope

t2v/i2v/i2i produksi, inpaint, face swap, explore publik, webhook Siray, admin ubah katalog/cooldown (M5), Firebase, ComfyUI, adapter Fal sebagai v1.
