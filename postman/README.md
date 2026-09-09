# Postman — Testing Direct Fastify Backend API

Anda dapat menguji seluruh API Backend Fastify **langsung** melalui `http://localhost:4000` tanpa perlu menjalankan Next.js (`apps/web`).

Port `4000` telah dipublish ke host di `docker-compose.yml`.

## Berkas yang Tersedia

1. **Collection**: `postman/ai-gen-free.postman_collection.json`
2. **Environment**: `postman/local.postman_environment.json`

## Cara Impor & Penggunaan

1. Buka aplikasi **Postman**.
2. Klik tombol **Import** di pojok kiri atas.
3. Drag & drop atau pilih file `postman/ai-gen-free.postman_collection.json` dan `postman/local.postman_environment.json`.
4. Pilih environment **ai-gen-free local (via Next BFF)** di kanan atas Postman.
5. Variabel `baseUrl` diatur default ke **`http://localhost:4000`** (Direct Backend API).

## Daftar Endpoint Utama

### 1. Registrasi Akun (`POST /user/register`)
- Body: `{ "email": "user@gmail.com", "password": "Password123!" }`
- Domain whitelist: `@gmail.com`, `@yahoo.com`, `@ymail.com`. Domain palsu/test ditolak (`A010`).
- Password: Min 8 karakter, min 1 kapital, min 1 angka (`A011`).

### 2. Verifikasi Email (`POST /auth/email-validation`)
- Body: `{ "token": "<token-dari-database-atau-email>" }`. Token **wajib di body**, bukan query.

### 3. Login User (`POST /user/login`)
- Body: `{ "email": "user@gmail.com", "password": "Password123!" }`
- Password salah untuk email terdaftar: HTTP 401 (`A012` — "Kata sandi yang Anda masukkan salah.").
- Email tidak ditemukan di database: HTTP 404 (`A018` — "Email belum terdaftar.").
- Sudah dalam posisi login: HTTP 409 (`A019` — "Akun Anda saat ini sudah dalam keadaan masuk (login). Silakan keluar (logout) terlebih dahulu.").
- Triggers OTP jika login pertama kali / ganti perangkat (`requiresOtp: true`).

### 4. Resend OTP (`POST /auth/otp`)
- Body: `{ "email": "user@gmail.com" }`
- Ditolak jika akun sudah dalam posisi login (`A019`).
- Rate limit: Maksimal 3 kali per 30 menit (`A008`).

### 5. Validasi OTP (`POST /auth/otp-validation`)
- Body: `{ "email": "user@gmail.com", "code": "123456" }`
- Ditolak jika akun sudah dalam posisi login (`A019`).
- Maksimal 3x salah input OTP sebelum dikunci permanen (`A004`).

### 6. User Profile Anti-IDOR (`GET` & `PATCH /user/profile`)
- `GET /user/profile`: Membaca profil user aktif berdasarkan cookie sesi.
- `PATCH /user/profile`: Body `{ "name": "...", "phone": "...", "ktp": "...", "address": "..." }`.
- Kebal IDOR karena identitas diambil mutlak dari cookie sesi server.

### 7. Logout User (`POST /user/logout` & `POST /auth/logout`)
- Mencabut sesi user aktif di database dan menghapus cookie `sid`.

### 7b. Reset Kata Sandi
- `POST /auth/password-reset` body `{ "email": "user@gmail.com" }`. Email belum terdaftar: `A018`. Request ulang sebelum 1 jam / sebelum konfirmasi: `A021`. Setelah password berhasil diganti: `A022` (24 jam). Maks 3 request per IP: `A008`.
- `POST /auth/password-reset-validation` body `{ "token": "..." }`. Token invalid: `A023`. Tidak consume token. Jangan `?token=`.
- `POST /auth/password-reset-confirm` body `{ "token": "...", "password": "NewValidPass123" }`. Password lemah: `A011`. Sukses mencabut seluruh sesi.

### 8. Admin Management (`POST /admin/register`, `POST /admin/login`, `GET /admin/customer/list`, `PUT /admin/settings/generate_cooldown_seconds`, `POST /admin/logout`)
- `POST /admin/register`: Body `{ "username": "admin123", "password": "AdminPassword123!" }`. Mendaftar akun admin baru langsung dengan `role: "admin"` (tanpa OTP/verifikasi email).
- `POST /admin/login`: Body `{ "username": "admin123", "password": "AdminPassword123!" }`. Login admin via username & password.
- `GET /admin/customer/list`: Header/Cookie `sid_admin`. Melihat seluruh daftar pengguna customer/user.
- `PUT /admin/settings/generate_cooldown_seconds`: Body `{ "value": 3600 }`. Mengubah durasi cooldown generator global.
- `POST /admin/logout`: Mencabut sesi admin dan menghapus cookie `sid_admin`.



