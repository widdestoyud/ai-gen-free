# ADR 0014 — Registrasi Password, Whitelist Domain Email, Rate Limit Terpusat, dan Verifikasi Perangkat Baru

**Status:** diterima  
**Tanggal:** 2026-09-06  
**Memperbarui:** ADR 0006 (Auth email OTP sendiri), ADR 0003 (Satu sesi, satu perangkat)

## Konteks

Sebelumnya, autentikasi langsung meminta OTP ke email untuk setiap login tanpa proses signup eksplisit dengan password.
Ditemukan kebutuhan bisnis & keamanan:
1. Mencegah pendaftaran akun palsu / email uji coba asal-asalan.
2. Memerlukan kombinasi email dan password (minimal 8 karakter, 1 huruf kapital, 1 angka).
3. Verifikasi kepemilikan email melalui tautan/token verifikasi wajib dilakukan sebelum user boleh masuk sistem.
4. Mencegah penyalahgunaan pengiriman OTP berulang (spam OTP) dan brute-force kode OTP.
5. Mendukung deteksi pergantian perangkat (jika user login dari perangkat baru atau login pertama kali, wajib memasukkan OTP yang dikirim ke email).
6. Mengatur batas rate limit dan kamus respon error/sukses secara terpusat (konfigurasi terisolasi, prinsip SOLID: Open/Closed).
7. Menyediakan endpoint profil user (nama alias, telepon, KTP, alamat) yang kebal terhadap celah IDOR (Insecure Direct Object References).

## Keputusan

### 1. Registrasi Akun (`POST /user/register` & `/api/user/register`)
- Input: `email` dan `password`.
- Whitelist domain: Hanya menerima domain konsumen resmi: `@gmail.com`, `@yahoo.com`, `@ymail.com` (dan regional yahoo). Semua domain lain ditolak dengan error `A010` (`INVALID_EMAIL_DOMAIN`).
- Aturan password:
  - Minimal 8 karakter.
  - Setidaknya mengandung 1 huruf kapital (`[A-Z]`).
  - Setidaknya mengandung 1 angka (`[0-9]`).
  - Divalidasi di `packages/core/src/auth/password.ts`.
  - Disimpan menggunakan scrypt hash (`salt:hash`), tanpa plaintext.
- Mengirim email verifikasi berisi token acak (berlaku 24 jam). Akun berstatus `emailVerifiedAt: null`.

### 2. Validasi Email (`POST /auth/email-validation` & `/api/auth/email-validation`)
- Input: `token` (via body atau query parameter).
- Token dicocokkan dengan tabel `EmailVerificationToken`. Jika valid, tandai `consumedAt` dan perbarui `User.emailVerifiedAt = now()`.

### 3. Login Pengguna (`POST /user/login` & `/api/user/login`)
- Input: `email`, `password`, dan opsi `deviceId`.
- Menolak jika kredensial salah (`A012`) atau email belum diverifikasi (`A013`).
- **Deteksi Perangkat**:
  - Jika login pertama kali (`!user.lastDeviceId` / `!user.lastLoginAt`) ATAU terdeteksi perangkat berbeda (`user.lastDeviceId !== deviceId`):
    - Sistem mengirim OTP ke email terdaftar.
    - Mengembalikan respon `{ requiresOtp: true, deviceId, message: "..." }`.
  - Jika perangkat sama (perangkat yang telah terverifikasi):
    - Langsung membuat sesi baru.
    - Mencabut seluruh sesi lama user (menegakkan single active session).

### 4. Batasan Rate Limit Terpusat (`RateLimitConfig`)
Dikelola terpusat di `packages/core/src/config/rate-limit.config.ts`:
- **Request / Resend OTP (`POST /auth/otp`)**:
  - Maksimal 3 kali dalam 30 menit.
  - Jika melebihi batas 3x, user dikunci selama **30 menit** sebelum dapat meminta OTP lagi.
- **Validasi OTP (`POST /auth/otp-validation`)**:
  - Maksimal 3 kali percobaan salah.
  - Jika sudah 3x salah, kode OTP challenge langsung dibatalkan / dikunci permanen (`A004`, `OTP_LOCKED`).

### 5. Respon & Pesan Terpusat (`AuthResponses`)
Dikelola terpusat di `packages/core/src/config/responses.config.ts`:
- Seluruh pesan error, status HTTP, dan kode error (`A001`–`A017`) terdaftar dalam satu objek terpusat.
- Tidak ada hardcoded error string di dalam controller routes.

### 6. Profil Pengguna Bebas IDOR (`GET/PATCH /user/profile`)
- Dapat membaca dan memperbarui: `displayName`, `phoneNumber`, `ktp`, `address`.
- **Anti-IDOR Security**: Identitas user diekstrak **hanya dan mutlak** dari cookie sesi server yang terverifikasi (`session.userId`). Parameter `userId` atau `id` dari request body/query sengaja diabaikan. User A tidak dapat memanipulasi profil User B.

## Konsekuensi

- Schema Prisma menambahkan field `passwordHash`, `displayName`, `phoneNumber`, `ktp`, `address`, `lastDeviceId`, `lastLoginAt` pada model `User`, serta tabel `EmailVerificationToken`.
- Migrasi database `20260906190000_user_signup_password_profile` telah diaplikasikan.
- Kompatibilitas rute legacy (`/api/auth/otp/request`, `/api/auth/otp/verify`, `/api/me`) tetap terjaga sebagai alias.
