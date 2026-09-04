# Arsitektur sistem

Dokumen ini adalah peta sistem. Keputusan yang dikunci ada di `docs/adr/`. Domain: `docs/domain/`.

## Tujuan v1

Web app: user login email+OTP, top up poin (unggah bukti di dashboard, admin mengkurasi notifikasi), submit generate, job jalan di background, hasil privat 14 hari. Admin (Basic Auth + role) kurasi bayar, atur cooldown, lihat job.

## Bukan tujuan v1

- Face swap orang nyata sebagai fitur default
- Explore/gallery publik
- Multi-session
- Generate paralel per user
- Firebase Auth
- ComfyUI / RunPod always-on
- Semua logika di dalam Next.js

## Diagram

```
Browser
  ├─ /            apps/web (Next.js)
  └─ /admin       Basic Auth di reverse proxy, lalu login admin
         │
         ▼
      Caddy / nginx
         ├─ /        → web:3000
         └─ /api     → api:3001
         │
         ▼
    apps/api (Fastify)
         │
         ├─ PostgreSQL + Prisma
         ├─ Redis (antrian, rate limit)
         └─ enqueue job
                │
                ▼
         apps/worker
                ├─ JobService, WalletService (packages/core)
                ├─ GenerationRouter → SirayAdapter | (adapter lain)
                └─ MinIO / S3  (TTL 14 hari)
```

## Batas tanggung jawab

| Paket | Boleh | Dilarang |
|---|---|---|
| `apps/web` | UI, cookie ke API, polling job | Prisma, BullMQ, SDK Siray, hitung harga |
| `apps/api` | HTTP, auth, validasi, transaksi hold+enqueue | Polling Siray menit-menitan di request |
| `apps/worker` | Jalan job, adapter, capture/release | Percaya body klien |
| `packages/core` | Use case, state machine, port | Import Fastify, Next, `siray` |
| `packages/db` | Prisma, repository | Aturan harga, HTTP |
| `packages/providers-siray` | Mapping ke API Siray | Ledger, sesi user |

## Alur generate (wajib dipatuhi)

1. User `POST /api/jobs` + `Idempotency-Key`.
2. API, satu transaksi:
   - tolak jika sesi tidak valid
   - tolak jika ada job `queued|running` (`409 JOB_IN_PROGRESS`)
   - tolak jika `now < next_generate_at` (`429 COOLDOWN` + sisa detik)
   - hitung `cost` dari katalog server
   - kunci wallet, cek available ≥ cost (`402 INSUFFICIENT_POINTS`)
   - insert job `queued`, ledger `hold`
3. Enqueue BullMQ.
4. Response `202 { job_id, status, cost_held, queue_position }`.
5. Worker: `running` → panggil provider → simpan objek → **capture** → `succeeded` → set `next_generate_at`.
6. Gagal/timeout: **release** hold → `failed` → **jangan** set cooldown.
7. UI poll `GET /api/jobs/:id`. Refresh = GET lagi. Tidak ada request HTTP yang menahan inferensi.

## 10 user bersamaan

```
t=0  10 user submit → 10 job queued (masing-masing 1)
t=0  worker concurrency=3 → 3 running di Siray, 7 menunggu
t=?  selesai satu → worker ambil job berikutnya FIFO
```

User melihat posisi antrean. Tidak ada preemption. Tidak ada 10 koneksi Siray jika `WORKER_CONCURRENCY=3`.

Adapter Siray memakai token bucket agar 429 dari Siray tidak merusak FIFO (job kembali `delayed`, bukan `failed`, sampai batas retry jaringan).

## Auth

Lihat `docs/domain/auth.md`. Bukan Firebase.

## Poin

Lihat `docs/domain/wallet.md`. Hold/capture.

## Admin

Lapisan:

1. Basic Auth reverse proxy pada `/admin` dan `/api/admin`
2. Form login admin terpisah, cookie `sid_admin`
3. `users.role = admin` hanya dari seed/CLI
4. Menu: **notifikasi bukti transfer**, kurasi invoice, user, job, **pengaturan cooldown**, adjust poin beralasan, audit log

## Penyimpanan 14 hari

- Bucket privat, signed URL pendek
- Lifecycle 14 hari dari `succeeded_at`
- Metadata job + prompt + hash tetap setelah file hilang

## Docker

Lihat `docker-compose.yml`. Jalur kanonik: `docker compose up --build`.

## Urutan implementasi (agen wajib ikut)

1. Compose: postgres, redis, minio, mailpit
2. Prisma migrate + seed admin
3. Auth OTP + sesi tunggal
4. Admin Basic Auth + settings cooldown
5. Ledger + unggah bukti + kurasi admin (bukan lunas tanpa file)
6. Job dummy (tanpa Siray) + hold/capture + mutex + cooldown
7. Tes race tab + dual login
8. Adapter Siray t2i
9. Gallery 14 hari
10. Mode berikutnya lewat router, bukan if-else di UI
