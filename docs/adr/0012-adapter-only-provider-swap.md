# ADR 0012 — Ganti provider hanya di adapter; presentation tidak berubah

**Status:** diterima  
**Tanggal:** 2026-09-05  
**Mengamendemen:** [0007](./0007-docker.md) (MinIO/Mailpit bukan syarat Compose), mempertegas [0005](./0005-generation-providers.md), [0009](./0009-object-storage-port.md), [0006](./0006-auth-not-firebase.md), [0010](./0010-nextauth-session.md)

## Konteks

Compose meng-hardcode `STORAGE_DRIVER=minio` dan `SMTP_HOST=mailpit`, menimpa `.env`. Ganti R2 atau SMTP produksi memaksa edit Compose dan terasa seperti ganti “sistem”. Presentation FE juga bisa terseret jika halaman mengimpor NextAuth langsung.

Keputusan produk: ganti backend (storage, email, generate, cookie sesi) **hanya** di composition root + class adapter. Flow, komponen, layout, job, wallet **tidak** berubah.

## Keputusan

### Batas yang boleh berubah

| Ganti | Sentuh hanya |
|---|---|
| Object storage (R2 / S3 / MinIO) | `.env` `STORAGE_*` + `packages/storage` adapter baru jika protokol beda |
| Email OTP (SMTP Sumopod / SES / Mailpit) | `.env` `SMTP_*` + class `EmailPort` baru jika bukan SMTP |
| Generate (Siray / lain) | `packages/providers-*` + daftar di worker + baris katalog |
| Cookie browser (NextAuth / lain) | `apps/web/auth.ts`, `auth-admin.ts`, `lib/create-auth.ts`, route `/api/session/**` dan `/api/admin/session/**` |

### Batas yang dilarang berubah karena ganti provider

- Halaman, layout, komponen Mantine, copy Indonesia, alur OTP → job → gallery
- `JobService`, `WalletService`, ledger hold/capture/release
- Kontrak HTTP `{ error: { code, message } }`, `POST /jobs` 202
- Prisma schema job/wallet (kecuali kolom katalog yang memang domain)

### Compose

- `environment:` api/worker **jangan** menimpa `STORAGE_*`, `SMTP_*`, `SIRAY_*`.
- MinIO, Mailpit, dan Postgres Docker = service **opsional** (`profiles: minio` / `mailpit` / `postgres`), bukan dependensi wajib.
- Jalur operator: `.env` memilih `DATABASE_URL`, storage, SMTP. `docker compose up --build` tidak mensyaratkan Postgres/MinIO/Mailpit lokal.

### FE sesi

Halaman dan `components/` hanya memakai `lib/auth-actions.ts` dan `lib/server-api.ts`. Mereka tidak mengimpor `next-auth`. Ganti Auth.js = ganti adapter sesi, bukan rewrite login/generate/admin layout.

## Bukan keputusan ini

- Menghapus port `ObjectStorage` / `EmailPort` / `GenerationProvider`.
- Memakai Firebase Auth (0006 tetap).
- Memasukkan Zencreator atau provider generate kedua tanpa baris katalog + paket adapter.

## Konsekuensi

- Tes yang mengasumsikan MinIO/Mailpit selalu nyala harus memakai `--profile minio` / `--profile mailpit` atau env test.
- SMTP 465: `SMTP_SECURE=true` + user/pass di env, bukan hardcode di UI.
