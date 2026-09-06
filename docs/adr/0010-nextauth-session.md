# ADR 0010 — Cookie sesi browser lewat NextAuth (Auth.js)

**Status:** diterima  
**Tanggal:** 2026-09-05

## Konteks

Login v1 adalah email + OTP. `apps/api` sudah punya challenge OTP, hash sesi di Postgres, dan cabut sesi lama (ADR 0003, ADR 0006). UI semula meneruskan cookie `sid` / `sid_admin` yang di-set Fastify lewat BFF.

Keputusan produk: jika login butuh cookie atau session di browser, pakai **NextAuth / Auth.js v5** (`next-auth@beta` sampai v5 stabil), bukan cookie custom yang di-set langsung dari form UI.

## Keputusan

- Cookie httpOnly yang dilihat browser untuk sesi web = **NextAuth / Auth.js** di `apps/web`.
- Identity tetap di `apps/api`: OTP, hash token, satu sesi per `kind`, role, ban. Bukan Firebase (ADR 0006 tetap).
- Next.js **tidak** memakai PrismaAdapter, **tidak** menulis tabel `Session` sendiri, **tidak** memotong poin.
- Credentials provider memanggil HTTP API (`/api/auth/otp/verify` atau `/api/admin/auth/otp/verify`). JWT NextAuth menyimpan `sid` (token sesi API) supaya BFF/RSC bisa mengirim `Cookie: sid=…` ke Fastify.
- Strategi sesi NextAuth: JWT. Bukan database session Auth.js.
- Path handler user: `/api/session/*` (`basePath` bukan `/api/auth`, agar proxy OTP Fastify tetap hidup).
- Path handler admin: `/api/admin/session/*` (tetap di belakang Basic Auth, ADR admin).
- `AUTH_SECRET` wajib. Boleh sama nilainya dengan `SESSION_SECRET` di dev.

## Bukan keputusan ini

- Mengganti OTP 6 digit dengan OAuth Google/GitHub.
- Memindahkan ledger/job ke Next.js.
- Multi-device session.

## Alasan

- Satu cara baku mengelola cookie sesi di App Router (csrf, `auth()`, `signIn`/`signOut`).
- API tetap sumber kebenaran sesi; login perangkat kedua tetap mencabut baris `sessions` (ADR 0003).
- UI tidak menyimpan JWT di `localStorage`.

## Konsekuensi

- Form login UI memanggil NextAuth, bukan `Set-Cookie` Fastify sebagai cookie utama browser.
- Tes yang hit Fastify langsung boleh tetap memakai cookie `sid`.
- Agen FE baru wajib ikut pola ini; jangan menambah cookie sesi ketiga.
