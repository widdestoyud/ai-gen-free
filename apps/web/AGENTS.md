# apps/web

Baca root `AGENTS.md` dan ADR 0010, 0011, 0012, 0013, 0016, 0017.

## Separation of Concerns (SoC) — Hook sebagai Controller (ADR 0013) & Struktur Views (ADR 0017)

- **Controller = Custom Hook** di `hooks/` (misal: `useLogin`, `useAdminLogin`, `useGenerateStudio`, `useLibrary`, `useWallet`).
  - Semua state (`useState`), side effects (`useEffect`), timer/interval, API requests (`requestJson`), validasi form, dan navigasi `router` **harus** berada di dalam custom hook controller.
  - Hook controller mengembalikan view-model dan action handlers yang siap dikonsumsi oleh view.
- **Routing = Entry Point di `app/`**:
  - Halaman Next.js App Router (`apps/web/app/`) bertindak sebagai router dan server-side auth/data loader sederhana.
  - Halaman `app/` mendelegasikan rendering presentasi ke folder `views/`.
- **Presentation / View = Domain View di `views/<halaman>/`**:
  - Setiap halaman memiliki modul view tersendiri di `apps/web/views/<halaman>/` (misal: `views/landing/`, `views/app/generate/`, `views/app/library/`, `views/app/profile/`, `views/app/billing/`, `views/jobs/`, `views/admin/`, `views/auth/`).
  - Komponen yang spesifik hanya untuk satu halaman **wajib** ditaruh di subfolder `views/<halaman>/components/` (misal: `views/landing/components/`, `views/app/generate/components/`, `views/admin/users/components/`).
  - Tidak ada `fetch`, `requestJson`, atau mutasi state kompleks langsung di komponen presentasi.
- **Generic UI Primitives = `apps/web/components/`**:
  - Folder `components/` **hanya** untuk komponen UI generic reusable lintas halaman (misal: `app-link.tsx`, `page-shell.tsx`, `error-alert.tsx`, `empty-state.tsx`, `item-card.tsx`, `otp-modal.tsx`, `logout-confirm-modal.tsx`).
  - Dilarang menaruh komponen spesifik domain/fitur di root `components/`.
- **Kamus API Mapping (`lib/api-mapping.ts`)**:
  - Seluruh endpoint Frontend (`/api/*`) dipetakan ke Backend kanonik Fastify (`/customer/...`, `/admin/...`, dll.) lewat kamus `API_MAPPINGS`.
  - Penambahan endpoint baru di frontend wajib dicatat pada `API_MAPPINGS` dan didukung unit test di `lib/api-mapping.test.ts`.
- **Login & OTP Flow**:
  - Landing `/` menampilkan CTA Masuk/Daftar. Modal login **tidak** dibuka otomatis.
  - Setelah login sukses → `/app/generate`. Area pelanggan memakai AppShell sidebar: Generate, Library, Profile, Usage, Billing, Logout.
  - `/app/generate`: berfokus pada studio input prompt, rasio, model generator, dan hasil aktif. Riwayat hasil yang telah selesai dipindahkan ke `/app/library`.
  - OTP muncul sebagai **Modal** di landing setelah login perangkat baru (`requiresOtp`).
  - Admin: HTTP Basic (bukan publik) + form username/password di `/admin`. **Tanpa OTP**.
  - Dilarang mengirim email lewat URL query params (`/otp?email=...`) atau menyimpan email/OTP di `sessionStorage` / `localStorage`.
  - Seluruh payload dikirimkan sebagai JSON request body.
- **Payload hanya body (ADR 0016):**
  - Browser/`requestJson` tidak boleh menaruh `email`, `token`, `code`, `password`, atau field aksi lain di query string.
  - Verifikasi email dan reset password: halaman FE boleh baca `?token=` dari tautan email, lalu `POST` JSON `{ token }` (dan `{ token, password }` untuk konfirmasi) ke BFF. Jangan `GET /api/auth/...?token=`.
- **Error Codes & Tracking**:
  - Tampilkan `code` ber-prefix (`AXXX`, `BXXX`, dll.) dan `transaction_id` pada `ErrorAlert` untuk memudahkan logging dan penelusuran masalah.

## Wajib

- Mantine 8 (`@mantine/core`). Default dark. Bukan Mantine 9 (butuh React `Activity`).
- Tidak ada `style={{ … }}`.
- Komponen reusable: `components/page-shell.tsx`, `item-card.tsx`, `error-alert.tsx`, `app-link.tsx`, `otp-modal.tsx`. Tambah komponen hanya jika pola belum ada.
- Helper: `lib/api.ts`, `lib/api-mapping.ts`, `lib/format.ts`, `lib/server-api.ts`, `lib/job-status.ts`.
- Sesi: halaman dan `components/` hanya `lib/auth-actions.ts` + `lib/server-api.ts`. **Jangan** `import from "next-auth"` di page/layout/komponen.
- Adapter sesi (boleh diganti tanpa ubah flow): `auth.ts`, `auth-admin.ts`, `lib/create-auth.ts`, `app/api/session/**`, `app/api/admin/session/**`.
- Browser hanya `fetch('/api/...')` same-origin. BFF `app/api/[...path]` mem-proxy ke Fastify menggunakan pemetaan `resolveBackendPath`. Jangan `NEXT_PUBLIC_API_URL` ke host BE.
- Ganti R2/SMTP/Siray **tidak** boleh mengubah komponen atau layout (ADR 0012).

## Dilarang

- Menaruh komponen spesifik domain/halaman di `apps/web/components/`.
- Memanggil endpoint `/api/*` tanpa mendaftarkannya di `apps/web/lib/api-mapping.ts`.
- Prisma, BullMQ, SDK Siray, PrismaAdapter NextAuth
- JWT di `localStorage`
- Percaya `cost` / `role` / `points` dari form sebagai otoritas
- `POST` yang menunggu hasil generate
