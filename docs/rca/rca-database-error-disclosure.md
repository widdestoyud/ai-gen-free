# Root Cause Analysis (RCA): Database Error & Stack Trace Disclosure on Login Endpoint

**Incident ID**: INC-20261006-DB-LEAK  
**Date**: 6 Oktober 2026  
**Severity**: High (Security / Information Disclosure)  
**Status**: Resolved  
**Affected Components**: `apps/api` (Fastify Error Handler), `apps/web` (NextAuth / Auth Bridge)  

---

## 1. Ringkasan Insiden (Executive Summary)

Pada pengujian pemanggilan endpoint `POST /api/login`, ketika terjadi gangguan koneksi database (PostgreSQL connection pool circuit breaker tripped: `(ECIRCUITBREAKER) too many authentication failures`), respons API yang diterima oleh client (browser/curl) membocorkan detail internal server dan database secara gamblang:

```json
{
    "transaction_id": "tx-muw0wyrv-7c70c0bc",
    "error": {
        "code": "E002",
        "message": "\nInvalid `prisma.user.findUnique()` invocation in\n/app/apps/api/src/auth/service.ts:72:34\n\n  69  * Melempar AuthError EMAIL_NOT_FOUND (A018, HTTP 404) jika email tidak ditemukan.\n  70  */\n  71 export async function findUserOrThrow(email: string) {\n→ 72   const user = await prisma.user.findUnique(\nError querying the database: FATAL: (ECIRCUITBREAKER) too many authentication failures, new connections are temporarily blocked"
    }
}
```

Respons tersebut membocorkan:
1. Struktur direktori file server (`/app/apps/api/src/auth/service.ts`)
2. Cuplikan kode sumber internal dan baris kode pemanggilan ORM (`prisma.user.findUnique()`)
3. Detail driver internal database (`FATAL: (ECIRCUITBREAKER) too many authentication failures`)
4. Kode error yang menyesatkan (`E002` / `VALIDATION_ERROR` alih-alih `E001` / `NOT_READY` untuk error sistem/database)

---

## 2. Analisis Akar Masalah (Root Cause Analysis)

### 2.1 Alur Terjadinya Kebocoran (Failure Chain)

1. **Database Connection Failure**:
   Driver database Prisma mencoba mengeksekusi query `findUnique` pada model `User`. Koneksi ke database PostgreSQL gagal akibat circuit breaker koneksi database aktif (`ECIRCUITBREAKER`). Prisma melempar exception `PrismaClientInitializationError` / `PrismaClientKnownRequestError` yang memuat format pesan lengkap dengan stack trace, path berkas, dan snippet kode.

2. **Celah pada Handler Fastify (`apps/api/src/index.ts`)**:
   Pada Fastify `setErrorHandler`:
   ```typescript
   let code: string = ErrorCodes.VALIDATION_ERROR;
   let message: string = error.message || "Terjadi kesalahan pada server";
   ```
   Ketika exception yang terjadi bukan merupakan `AppError` atau `AuthError` (misalnya unhandled database error), handler menggunakan default fallback:
   - `code` di-set menjadi `ErrorCodes.VALIDATION_ERROR` (`E002`).
   - `message` mengambil **langsung** nilai `error.message` mentah tanpa penyaringan (sanitization) atau pengecekan status code (apakah 5xx atau error sistem).

3. **Celah pada Auth Bridge Frontend (`apps/web/lib/otp-error.ts` & `/api/login/route.ts`)**:
   NextAuth credentials provider menerima payload error dari backend API lalu meneruskannya via string delimiter `code||message||txid`. Frontend parsing function `parseAuthBridgeError` membaca `message` dan langsung mengembalikannya ke client response tanpa memfilter indikator database/query error.

---

## 3. Dampak Keamanan (Security Impact)

- **Klasifikasi Kerentanan**: **CWE-209: Generation of Error Message Containing Sensitive Information**
- **Risiko Informasi**:
  - Penyerang (attacker) dapat memetakan arsitektur backend, path direktori sistem operasi container (`/app/...`), teknologi ORM yang digunakan (Prisma ORM), dan status koneksi database backend.
  - Membantu penyerang dalam merancang serangan terarah (targeted attack) berdasarkan informasi stack trace dan exception database.

---

## 4. Tindakan Perbaikan & Pencegahan (Remediation & Prevention)

### 4.1 Masking & Sanitasi di Fastify Centralized Error Handler (`apps/api/src/index.ts`)
1. **Pemisahan Error Terverifikasi vs Internal Error**:
   - `AppError` dan `AuthError` yang dibuat sengaja oleh logika aplikasi tetap menampilkan pesan ramah pengguna yang telah dikurasi dan status HTTP yang sesuai (mis. 400, 401, 403, 404).
   - Error client Fastify terverifikasi (JSON syntax error, payload too large, invalid multipart) ditangani khusus dengan pesan aman.
2. **Masking Menyeluruh untuk Error Sistem / Database / 5xx**:
   - Semua unhandled exception atau error 5xx secara default diubah menjadi:
     - **Status HTTP**: `500` (Internal Server Error) / `503` (Service Unavailable)
     - **Error Code**: `E001` (`NOT_READY`)
     - **Error Message**: `"Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi."`
3. **Pencatatan Log Server-Side**:
   - Seluruh detail stack trace, query database, dan pesan asli **hanya dicatat pada log server internal** (`req.log.error(error)`) yang terasosiasi dengan `transaction_id`. Pengguna hanya menerima `transaction_id` untuk kebutuhan pelacakan dukungan pelanggan tanpa kebocoran data internal.

### 4.2 Sanitasi pada Frontend Auth Bridge (`apps/web/lib/otp-error.ts` & `apps/web/app/api/login/route.ts`)
1. Menambahkan fungsi deteksi pesan error internal (`isInternalErrorMessage`) yang memeriksa pola kata kunci database (`prisma`, `fatal:`, `ecircuitbreaker`, `select `, `postgres`, `connection pool`, dll.).
2. Jika terdeteksi pola internal, kode error diubah menjadi `E001` dan pesan disanitasi menjadi pesan publik yang aman.
3. Respons HTTP `/api/login` mengembalikan status `500` untuk kode `E001` / error sistem.

---

## 5. Verifikasi & Pengujian (Verification)

1. **Unit & Integration Tests**:
   - Dibuat test suite baru:
     - `apps/api/src/error-handler.test.ts`: Memvalidasi bahwa unhandled database exception diubah menjadi status 500, code `E001`, dan pesan aman tanpa memuat kata kunci database.
     - `apps/web/lib/otp-error.test.ts`: Memvalidasi sanitasi pesan error database pada auth bridge.
   - Seluruh 243 unit & integration test di seluruh monorepo berhasil lolos (`243 passing, 0 failing`).
2. **Type Safety & Build**:
   - Typecheck TypeScript (`tsc --noEmit`) berhasil tanpa error.
   - Container Docker `api`, `worker`, dan `web` diperbarui dan berjalan sehat.
