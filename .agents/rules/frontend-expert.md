# Frontend & Next.js Expert Rules (`apps/web`)

Aturan ini berlaku mutlak saat mengedit atau menambahkan fitur di `apps/web`.

## 1. Separation of Concerns (ADR 0013 & ADR 0017)
- **Controller = Custom Hook** di `apps/web/hooks/`: semua state, side effects, API fetchers (`requestJson`), form validation, timers, dan router navigation wajib ada di hook controller.
- **Entry point routing** di `apps/web/app/`: tipis, mendelegasikan view ke `apps/web/views/<halaman>/`.
- **Domain presentation** di `apps/web/views/<halaman>/`: komponen yang spesifik halaman tersebut ditaruh di `views/<halaman>/components/`.
- **Generic UI primitives** HANYA di `apps/web/components/`: `app-link.tsx`, `page-shell.tsx`, `error-alert.tsx`, `empty-state.tsx`, `item-card.tsx`, `otp-modal.tsx`, `logout-confirm-modal.tsx`. Dilarang menaruh komponen spesifik domain di sini.

## 2. API Mapping & BFF Proxy (ADR 0017)
- Seluruh pemanggilan API dari browser menggunakan same-origin `/api/*`.
- Semua endpoint frontend WAJIB terdaftar di `apps/web/lib/api-mapping.ts` (`API_MAPPINGS` & `resolveBackendPath`) dan didukung unit test di `apps/web/lib/api-mapping.test.ts`.
- Dilarang memanggil URL backend Fastify secara langsung dari browser (`NEXT_PUBLIC_API_URL` tidak boleh dipakai di client).

## 3. Payload Mutasi (ADR 0016)
- Seluruh request `POST`, `PATCH`, `PUT` WAJIB mengirim payload di JSON body.
- Dilarang mengirim token, email, password, atau OTP lewat URL query string.

## 4. UI Mantine 8 (ADR 0011)
- Dilarang keras menggunakan `style={{ ... }}`.
- Gunakan style props Mantine (`p`, `m`, `c`, `bg`, `w`, `fz`, dll.) atau CSS classes. Default tema dark.

## 5. Keamanan & Sesi
- Jangan import `next-auth` langsung di page/komponen. Gunakan `lib/auth-actions.ts` & `lib/server-api.ts`.
- Jangan menyimpan token atau JWT di `localStorage` / `sessionStorage`.
- Jangan impor Prisma, BullMQ, atau Siray SDK di `apps/web`.
