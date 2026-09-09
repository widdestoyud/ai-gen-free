# Domain: auth (ADR 0006, ADR 0014, ADR 0016)

## 1. Siklus Pendaftaran & Kredensial Pengguna

- **Registrasi Akun (`POST /user/register`)**:
  - Input: `email`, `password`.
  - **Whitelist Domain Email Resmi**: Hanya menerima email dengan domain `@gmail.com`, `@yahoo.com`, `@ymail.com` (dan domain regional yahoo). Menolak seluruh email uji coba, disposable, atau domain asing lainnya (`A010`).
  - **Kebijakan Kata Sandi**: Minimal 8 karakter, setidaknya mengandung 1 huruf kapital dan 1 angka (`A011`).
  - **Penyimpanan Kata Sandi**: Di-hash secara kriptografis menggunakan `scrypt` dengan 16-byte random salt (`salt:hash`).
  - **Status Awal**: Akun dibuat dengan `emailVerifiedAt: null`. Tautan verifikasi email dibuat dan dikirim ke pengguna via `EmailPort.sendVerificationEmail()`.
- **Validasi Email (`POST /auth/email-validation` body `{ token }`)**:
  - Input: `token` (berlaku 24 jam).
  - Jika token valid dan belum kedaluwarsa, `emailVerifiedAt` diisi timestamp saat ini.

## 2. Login & Verifikasi Perangkat (Single Session)

- **Masuk (`POST /user/login`)**:
  - Input: `email`, `password`, dan opsi `deviceId`.
  - Memverifikasi kecocokan email dan hash kata sandi (`A012`).
  - Memastikan email telah terverifikasi (`A013`).
  - **Deteksi Perangkat**:
    - Jika login pertama kali (`!user.lastDeviceId`) atau terdeteksi ganti perangkat (`user.lastDeviceId !== deviceId`):
      - Sistem mengirimkan 6 digit OTP ke email untuk konfirmasi kepemilikan.
      - Respon mengembalikan `{ requiresOtp: true, deviceId, message: "..." }`.
    - Jika perangkat sama yang telah terverifikasi:
      - Langsung membuat sesi baru.
      - Menghapus seluruh sesi lama jenis yang sama (`user`) untuk menegakkan sesi tunggal (ADR 0003).
      - Menyetel cookie `sid`.

## 3. Aturan Rate Limiting & Penguncian Terpusat (`RateLimitConfig`)

Dikelola terpusat di `packages/core/src/config/rate-limit.config.ts`:
1. **Permintaan / Resend OTP (`POST /auth/otp`)**:
   - Dibatasi maksimal **3 kali per 30 menit**.
   - Jika pengguna meminta kirim ulang lebih dari 3 kali, pengguna dikunci dan harus menunggu **30 menit** sebelum permintaan berikutnya diizinkan (`A008`, HTTP 429).
2. **Validasi OTP (`POST /auth/otp-validation`)**:
   - Dibatasi maksimal **3 kali salah input**.
   - Jika pengguna sudah 3 kali salah memasukkan kode OTP, tantangan OTP langsung dibatalkan / dikunci permanen (`A004`, HTTP 429). Pengguna wajib meminta OTP baru.
3. **Login Brute-Force**:
   - Dibatasi maksimal 5 kali kegagalan per 15 menit per akun/IP.

## 4. Profil Pengguna Bebas IDOR (`GET/PATCH /user/profile`)

- Endpoint profil memungkinkan pengguna membaca dan memperbarui:
  - Nama alias (`displayName`)
  - Nomor telepon (`phoneNumber`)
  - Nomor KTP (`ktp`)
  - Alamat (`address`)
- **Pencegahan Celah IDOR (Insecure Direct Object References)**:
  - Identitas pengguna diambil **secara mutlak** dari cookie sesi server (`session.userId`).
  - Nilai `userId` atau `id` yang dikirim dalam request body maupun query parameter sengaja diabaikan.
  - Pengguna A dengan token/sesinya tidak akan pernah bisa mengubah atau membaca data profil milik Pengguna B.

## 5. Konfigurasi Pesan & Respon Terpusat (`AuthResponses`)

Dikelola terpusat di `packages/core/src/config/responses.config.ts`:
- Seluruh kode status HTTP, pesan deskriptif bahasa Indonesia, dan kode error dengan prefix domain (`A001` - `A017`) terdaftar dalam satu objek konfigurasi yang mudah disesuaikan di masa mendatang.

## 6. Admin Auth

- Tidak lewat `/user/login` publik.
- Menggunakan Basic Auth + OTP ke email akun yang memiliki role `admin`.

## 7. Kontrak Port Email

```typescript
export interface EmailPort {
  sendOtp(email: string, code: string): Promise<void>;
  sendVerificationEmail(email: string, token: string, verifyUrl?: string): Promise<void>;
}
```
