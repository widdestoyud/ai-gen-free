# ADR 0013 — Separation of Concerns: Hooks sebagai Controller di Web

**Status:** diterima  
**Tanggal:** 2026-09-06  
**Melengkapi:** [0011](./0011-mantine-ui.md), [0012](./0012-adapter-only-provider-swap.md)

## Konteks

Komponen klien di `apps/web` mencampuradukkan status (`useState`), side-effect (`useEffect`), panggilan API, navigasi, validasi, dan rendering presentasi (JSX Mantine). Hal ini menyulitkan pemeliharaan dan pengujian.

Diperlukan pemisahan tegas antara **Logic / Controller** dan **Presentation / View**, serta standarisasi kode error ber-prefix (`AXXX`, `BXXX`, `CXXX`, `DXXX`, `EXXX`, `WXXXX`) dan pelacakan `transaction_id` di seluruh endpoint.

## Keputusan

1. **Pola SoC di React Web:**
   - **Controller = Custom Hook** di `apps/web/hooks/` (misal `useLogin`, `useAdminLogin`, `useGenerate`, `useWallet`).
   - Semua state (`useState`), effect (`useEffect`), validasi, penanganan error, pemanggilan API/BFF, dan navigasi `router` **wajib** di dalam hook controller.
   - Mengapa bukan Awilix? Awilix dirancang untuk Node.js backend berbasis class constructor injection. Untuk React client, custom hook adalah pola standar resmi untuk isolasi logika presentasi tanpa overhead dependensi eksternal.
2. **Presentation / View:**
   - Halaman dan komponen di `app/` atau `components/` hanya bertindak sebagai **View**.
   - View memanggil hook controller dan me-render komponen Mantine murni berdasarkan view-model yang dikembalikan oleh controller.
   - Dilarang menulis logika bisnis, validasi, atau pemanggilan `fetch`/`requestJson` langsung di JSX view.
3. **Alur Login & OTP Modal:**
   - Halaman `/login` menangani input email dan verifikasi OTP dalam satu siklus halaman.
   - OTP ditampilkan via **Modal Mantine** (`OtpModal`), tanpa query parameter di URL (`/otp?email=...`) dan tanpa `sessionStorage`.
   - Data dikirimkan sebagai JSON body payload (`{ email, code }`).
4. **Standarisasi Kode Error:**
   - Prefix per domain:
     - `A001`–`A099`: Auth (email tidak valid, OTP salah/kedaluwarsa/terkunci, unauthenticated, forbidden, rate limited)
     - `B001`–`B099`: Generate / Job (job in progress, cooldown, poin kurang)
     - `C001`–`C099`: Wallet / Billing (invoice unpayable, proof required/invalid)
     - `D001`–`D099`: Admin (invalid parameter)
     - `E001`–`E099`: System (not ready, validation error, not found, system rate limit)
     - `W001`–`W099`: Worker terminal job error (`PROVIDER_*`)
5. **Transaction ID (`transaction_id`):**
   - Setiap respons HTTP API menyertakan `transaction_id` di payload body dan header `X-Transaction-Id`.
   - Logger server secara otomatis mengikat setiap request ke `transaction_id`.
   - Komponen `ErrorAlert` menampilkan `code` dan `transaction_id` untuk memudahkan investigasi dan pelaporan insiden.

## Alasan

- Memisahkan logika dan tampilan meningkatkan kejelasan kode dan kecepatan iterasi desain tanpa risiko merusak alur data.
- Menghindari kebocoran PII (email) di bilah alamat browser, riwayat browser, dan log referer HTTP.
- Mempercepat pelacakan bug produksi dengan identifikasi transaksi end-to-end.

## Konsekuensi

- Setiap fitur klien baru harus membuat hook controller di `apps/web/hooks/` sebelum menulis komponen view.
- URL `/otp` didegradasi dan otomatis dialihkan ke `/login`.
