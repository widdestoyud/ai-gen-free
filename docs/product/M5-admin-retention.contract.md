# M5 contract — Admin + retensi 14 hari

**SA** — unit `M5-admin-retention`. Depends on M2 (kurasi bukti) + M4 (t2i, signed URL, cooldown domain).  
**ADR:** tidak ada keputusan terkunci yang dicabut. 0004 (cooldown admin + reset terpisah), 0008 (ledger, tanpa kredit publik), 0009 (port `ObjectStorage.delete`) tetap berlaku.

Panel admin v1: cooldown, daftar user/job (bukan gallery publik), adjust poin beralasan, retensi objek generate 14 hari. Kurasi pembayaran **tetap** kontrak M2. Face swap orang nyata, explore publik, ban user, katalog model admin **bukan** unit ini.

## Invarian (job + wallet)

1. `POST /api/jobs` tetap `202` + hold **sebelum** inferensi. Satu job `queued|running` per user (`409 JOB_IN_PROGRESS`). Cooldown **hanya** setelah sukses. Gagal = `release:{jobId}`, **jangan** set `users.nextGenerateAt`.
2. Gerbang cooldown submit = **`users.nextGenerateAt`**. `Job.nextGenerateAt` hanya snapshot saat job itu sukses. UI **dilarang** memakai `max(jobs.nextGenerateAt)` setelah reset admin.
3. `PUT generate_cooldown_seconds` menulis `AppSetting` saja. **Tidak** menghitung ulang `users.nextGenerateAt` mana pun. Job sukses **berikutnya** (user mana pun) memakai nilai baru. Default seed 43200. Nilai `0` = tidak pasang cooldown pada sukses berikutnya.
4. Reset cooldown = `POST` terpisah (ADR 0004): `users.nextGenerateAt = null` untuk **satu** user. User lain tidak terpengaruh. Mutex satu job aktif tetap berlaku. Bukan efek samping ubah setting.
5. Capture sekali (`capture:{jobId}`), idempoten. Retensi file **bukan** refund; status tetap `succeeded`.
6. `JobAsset.expiresAt` = 14 hari dari `put` sukses. Signed URL TTL **600 detik** (5–15 menit). Klien tidak boleh mengira TTL signed = retensi 14 hari.
7. `GET` output: `signGetUrl` **hanya** jika aset `kind=output`, `purgedAt IS NULL`, dan `expiresAt > now`. Selain itu `output.url = null` (metadata job tetap). Jangan 500 jika objek sudah hilang.
8. Worker `retention` menghapus objek lewat port `ObjectStorage.delete` (bukan SDK di `packages/core` / `apps/web`). Lalu set `purgedAt`. **Jangan** hapus baris `Job` / `prompt` / `sha256` / `phash` / `providerJobId` / ledger / `User`.
9. Prefix hapus: hanya `outputs/` dan `inputs/`. **Jangan** sentuh `proofs/**`. Jangan pasang lifecycle S3/MinIO bucket-wide 14 hari (bukti transfer ikut terhapus). Bukti: retensi terpisah ≥ 90 hari; M5 **tidak** menghapus bukti, termasuk yang berumur 14 hari atau sedang `awaiting_review` / dispute.
10. Sweep retensi **idempoten**: jalan dua kali tidak error; aset sudah `purgedAt` dilewati; `delete` key hilang = sukses.
11. `GET` job user lain → `404 NOT_FOUND` (bukan 403). Menebak `storageKey` / signed URL tidak membuka bucket public-read.
12. Body klien `cost` / `balance` / `role` / `points` **diabaikan**. Tidak ada `UPDATE users SET points`. Tidak ada `POST /wallet/credit`.
13. Adjust = satu ledger `adjust` posted, `reason` wajib, `Idempotency-Key` wajib. Replay kunci sama → bukan double-post. Debit yang membuat `available < 0` ditolak.
14. Setiap aksi admin mutasi (setting, reset, adjust, approve/reject M2) menulis `AuditLog` (aktor, aksi, target, waktu UTC, `ip`). Meta **tanpa** byte foto / prompt kesusilaan mentah.
15. Admin **tidak** dibuat lewat register publik. `/api/admin/*` butuh Basic Auth reverse proxy **dan** cookie `sid_admin` dengan `role=admin` (kecuali OTP request/verify yang sudah M1). Sesi `sid` user biasa ditolak. `apps/web` tidak memanggil Prisma / BullMQ / SDK storage.

## Auth admin

Lapisan (tidak berubah dari M1/M2):

1. Basic Auth pada `/admin` dan `/api/admin` (middleware Next + hook Fastify).
2. OTP admin → cookie NextAuth `/api/admin/session`; BFF kirim `sid_admin` ke Fastify.
3. `userFromCookie(sid_admin, "admin")` + `role === "admin"`.

Tanpa Basic **atau** tanpa sesi admin → `401 UNAUTHENTICATED`.  
Sesi pelanggan (`sid`) pada `/api/admin/*` → `401 UNAUTHENTICATED` (jangan 403 yang membedakan “ada tapi bukan admin”).

Error body: `{ error: { code, message } }` + field ekstra di root jika ada. `message` Bahasa Indonesia.

## Routes (prefix `/api`)

### Pelanggan (perilaku M4 + retensi)

| Method | Path | Auth | Perubahan M5 |
|---|---|---|---|
| GET | `/me` | sid | tambah `user.nextGenerateAt` (`string \| null`, UTC) |
| GET | `/jobs` | sid | `{ jobs, nextGenerateAt }` — `nextGenerateAt` dari **User** |
| GET | `/jobs/:id` | sid | jangan sign aset kedaluwarsa/purged; orang lain `404` |
| POST | `/jobs` | sid | tidak berubah (gerbang tetap `users.nextGenerateAt`) |

Kurasi user (`/invoices`, `/wallet`) tidak berubah (M2).

`GET /me`:

```json
{
  "user": {
    "id": "cl…",
    "email": "user@example.com",
    "role": "user",
    "nextGenerateAt": "2026-09-06T12:00:00.000Z"
  }
}
```

`GET /jobs`:

```json
{
  "nextGenerateAt": "2026-09-06T12:00:00.000Z",
  "jobs": [ { "id": "cl…", "status": "succeeded", "output": { "url": "https://…", "contentType": "image/png", "availableUntil": "…Z", "signedExpiresAt": "…Z" } } ]
}
```

`GET /jobs/:id` item yang sama seperti M4, dengan aturan output:

| Kondisi | `output` |
|---|---|
| `succeeded` + aset hidup (`purgedAt` null, `expiresAt > now`) | `{ url, contentType, availableUntil, signedExpiresAt }` signed 600s, host `STORAGE_PUBLIC_ENDPOINT` |
| `succeeded` + kedaluwarsa / `purgedAt` / objek hilang | `{ url: null, contentType, availableUntil, signedExpiresAt: null }` — **bukan** 404 job |
| bukan `succeeded` / tidak ada aset | `null` |

`availableUntil` = `JobAsset.expiresAt` (14 hari), **bukan** `signedExpiresAt`.

`url` tidak boleh hostname Docker (`minio`, `minio:9000`) dan tidak boleh URL Siray.

### Admin (baru di M5; kurasi M2 tetap)

Semua baris di bawah: Basic + `sid_admin` + `role=admin`.

| Method | Path | Result |
|---|---|---|
| GET | `/admin/settings/generate_cooldown_seconds` | nilai saat ini |
| PUT | `/admin/settings/generate_cooldown_seconds` | simpan + AuditLog |
| GET | `/admin/users` | daftar ringkas |
| GET | `/admin/users/:id` | satu user + saldo |
| POST | `/admin/users/:id/cooldown/reset` | kosongkan cooldown user itu |
| POST | `/admin/users/:id/wallet/adjust` | ledger `adjust` |
| GET | `/admin/jobs` | daftar job (bukan gallery) |
| GET | `/admin/jobs/:id` | detail + output signed jika hidup |
| GET | `/admin/jobs/:id/file` | stream same-origin (opsional pratinjau, pola M2 `/invoices/:id/file`) |
| GET | `/admin/audit` | log terbaru |

Kurasi M2 **tetap**: `/admin/notifications`, `/admin/invoices`, `…/proof`, `…/file`, `…/approve`, `…/reject`. Jangan diganti di M5.

#### `GET /admin/settings/generate_cooldown_seconds`

```json
{ "key": "generate_cooldown_seconds", "value": 43200 }
```

Jika baris `AppSetting` belum ada: kembalikan **43200** (sama seed). Jangan 404.

#### `PUT /admin/settings/generate_cooldown_seconds`

```json
{ "value": 3600 }
```

- `value`: integer JSON, `0 <= value <= 2592000` (30 hari). Bukan string. Bukan dari query.
- Transaksi: upsert `AppSetting` `{ key, value }` → `AuditLog`.
- **Tidak** `UPDATE User SET nextGenerateAt`.
- Idempoten nilai sama: tetap 200, AuditLog boleh mencatat `from`/`to` yang sama atau dilewati jika `from === to` — pilih **tetap tulis** sekali per request (lebih mudah diaudit).
- Response: `{ "key": "generate_cooldown_seconds", "value": 3600 }`.

Audit: `action=settings.generate_cooldown_seconds.updated`, `target=generate_cooldown_seconds`, `meta={ from, to }`.

#### `GET /admin/users`

Query: `q` (substring email, case-insensitive, opsional), `limit` default 50 max 100, `offset` default 0.

```json
{
  "users": [
    {
      "id": "cl…",
      "email": "user@example.com",
      "role": "user",
      "nextGenerateAt": "…Z",
      "available": 40,
      "held": 0,
      "createdAt": "…Z"
    }
  ]
}
```

`available` / `held` dari ledger (`computeBalance`), bukan angka klien. **Bukan** dump file, session token, atau OTP.

#### `GET /admin/users/:id`

Objek yang sama + `emailVerifiedAt`. Tidak ada → `404 NOT_FOUND`.

Tidak ada `PATCH` role / ban di M5.

#### `POST /admin/users/:id/cooldown/reset`

Body kosong. User tidak ada → `404`.

Sukses:

```json
{ "ok": true, "userId": "cl…", "nextGenerateAt": null }
```

- Set `User.nextGenerateAt = null` saja. Jangan rewrite baris `Job`.
- User yang tidak sedang cooldown: tetap `200 { ok: true }` (idempoten).
- Audit: `action=user.cooldown.reset`, `target={userId}`, `meta={ previousNextGenerateAt }`.

#### `POST /admin/users/:id/wallet/adjust`

Header: `Idempotency-Key` wajib (8–128, trim), sama aturan job.

```json
{ "amount": 50, "reason": "koreksi topup ganda" }
```

- `amount`: integer ≠ 0, `|amount| <= 1000000`. Positif kredit, negatif debit.
- `reason`: string trim, 3–500 karakter.
- Kunci ledger: `adjust:{targetUserId}:{Idempotency-Key}` unique.
- Transaksi: `SELECT Wallet FOR UPDATE` → cek `available + amount >= 0` → insert `adjust` posted (`createdByUserId=admin`, `reason`) → `refreshWalletCache` → AuditLog.
- Replay kunci sama: kembalikan entri yang ada, **tanpa** baris kedua, HTTP 200.
- User tanpa wallet: `upsert` wallet kosong lalu adjust (user hasil seed/register selalu punya wallet; tetap aman).

Sukses:

```json
{
  "ok": true,
  "userId": "cl…",
  "available": 90,
  "held": 0,
  "entry": {
    "id": "cl…",
    "type": "adjust",
    "status": "posted",
    "amount": 50,
    "reason": "koreksi topup ganda",
    "idempotencyKey": "adjust:cl…:…"
  }
}
```

Audit: `action=wallet.adjusted`, `target={userId}`, `meta={ amount, reason, ledgerId }` (bukan foto).

#### `GET /admin/jobs`

Query: `status` (enum `JobStatus`, opsional), `userId` (opsional), `q` (substring email pemilik, opsional), `limit`/`offset` sama.

Bukan explore. Tanpa signed URL di daftar (hindari N sign).

```json
{
  "jobs": [
    {
      "id": "cl…",
      "userId": "cl…",
      "email": "user@example.com",
      "mode": "t2i",
      "status": "succeeded",
      "modelId": "black-forest-labs/flux-1.1-pro-t2i",
      "cost": 10,
      "promptPreview": "seorang kucing …",
      "outputSha256": "ab…",
      "createdAt": "…Z",
      "finishedAt": "…Z",
      "availableUntil": "…Z",
      "purged": false
    }
  ]
}
```

- `promptPreview`: trim, maks **120** karakter (bukan prompt penuh di list).
- `purged`: `true` jika aset output `purgedAt` terisi atau `expiresAt <= now`.
- `outputSha256`: `JobAsset.sha256` output jika ada, else `null`.

#### `GET /admin/jobs/:id`

Prompt penuh + `params` whitelist yang tersimpan + `errorCode` + `output` aturan sama pelanggan (signed 600s jika hidup). Job siapa pun (admin). Tidak ada → `404`.

#### `GET /admin/jobs/:id/file`

Sama pola bukti M2: stream `Content-Type` aset, `Cache-Control: private, max-age=60`, `Content-Disposition: inline`. Hanya jika output masih bisa di-`get`. Kedaluwarsa/purged/`get` gagal → `404 NOT_FOUND` (jangan 500). Bukan public-read.

#### `GET /admin/audit`

Query: `limit` default 50 max 100, `offset`, `action` opsional.

```json
{
  "items": [
    {
      "id": "cl…",
      "actorId": "cl…",
      "actorEmail": "admin@example.com",
      "action": "user.cooldown.reset",
      "target": "cl…",
      "ip": "…",
      "meta": {},
      "createdAt": "…Z"
    }
  ]
}
```

## Kode error HTTP

| HTTP | `error.code` | Kapan |
|---:|---|---|
| 401 | `UNAUTHENTICATED` | tanpa Basic, tanpa/`invalid` `sid`/`sid_admin`, atau `role !== admin` pada `/api/admin/*` |
| 400 | `VALIDATION_ERROR` | setting non-integer / di luar 0–2592000; adjust tanpa `reason` / amount 0 / non-integer; `Idempotency-Key` tidak valid |
| 402 | `INSUFFICIENT_POINTS` | adjust debit membuat `available < 0` |
| 404 | `NOT_FOUND` | user/job admin tidak ada; **atau** job pelanggan bukan milik pemanggil; file output admin sudah purged |
| 409 | `JOB_IN_PROGRESS` | regresi `POST /jobs` (tidak berubah) |
| 429 | `COOLDOWN` | regresi `POST /jobs`; root `retry_after_seconds` dari **User.nextGenerateAt** |

Jangan tambah kode baru di `packages/core` kecuali QA menemukan lubang; keempat kode di atas sudah ada. Pesan Indonesia. Jangan bocorkan eksistensi job orang lain.

Tidak ada endpoint pelanggan: hapus file, adjust sendiri, ubah role, ubah cooldown global.

## Prisma (usulan — BE yang apply)

Tambah kolom, **jangan** hapus baris aset:

```prisma
model JobAsset {
  // ... existing ...
  purgedAt DateTime?

  @@index([expiresAt, purgedAt])
}
```

Migrasi: `purgedAt` nullable. Query sweep: `expiresAt < now AND purgedAt == null`.  
`Job`, `LedgerEntry`, `Invoice.proofStorageKey` **tidak** ikut dihapus.

`AppSetting.generate_cooldown_seconds` sudah ada (JSON number). Seed 43200 tetap.

Index unik parsial `job_one_active_per_user` **tetap**.

## Worker retensi

Queue BullMQ **`retention`** (terpisah dari `generate` agar FIFO generate tidak terganjal). Payload `{}`. Repeat setiap **15 menit**. Concurrency **1**. Dijalankan proses `apps/worker` yang sama (Compose **tidak** wajib service baru; ADR 0007 tetap).

Alur satu sweep (wajib urutan, batch 100):

1. Pilih `JobAsset` `expiresAt < now()` AND `purgedAt IS NULL`, urut `expiresAt` naik.
2. Jika `storageKey` tidak berawalan `outputs/` atau `inputs/` → **jangan delete**; log error; skip (jangan set `purgedAt`).
3. `storage.delete(key)` — missing object = sukses.
4. Set `purgedAt = now`. Jangan sentuh `Job.status`, ledger, `sha256`, `prompt`.
5. Gagal `delete` → jangan set `purgedAt`; retry sweep berikutnya.

Jangan enqueue retensi dari request HTTP pelanggan. Jangan `delete` dari `GET /jobs`.

Bukti transfer: tidak ada query `Invoice` di job ini.

## Events (internal)

Bukan websocket. Redaksi prompt/foto:

- `admin.settings.updated` `{ actorId, key, from, to }`
- `admin.user.cooldown_reset` `{ actorId, userId }`
- `admin.wallet.adjusted` `{ actorId, userId, amount }` — tanpa `reason` panjang di Sentry jika tidak perlu
- `retention.purged` `{ assetId, jobId, key }` — tanpa prompt

## Unit DAG — siapa boleh menyentuh apa

```
M5-admin-retention.contract.md (SA, file ini)
        │
        ├─ BE (setelah gerbang manusia)
        │     prisma/schema.prisma + migrate   (JobAsset.purgedAt)
        │     packages/wallet/src/ledger.ts    (adjust + idempotency)
        │     apps/api/src/jobs/service.ts     (jangan sign expired/purged; GET /jobs + nextGenerateAt User)
        │     apps/api/src/routes/auth.ts      (GET /me.nextGenerateAt)
        │     apps/api/src/routes/admin.ts     (baru) atau pecahan settings/users/jobs
        │     apps/api/src/wallet/service.ts   (hanya jika adjust diletakkan di sini; jangan ubah approve M2)
        │     apps/worker/src/retention.ts     (baru)
        │     apps/worker/src/index.ts         (Worker queue retention + repeat)
        │     docker-compose.yml               hanya jika env baru (tidak wajib)
        │
        ├─ FE (paralel setelah kontrak beku; jangan sentuh BE)
        │     apps/web/app/admin/page.tsx      (nav: kurasi, cooldown, user, job, audit)
        │     apps/web/app/admin/settings/**
        │     apps/web/app/admin/users/**
        │     apps/web/app/admin/jobs/**
        │     apps/web/app/admin/audit/**      (opsional; boleh tab di page admin)
        │     apps/web/app/jobs/[id]/job-client.tsx
        │     apps/web/app/generate/generate-client.tsx
        │     apps/web/lib/job-status.ts
        │     apps/web/components/job-output.tsx
        │
        └─ QA
              docs/qa/M5-admin-retention.md
```

### BE wajib

- Apply migrasi `purgedAt`. Sweep memakai port storage, prefix-aware.
- Setting cooldown tidak menyentuh `User.nextGenerateAt`.
- Reset hanya user target. Adjust wajib reason + kunci idempoten + `FOR UPDATE`.
- `GET /jobs/:id` milik orang lain = 404. Signed host publik.
- Compose: retensi hidup saat `docker compose up --build` (worker yang sama). Jangan kirim `SIRAY_*` ke `web`.
- AuditLog untuk setiap mutasi admin di atas.

### FE wajib

- Admin di belakang Basic Auth yang sudah ada. Bahasa Indonesia, Mantine, **tanpa** `style={{ }}`. Item berulang = `apps/web/components/`.
- Menu: notifikasi kurasi (M2), pengaturan cooldown, daftar user (reset + adjust + alasan), daftar job (pratinjau signed jika hidup), jejak audit.
- Form cooldown: angka detik, default tampil 43200, simpan lewat PUT. Copy: nilai baru untuk sukses berikutnya, countdown yang berjalan tidak meloncat.
- Reset: konfirmasi, satu user.
- Adjust: amount + reason wajib; tampilkan saldo server setelah sukses. Jangan kirim `role`.
- Job admin: bukan masonry publik; tidak ada “bagikan”.
- Pelanggan `/jobs/[id]`: sukses + `output.url` → gambar + “Tersedia sampai {tanggal lokal}”. Sukses + `output.url == null` → metadata (status, prompt, biaya, tanggal) + **“File sudah tidak tersedia.”** Jangan sembunyikan halaman job.
- Gallery generate: hanya item dengan `output.url`. Riwayat job tanpa file tetap boleh tercantum sebagai teks, bukan tautan rusak.
- Cooldown UI: dari `GET /jobs.nextGenerateAt` atau `GET /me.user.nextGenerateAt`, **bukan** `latestCooldownUntil(jobs)` semata (reset admin harus langsung kelihatan).
- Poll signed URL tetap 1–2 s selama aktif; setelah sukses refresh sebelum `signedExpiresAt`. Setelah unavailable, jangan poll selamanya.
- Tidak memotong poin di klien. Tidak import Prisma / BullMQ / S3 / Siray.

### Dilarang silang

| Aktor | Jangan |
|---|---|
| FE | Prisma, BullMQ, `@aws-sdk/*`, `packages/providers-siray`, ledger mutation, `style={{ }}` |
| BE | `apps/web/**` |
| Worker | Percaya body klien; hapus `proofs/`; hapus baris `Job`; capture/release ulang karena retensi |
| core | Import Fastify, Next, AWS SDK, `siray` |

## Tes fail-closed (untuk QA)

- PUT cooldown 3600: setting berubah; `nextGenerateAt` user A di masa depan **tetap**; sukses berikutnya +3600s; AuditLog ada.
- Reset user B: B boleh `POST /jobs` (saldo + tidak ada job aktif); user C tidak terpengaruh; AuditLog ada.
- Sweep: `expiresAt` lewat → objek hilang; `Job`+prompt+hash tetap; jalan dua kali idempoten.
- Invoice bukti umur 14 hari **tidak** terhapus sweep generate.
- `GET /jobs/:id` pemilik, file hidup: signed 5–15 menit, host bukan Docker.
- Setelah retensi / `expiresAt` lewat: metadata ada, `url` null, status `succeeded`, capture tidak refund.
- User B `GET` job A: `404`. Guess key bucket: bukan public-read.
- `/api/admin/*` tanpa Basic / tanpa `sid_admin`: `401`. Cookie `sid` user: ditolak.
- Adjust tanpa reason: ditolak, saldo sama. Adjust replay kunci sama: satu baris posted.
- Body `cost`/`role`/`balance` diabaikan. Tidak ada kredit publik.
- Regresi AGENTS.md: dua tab; login perangkat kedua; gagal = release tanpa cooldown; sukses = capture sekali + cooldown; poll duplikat bukan double-capture; isolasi job A vs B.
- Bundle web: tidak ada Prisma/BullMQ/S3/Siray. UI tanpa gallery publik dan tanpa tautan permanen.

## Out of scope

Explore/gallery publik, share link, CDN public-read, face swap, t2v/i2v/i2i produksi, inpaint, Firebase Auth, multi-session, generate paralel, hapus baris `Job` sebagai “pembersihan”, hapus bukti pada jam 14 hari, portal take-down PSE, ban user, admin katalog model, watermark, membuat admin lewat register, cookie sesi ketiga, `style={{ }}`.
