# Root Cause Analysis (RCA): Login & OTP Redirect Bounce ke Landing Page

- **Tanggal Kejadian**: 09 Oktober 2026
- **Status**: Terselesaikan & Terverifikasi (Resolved)
- **Komponen Terdampak**: `packages/core/src/auth/session-security.ts`, `apps/web/lib/server-api.ts`, `apps/web/app/app/layout.tsx`

---

## 1. Ringkasan Masalah (Executive Summary)
Pengguna yang melakukan login melalui alur kredensial email + kata sandi dan berhasil memvalidasi kode OTP 6 digit mengalami *bounce* (terlempar kembali) ke halaman landing page (`/`) alih-alih masuk dan tetap berada di dalam halaman aplikasi (`/app/generate` atau `/app/*`).

---

## 2. Analisis Akar Masalah (Root Cause Analysis)

### A. Rantai Eksekusi Alur Login & Navigasi
1. Pengguna memasukkan email & password di modal login, memicu `POST /api/login`. Sistem mendeteksi kebutuhan OTP dan membuka `OtpModal`.
2. Pengguna memasukkan 6 digit kode OTP, memicu `POST /api/otp-validation`.
3. `POST /api/otp-validation` memvalidasi OTP ke Fastify backend (`/auth/otp-validation`) dan menerbitkan cookie sesi `authjs.session-token`.
4. Klien Next.js mengeksekusi `router.push("/app/generate")` untuk berpindah ke halaman studio AI.
5. Server Next.js mengeksekusi server component layout `apps/web/app/app/layout.tsx`:
   ```typescript
   export default async function AppSectionLayout({ children }: { children: ReactNode }) {
     const session = await auth();
     if (!session?.user) {
       redirect("/");
     }
     const profile = await loadCustomerProfile();
     if (!profile?.user) {
       redirect("/"); // <-- TITIK REDIRECT BOUNCE TERJADI DI SINI
     }
     return <AppWorkspace>{children}</AppWorkspace>;
   }
   ```

### B. Akar Penyebab Utama (The Core Bugs)
1. **False-Positive pada Deteksi Anti-Hijacking (`session-security.ts`)**:
   - Di `packages/core/src/auth/session-security.ts`, fungsi `isAutomatedToolUserAgent()` sebelumnya memasukkan string `undici` dan `node-fetch`.
   - Ketika Next.js Server Component (`loadCustomerProfile()`) melakukan server-to-server `fetch()` ke Fastify backend (`http://api:4000/customer/profile`), Node.js secara bawaan menyematkan user-agent runtime `undici` / `node-fetch`.
   - Fastify `userFromCookie` mengecek `verifySessionBinding(session, context)`. Karena sesi tersimpan memiliki User-Agent browser asli (misalnya Google Chrome), sedangkan request server component ber-User-Agent `undici`, fungsi mendeteksi perbedaan tersebut sebagai serangan pembajakan sesi (*Session Hijacking / USER_AGENT_MISMATCH*) dan langsung mengembalikan `401 Unauthorized`.
   
2. **IP Subnet Mismatch antara Client IP dan Internal Docker Bridge**:
   - Saat login, Fastify mencatat IP publik pengguna (misalnya `114.122.x.x`).
   - Saat Next.js server component memanggil Fastify via jaringan internal Docker (`http://api:4000`), IP pengirim adalah IP container bridge (`172.18.0.x`).
   - `isSubnetMatching()` menolak request internal tersebut karena subnet IP publik berbeda dengan subnet internal Docker (*IP_MISMATCH*), memicu respon `401 Unauthorized`.

3. **Missing Client Header Forwarding pada `fetchUserApi` & `fetchAdminApi`**:
   - Fungsi `fetchUserApi()` di [`apps/web/lib/server-api.ts`](file:///home/ubuntu/projects/ai-gen-free/apps/web/lib/server-api.ts) sebelumnya tidak meneruskan header kontekstual dari `next/headers` (`user-agent`, `x-forwarded-for`, `x-real-ip`, `cf-connecting-ip`), sehingga request server component selalu tampak sebagai request internal tanpa identitas klien asli.

---

## 3. Tindakan Perbaikan yang Diterapkan (Remediation)

1. **Penyempurnaan `packages/core/src/auth/session-security.ts`**:
   - Menghapus `undici`, `node-fetch`, dan `axios/` dari daftar *automated attack tools*.
   - Menambahkan pengecualian (*bypass*) yang mengenali panggilan internal server-to-server dari runtime Next.js.
   - Menambahkan fungsi `isPrivateOrInternalIp()` untuk mengenali subnet privat RFC1918 (`127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) sehingga komunikasi internal antar-container diizinkan tanpa merusak proteksi sesi publik.

2. **Forwarding Header Lengkap di `apps/web/lib/server-api.ts`**:
   - `fetchUserApi()` dan `fetchAdminApi()` kini membaca dan meneruskan header klien (`user-agent`, `x-forwarded-for`, `cf-connecting-ip`, dsb.) dari `next/headers` ke upstream Fastify API.

---

## 4. Hasil Pengujian & Verifikasi

- ✅ **Monorepo Test Suite**: 251 dari 251 test lulus (100% pass rate).
- ✅ **Sequential Flow Test**:
  - `POST /api/login` ➡️ 200 OK (`requiresOtp: true`).
  - `POST /api/otp-validation` ➡️ 200 OK (`set-cookie: authjs.session-token=...`).
  - `GET /app/generate` (dengan cookie) ➡️ 200 OK (Render `<AppWorkspace>` & `<GenerateStudio>`, tidak lagi redirect ke `/`).
  - `GET /api/customer-profile` (dengan cookie) ➡️ 200 OK (Profil user termuat lengkap).
- ✅ **Docker Deployment**: Container `api` dan `web` telah di-rebuild dan aktif melayani traffic.
