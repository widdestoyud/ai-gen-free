# ADR 0017 — Arsitektur Web: Struktur Folder Views & Mapping API FE-BE

**Status:** diterima  
**Tanggal:** 2026-09-13  
**Melengkapi:** [0011](./0011-mantine-ui.md), [0013](./0013-separation-of-concerns-hooks.md), [0016](./0016-json-body-payload-only.md)

## Konteks

Sebelumnya, struktur `apps/web/` mengalami beberapa isu arsitektur dan skalabilitas:
1. **Pencemaran folder `components/`**: Komponen generic yang benar-benar reusable (seperti button, modal, alert) tercampur dengan komponen spesifik halaman / domain (seperti `generate-studio`, `admin-inbox`, `users-list`).
2. **Ambiguitas routing `app/`**: Folder `app/` memuat folder redirect ganda (seperti `/generate`, `/login`, `/otp`, `/wallet`) yang membingungkan alur navigasi.
3. **Ketiadaan kamus pemetaan API (FE ke BE)**: Endpoint yang dipanggil browser (`/api/...`) dan endpoint kanonik backend Fastify (`/customer/...`, `/admin/...`) tidak memiliki pemetaan eksplisit terpusat, menyulitkan pelacakan kontrak antar layanan.

## Keputusan

### 1. Struktur Folder Web: Pages (`app/`), Views (`views/`), dan Generic Components (`components/`)

- **`apps/web/app/` (Routing & Layouts)**:
  - Hanya berisi entry point Next.js App Router (`page.tsx`, `layout.tsx`, `route.ts`).
  - Halaman Next.js tidak menulis JSX kompleks secara langsung; halaman hanya melakukan auth check / data loading awal di server, lalu mendelegasikan rendering ke View terkait di `apps/web/views/`.
  - Routing jelas & bersih:
    - `/` (Landing page)
    - `/app/generate` (Studio generator)
    - `/app/library` (Galeri seluruh hasil render yang sudah selesai)
    - `/app/profile` (Profil pengguna)
    - `/app/usage` (Riwayat penggunaan & kuota)
    - `/app/billing` (Topup koin & invoice)
    - `/jobs/[id]` (Status & preview job tertentu)
    - `/admin/**` (Portal kurasi & audit admin)
    - `/auth/**` (Verifikasi email & reset kata sandi)

- **`apps/web/views/` (Presentation Domain Views)**:
  - Setiap halaman memiliki folder view tersendiri di `apps/web/views/<halaman>/`.
  - Setiap view memiliki subfolder `components/` untuk menyimpan komponen yang **hanya digunakan secara spesifik** pada halaman tersebut:
    - `views/landing/components/` (`landing-auth.tsx`, `login-modal.tsx`, `register-modal.tsx`)
    - `views/app/generate/components/` (`generate-studio.tsx`, `generate-aspect-menu.tsx`, `generate-library-modal.tsx`)
    - `views/app/library/components/` (`library-view.tsx`, `library-view.module.css`)
    - `views/app/profile/components/` (`customer-home.tsx`)
    - `views/app/billing/components/` (`wallet-client.tsx`)
    - `views/jobs/components/` (`job-client.tsx`, `job-output.tsx`)
    - `views/auth/components/` (`email-validation-view.tsx`, `reset-password-view.tsx`)
    - `views/admin/**/components/` (`admin-login-form.tsx`, `admin-inbox.tsx`, `users-list.tsx`, `job-detail.tsx`, dll.)

- **`apps/web/components/` (Strictly Generic Reusable Primitives)**:
  - **Hanya** memuat komponen UI generic yang dipakai lintas domain/fitur (misal: `app-link.tsx`, `app-providers.tsx`, `app-workspace.tsx`, `page-shell.tsx`, `error-alert.tsx`, `wait-alert.tsx`, `empty-state.tsx`, `item-card.tsx`, `cooldown-text.tsx`, `status-text.tsx`, `otp-modal.tsx`, `logout-confirm-modal.tsx`).
  - Dilarang menaruh komponen yang terikat pada use case atau halaman tertentu di sini.

### 2. Kamus Pemetaan API FE ke BE (`apps/web/lib/api-mapping.ts`)

- Seluruh endpoint Frontend (`/api/*`) dipetakan secara eksplisit ke endpoint Backend Fastify melalui tabel `API_MAPPINGS`:
  - Format: `{ FE: '/api/library', BE: '/customer/generated-lists', method: 'GET', description: '...' }`
  - Contoh pemetaan kanonik:
    - `FE: /api/library` -> `BE: /customer/generated-lists`
    - `FE: /api/jobs/:id` -> `BE: /customer/generated/:id`
    - `FE: /api/jobs/:id/file` -> `BE: /customer/generated/:id/file`
    - `FE: /api/wallet` -> `BE: /customer/coin`
    - `FE: /api/wallet/ledger` -> `BE: /customer/coin/ledger`
    - `FE: /api/admin/users/:id/wallet/adjust` -> `BE: /admin/topup/poin/:id`
- Fungsi utilitas `resolveBackendPath(fePath, method)` digunakan oleh Next.js BFF proxy (`app/api/[...path]/route.ts`) dan Server-Side API fetcher (`lib/server-api.ts`) untuk menerjemahkan setiap request secara deterministik.
- Setiap penambahan endpoint baru wajib mendaftarkan rute pada `API_MAPPINGS` di `apps/web/lib/api-mapping.ts`.

### 3. Pemisahan Generate Studio dan Library Halaman

- Halaman `/app/generate` berfokus khusus pada input prompt, pengaturan rasio, pemilihan model, dan preview output aktif saat proses generate berjalan.
- Daftar riwayat media yang telah selesai digenerate dipusatkan di halaman `/app/library` (didukung endpoint `GET /api/library` yang diterjemahkan ke `GET /customer/generated-lists`).

## Konsekuensi

- AI Agent lain dilarang menaruh komponen spesifik halaman langsung di dalam `apps/web/components/`.
- Komponen baru untuk halaman tertentu wajib dibuat di dalam `apps/web/views/<halaman>/components/`.
- Penambahan atau perubahan endpoint API di frontend wajib memperbarui `API_MAPPINGS` di `apps/web/lib/api-mapping.ts` dan tes terkait `apps/web/lib/api-mapping.test.ts`.