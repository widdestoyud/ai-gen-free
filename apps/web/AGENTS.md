# apps/web

Baca root `AGENTS.md` dan ADR 0010, 0011, 0012, 0013.

## Separation of Concerns (SoC) — Hook sebagai Controller (ADR 0013)

- **Controller = Custom Hook** di `hooks/` (misal: `useLogin`, `useAdminLogin`, `useGenerate`, `useWallet`).
  - Semua state (`useState`), side effects (`useEffect`), timer/interval, API requests (`requestJson`), validasi form, dan navigasi `router` **harus** berada di dalam custom hook controller.
  - Hook controller mengembalikan view-model dan action handlers yang siap dikonsumsi oleh view.
- **Presentation / View = Component / Page**:
  - Halaman di `app/` atau `components/` hanya bertanggung jawab me-render UI Mantine.
  - Tidak ada `fetch`, `requestJson`, atau mutasi state kompleks langsung di komponen presentasi.
- **Login & OTP Flow**:
  - Landing `/` menampilkan CTA Masuk/Daftar. Modal login **tidak** dibuka otomatis.
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
- Helper: `lib/api.ts`, `lib/format.ts`, `lib/server-api.ts`, `lib/job-status.ts`.
- Sesi: halaman dan `components/` hanya `lib/auth-actions.ts` + `lib/server-api.ts`. **Jangan** `import from "next-auth"` di page/layout/komponen.
- Adapter sesi (boleh diganti tanpa ubah flow): `auth.ts`, `auth-admin.ts`, `lib/create-auth.ts`, `app/api/session/**`, `app/api/admin/session/**`.
- Alias BFF pelanggan: `/api/login`, `/api/register`, `/api/otp-request`, `/api/otp-validation`, `/api/customer-profile`, `/api/logout`, `/api/email-validation`, `/api/reset-password`, `/api/reset-password-validation`, `/api/reset-password-confirm`. Admin login: `/api/admin/login`.
- Browser hanya `fetch('/api/...')` same-origin. BFF `app/api/[...path]` mem-proxy ke Fastify. Jangan `NEXT_PUBLIC_API_URL` ke host BE.
- Ganti R2/SMTP/Siray **tidak** boleh mengubah komponen atau layout (ADR 0012).

## Dilarang

- Prisma, BullMQ, SDK Siray, PrismaAdapter NextAuth
- JWT di `localStorage`
- Percaya `cost` / `role` / `points` dari form sebagai otoritas
- `POST` yang menunggu hasil generate
