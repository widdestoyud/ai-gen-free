# Postman — Testing Direct Fastify Backend API

Anda dapat menguji seluruh API Backend Fastify **langsung** melalui `http://localhost:4000` tanpa perlu menjalankan Next.js (`apps/web`).

Port `4000` telah dipublish ke host di `docker-compose.yml`.

## Hirarki (tepat 1 koleksi, 1 environment)

```
postman/
  ai-gen-free.postman_collection.json   # satu-satunya koleksi
  local.postman_environment.json        # satu-satunya environment
  README.md
```

Folder di dalam koleksi (bukan file terpisah): `health` → `auth` → `customer` → `generate` → `admin`.

Jangan impor folder `postman/postman/` atau file `.yaml` hasil export app — itu koleksi ganda. Abaikan jika muncul di disk (sudah di `.gitignore`).

## Cara Impor & Penggunaan

1. Buka aplikasi **Postman**.
2. Klik **Import**.
3. Pilih hanya `postman/ai-gen-free.postman_collection.json` dan `postman/local.postman_environment.json`.
4. Pilih environment **ai-gen-free local (via Direct API)** di kanan atas.
5. `baseUrl` default **`http://localhost:4000`**.

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

### 8. Admin Management (`POST /admin/register`, `POST /admin/login`, `GET /admin/customer/list`, `PUT /admin/settings/generate_cooldown_seconds`, `GET /admin/models/settings`, `PUT /admin/models/settings`, `POST /admin/logout`)
- `POST /admin/register`: Body `{ "username": "admin123", "password": "AdminPassword123!" }`. Mendaftar akun admin baru langsung dengan `role: "admin"` (tanpa OTP/verifikasi email).
- `POST /admin/login`: Body `{ "username": "admin123", "password": "AdminPassword123!" }`. Login admin via username & password.
- `GET /admin/customer/list`: Header/Cookie `sid_admin`. Melihat seluruh daftar pengguna customer/user.
- `PUT /admin/settings/generate_cooldown_seconds`: Body `{ "value": 3600 }`. Mengubah durasi cooldown generator global.
- `GET /admin/models/settings`: Mengambil konfigurasi model default aktif untuk Video & Image (Standar & Spicy) serta daftar katalog model.
- `PUT /admin/models/settings`: Body `{ "normalVideoModelId": "...", "spicyVideoModelId": "...", "normalT2iModelId": "...", ... }`. Menyimpan model default dengan validasi ketat (model video dilarang untuk image, dan sebaliknya).

### 9. Image Uploads Sementara (`POST/GET /customer/uploads` & `POST/GET /admin/uploads`)
- `POST /customer/uploads`: Upload file gambar pelanggan (form-data `file`). Memeriksa format `png, jpg, jpeg, webp` (max 5 MB), mengompresi ke WebP menggunakan sharp (menjaga orientasi & rasio potrait/landscape), dan menyimpannya di storage sementara.
- `GET /customer/uploads`: Menampilkan daftar gambar yang diunggah pelanggan (mendukung query parameter pagination `limit` & `offset`). Terpisah mutlak dari hasil generate AI di `/customer/generated-lists`.
- `POST /admin/uploads`: Upload file gambar admin (form-data `file`) ke direktori storage admin.
- `GET /admin/uploads`: Menampilkan daftar seluruh unggahan gambar aktif untuk admin.

### 10. AI Generation & Studio (`POST /jobs`, `POST /generate/siray/:slug`)
- `POST /jobs`: Submit pekerjaan generate umum (202 Accepted + `job_id`). Body: `{ "mode": "t2i" | "i2i" | "i2v" | "t2v", "prompt": "...", "params": { "aspectRatio": "1:1" } }`.
- `POST /generate/siray/gpt-image-2-t2i`: Submit khusus model Siray `openai/gpt-image-2-t2i`.
- `POST /generate/siray/gpt-image-2-edit`: Submit khusus model edit Siray `openai/gpt-image-2-edit`. Body: `{ "prompt": "...", "images": ["https://..."], "size": "1024x1024", "quality": "medium", "n": 1 }`.
- `POST /generate/siray/seedream-5.0-pro-t2i-spicy`: Submit khusus model T2I Spicy `bytedance/seedream-5.0-pro-t2i-spicy`.
- `POST /generate/siray/qwen-image-3-edit-spicy`: Submit khusus model I2I Edit Spicy `alibaba/qwen-image-3-edit-spicy`.
- `POST /generate/siray/seedance-2.5-i2v`: Submit khusus model I2V Normal `bytedance/seedance-2.5-i2v` (default duration: `6s`, resolution: `480`).
- `POST /generate/siray/seedance-2.0-i2v-spicy`: Submit khusus model I2V Spicy `bytedance/seedance-2.0-i2v-spicy` (default duration: `6s`, resolution: `480`).
- `POST /generate/siray/seedance-2.5-i2v-spicy`: Submit khusus model I2V Spicy 2.5 `bytedance/seedance-2.5-i2v-spicy` (default duration: `6s`, resolution: `480`).
- `POST /generate/siray/wan-2.7-i2v-uncensored`: Submit khusus model I2V Uncensored `alibaba/wan-2.7-i2v-uncensored` (default duration: `6s`, resolution: `480`).
- `GET /customer/generated-lists`: Menampilkan riwayat hasil generate AI pengguna.
- `GET /customer/generated/:jobId`: Polling status pekerjaan generate tertentu.
- `GET /customer/generated/:jobId/file`: Mengambil URL unduhan/berkas media hasil generate.

### 11. Telemetry & Log Observability (`apps/telemetry` Port 5050)
Aplikasi server & dashboard mandiri berbasis Splunk-style tracing & Redis Observability di `http://localhost:5050`:
- `GET /`: Dashboard Web UI interaktif dengan tab navigasi:
  - **Logs & Tracing (Splunk-style)**: Dark mode, date range filter, input tracing (transactionId, jobId, userId), histogram log volume harian, dan viewer JSON detail.
  - **Redis & BullMQ Monitor**: Visualisasi memori, throughput ops/detik, keyspace hit ratio, BullMQ queues visualizer (`generate` dan `retention`), serta keyspace category distribution explorer.
- `GET /api/logs`: Endpoint query log terstruktur dengan filter rentang tanggal, level (`info`, `warn`, `error`), service (`api`, `worker`, `siray`, `storage`), `transactionId`, `jobId`, `userId`, dan fulltext search `q`.
- `GET /api/stats`: Endpoint statistik total log, error count, warning count, dan time-bucketed histogram.
- `POST /api/ingest`: Ingest log event baru dari microservice lain.
- `GET /health`: Health check service telemetry mandiri.
- `GET /api/redis/info`: Kesehatan Redis, memori, ops/detik, hit ratio, dan connected clients.
- `GET /api/redis/queues`: Status BullMQ queues (`generate`, `retention`), counts (waiting, active, completed, failed, delayed), dan sample jobs.
- `GET /api/redis/keys`: Ringkasan distribusi kategori keyspace Redis (BullMQ, ratelimit, session, wallet, cooldown) dan sampel keys dengan TTL dan tipe data.
- `GET /api/redis/summary`: Mengambil seluruh data telemetry Redis (server, queues, keyspace) dalam 1 panggilan API efisien.


