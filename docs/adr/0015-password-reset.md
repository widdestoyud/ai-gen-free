# ADR 0015 — Reset kata sandi via tautan email, cooldown, dan rate limit IP

**Status:** diterima  
**Tanggal:** 2026-09-09  
**Memperbarui:** ADR 0014 (signup password + rate limit terpusat), ADR 0003 (satu sesi)

## Konteks

Pelanggan sudah mendaftar dengan email + password (ADR 0014) tetapi tidak ada alur lupa kata sandi. Perlu endpoint backend untuk meminta reset, mengonfirmasi tautan dari email, dan memasang kata sandi baru — dengan jeda penyalahgunaan dan seluruh angka di satu file config.

## Keputusan

### 1. Endpoint (Fastify, alias `/api/...`)

| Method | Path | Body | Auth |
|---|---|---|---|
| POST | `/auth/password-reset` | `{ email }` | tidak |
| GET/POST | `/auth/password-reset-validation` | `{ token }` atau `?token=` | tidak |
| POST | `/auth/password-reset-confirm` | `{ token, password }` | tidak |

Password baru memakai aturan yang sama dengan registrasi (`validatePassword`). Token disimpan sebagai hash (`hashSecret`), bukan plaintext. Confirm **tidak** membuat sesi; seluruh `Session` user dicabut (ADR 0003).

### 2. Email belum terdaftar

Jika email tidak ada, belum `emailVerifiedAt`, atau tidak punya `passwordHash`, respon `EMAIL_NOT_FOUND` (`A018`, HTTP 404) dengan pesan *"Email belum terdaftar."* Email tidak dikirim.

### 3. Cooldown per akun

- Setelah tautan **berhasil terkirim**, request baru ditolak (`PASSWORD_RESET_PENDING`, `A021`) selama `passwordResetPendingSeconds` (default 1 jam) **atau** sampai konfirmasi berhasil, yang lebih dulu.
- Setelah password **berhasil diganti**, request baru ditolak (`PASSWORD_RESET_COOLDOWN`, `A022`) selama `passwordResetCompletedSeconds` (default 24 jam) dihitung dari `User.passwordChangedAt`.

### 4. Rate limit per IP

Maksimal `passwordResetIp.maxAttempts` (default 3) request berformat email valid per IP per jendela. Request ke-4 (email berbeda sekalipun) ditolak `RATE_LIMITED` (`A008`) dengan pesan dari config. Setiap percobaan dihitung, termasuk email belum terdaftar.

### 5. Config terpusat

Durasi dan kuota hanya di `packages/core/src/config/rate-limit.config.ts`. Pesan/kode hanya di `packages/core/src/config/responses.config.ts`. Ganti angka di file config, bukan di route/service.

### 6. Email

Port `EmailPort.sendPasswordResetEmail`. Adapter SMTP mengirim tautan `{APP_PUBLIC_URL}/auth/password?token=...`. Halaman FE membaca token dari URL, lalu `POST` JSON body (ADR 0016).

## Konsekuensi

- Schema: `User.passwordChangedAt`, tabel `PasswordResetToken`.
- Kode error baru: `A021`, `A022`, `A023`.
- Pesan `A018` diseragamkan menjadi "Email belum terdaftar."
- UI Next.js tidak berubah (ADR 0012); BFF catch-all sudah mem-proxy `/api/auth/password-reset*`.
