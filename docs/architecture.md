# Arsitektur sistem

Dokumen ini adalah peta sistem. Keputusan yang dikunci ada di `docs/adr/`. Domain: `docs/domain/`.

## Tujuan v1

Web app: user login email+OTP, top up poin (unggah bukti di dashboard, admin mengkurasi notifikasi), submit generate, job jalan di background, hasil privat 14 hari. Admin (Basic Auth + role) kurasi bayar, atur cooldown, lihat job.

## Bukan tujuan v1

- Face swap orang nyata sebagai fitur default
- Explore/gallery publik hasil generate pengguna (galeri kurasi admin `/app/generate` memakai tabel `Template` terpisah dengan autentikasi & gating spicy)
- Multi-session
- Generate paralel per user
- Firebase Auth
- ComfyUI / RunPod always-on
- Semua logika di dalam Next.js
- MinIO/Mailpit sebagai satu-satunya cara jalan (opsional `--profile`; driver dari `.env`)

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
                └─ ObjectStorage (R2 / S3 / MinIO via STORAGE_DRIVER, TTL 14 hari)
```

## Batas tanggung jawab

| Paket | Boleh | Dilarang |
|---|---|---|
| `apps/web` | UI Mantine, NextAuth cookie, BFF proxy, polling job | Prisma, BullMQ, SDK Siray, hitung harga, style inline |
| `apps/api` | HTTP, auth, validasi, transaksi hold+enqueue | Polling Siray menit-menitan di request |
| `apps/worker` | Jalan job, adapter, capture/release | Percaya body klien |
| `packages/core` | Use case, state machine, port | Import Fastify, Next, `siray`, AWS SDK |
| `packages/db` | Prisma, repository | Aturan harga, HTTP |
| `packages/storage` | Adapter MinIO/S3/R2/memory | Ledger, sesi, HTTP |
| `packages/wallet` | Ledger hold/capture/release | HTTP, SDK storage |
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

Lihat `docs/domain/auth.md`. Bukan Firebase. Cookie browser = NextAuth di `apps/web` (ADR 0010); OTP dan baris sesi tetap di `apps/api`.

## Poin

Lihat `docs/domain/wallet.md`. Hold/capture.

## Admin

Lapisan:

1. Basic Auth reverse proxy pada `/admin` dan `/api/admin`
2. Form login admin terpisah; NextAuth cookie admin + `sid_admin` ke API
3. `users.role = admin` hanya dari seed/CLI
4. Menu: **notifikasi bukti transfer**, kurasi invoice, paket topup, **galeri template** (`/admin/templates`), user, job, **pengaturan cooldown**, adjust poin beralasan, audit log

## Penyimpanan 14 hari & Aset Template Permanen

- Bucket privat, signed URL pendek (atau `STORAGE_PUBLIC_ENDPOINT` untuk URL tampilan)
- Lifecycle/retensi 14 hari dari `succeeded_at` / `expiresAt` hanya menyapu prefix sementara (`outputs/`, `inputs/`, `uploads/customer/`, `uploads/admin/`, `temp/` sesuai `isRetentionKey`)
- Metadata job + prompt + hash tetap setelah file hilang
- **Aset Galeri Template (`templates/`)**: cover dan gambar referensi template dikompres ke WebP dengan pola key `^templates\/[a-z0-9]+\.webp$`. Prefix `templates/` berada **di luar** `isRetentionKey` sehingga permanen (tanpa TTL) dan hanya dihapus secara eksplisit (best-effort) ketika admin mengganti gambar atau menghapus template

## Galeri Template (`apps/api/src/templates/`)

- **Schema & ADR**: Model `Template` dan `TemplateImage` (`onDelete: Cascade`) di `prisma/schema.prisma` tanpa kolom TTL/retensi ([ADR 0019](./adr/0019-template-gallery.md)), dengan indeks komposit untuk paginasi/filter/sort server-side ([ADR 0018](./adr/0018-server-side-pagination-sorting-filtering.md)).
- **Modul API (`apps/api/src/templates/` + `apps/api/src/routes/templates.ts`)**:
  - `parse.ts`: validasi input admin (`parseTemplateInput`, batas 0–4 gambar referensi, regex key `^templates\/[a-z0-9]+\.webp$`, aspect ratio kanonik, dan whitelist `modelId` abstrak) serta parser query paginasi (`parseCustomerListQuery` batch default 12 maks 24; `parseAdminListQuery` default 20 maks 100).
  - `service.ts`: CRUD admin + `AuditLog` (`template.create|update|delete`), upload multipart atau impor URL gambar dengan proteksi SSRF (`isSafePublicUrl` dari `@ai-gen-free/core`), kompresi WebP (`sharp`), pembersihan key lama `templates/` setelah transaksi DB sukses, serta endpoint customer (`customerList`, `customerCategories`, `recordUse`).
  - **Isolasi data customer**: Endpoint `/customer/templates` dan `/customer/templates/categories` hanya mengembalikan template `isActive = true`, tidak pernah membocorkan `storageKey` (hanya `coverUrl` & `images[].url`), hanya mengekspos `modelId` abstrak (`t2i-standard`, `t2i-spicy`, `i2i-standard`, `i2i-spicy`, atau `null`), serta menegakkan `spicyModeEnabled` (HTTP 403 bila belum aktif).
- **Worker (`apps/worker/src/resolve-inputs.ts`)**: Referensi gambar dari template dikirim sebagai `template-image:<TemplateImage.id>`. Worker memprioritaskan resolusi prefix `template-image:`, memvalidasi ulang `Template.isActive` dan `Template.isSpicy` terhadap `User.spicyModeEnabled`, lalu mengambil objek `templates/...` dari `ObjectStorage`. Jika template tidak aktif/dihapus atau tidak diizinkan, resolusi gagal sehingga job gagal dan hold poin dilepas.
- **Web (`apps/web`)**: Studio `/app/generate` menampilkan tab **Tasks** dan **Templates** (`hooks/use-template-gallery.ts`, `lib/template-apply.ts`, `views/app/generate/components/template-gallery.tsx`), manajemen admin di `/admin/templates` (`views/admin/templates/`), dan semua rute BFF tercatat di `apps/web/lib/api-mapping.ts`.

## Docker

Lihat `docker-compose.yml`. Jalur kanonik: `docker compose up --build`.

## Urutan implementasi (agen wajib ikut)

1. Compose: postgres, redis; storage/email dari `.env`; MinIO/Mailpit opsional `--profile`
2. Prisma migrate + seed admin
3. Auth OTP + sesi tunggal
4. Admin Basic Auth + settings cooldown
5. Ledger + unggah bukti + kurasi admin (bukan lunas tanpa file)
6. Job dummy (tanpa Siray) + hold/capture + mutex + cooldown
7. Tes race tab + dual login
8. Adapter Siray t2i
9. Gallery 14 hari
10. Mode berikutnya lewat router, bukan if-else di UI
