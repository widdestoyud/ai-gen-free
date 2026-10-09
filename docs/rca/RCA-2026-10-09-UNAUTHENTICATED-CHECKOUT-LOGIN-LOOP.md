# Root Cause Analysis (RCA) & Knowledge Base: Unauthenticated Checkout Login Loop & Manual QRIS Modal

- **Incident Date**: 2026-10-09
- **Severity**: Critical (P1) - Conversion Blocker
- **Components Affected**: `apps/web/views/checkout/checkout-view.tsx`, `apps/web/hooks/use-login.ts`, `apps/web/hooks/use-logout-confirm.ts`
- **Resolution Status**: Resolved & Deployed

---

## 1. Ringkasan Eksekutif (Executive Summary)

Pengguna yang belum masuk (*unauthenticated / non-login*) memilih paket dari landing page (`/#pricing`) dan diarahkan ke halaman checkout (`/checkout?packageId=...`). Ketika menekan tombol **"Bayar"**, sistem menampilkan modal login. Namun, setelah pengguna berhasil menginput email dan password (atau login via Google) dan modal login tertutup:
1. Tombol **"Bayar"** ditekan kembali, namun modal login justru muncul lagi secara berulang (*infinite login prompt loop*).
2. Menekan tombol *Back* browser ataupun navigasi antar halaman tetap memunculkan modal login saat mencoba bayar, kecuali pengguna melakukan logout, clear cache browser (*cache buster*), lalu login sejak awal dari landing page sebelum checkout.
3. Selain itu, untuk metode pembayaran **Manual Transfer (QRIS)**, alur checkout sebelumnya salah mengarahkan pengguna ke `/app/order` alih-alih membuka popup modal QRIS di tempat.

---

## 2. Akar Masalah (Root Cause Analysis)

### Masalah 1: TanStack React Query Cache Invalidation & Stale Time
- **Kondisi Awal**: Pada saat halaman `/checkout` dimuat oleh pengunjung non-login, query `queryKeys.customerProfile()` dieksekusi dan menerima respons `{ user: null }` (atau `{}`).
- **Penyebab Utama**: Query `customerProfile` diatur dengan `staleTime: 1000 * 60 * 5` (5 menit).
- **Mekanisme Bug**:
  - Hook `useLogin` menjalankan autentikasi via `POST /api/login` yang berhasil membuat cookie sesi `authjs.session-token`.
  - Setelah login berhasil, `useLogin` hanya memanggil `router.push(defaultRedirect)` (yang bernilai `/checkout?...`, yaitu halaman yang sama sehingga Next.js tidak me-reload client state) dan `router.refresh()` (hanya me-refresh RSC Server Component, **bukan** client query cache).
  - Hook `useLogin` **tidak pernah memanggil** `queryClient.invalidateQueries()`.
  - Akibatnya, `profileData` di `CheckoutView` tetap menyimpan data lama `{}` dari memori cache React Query selama 5 menit.
  - State `isAuthenticated = Boolean(profileData?.user?.email || profileData?.user?.name)` tetap bernilai `false`.
  - Saat pengguna menekan tombol "Bayar" lagi, pengecekan `if (!isAuthenticated)` kembali memicu `login.openLogin()`.

### Masalah 2: Hilangnya Auto-Resume Payment Pasca Login
- Pengguna yang berniat melakukan pembayaran mengharapkan alur pembayaran langsung dilanjutkan begitu proses login berhasil, tanpa harus menebak apakah login mereka sudah tersimpan atau menekan tombol berulang kali.

### Masalah 3: Alur Manual Payment Mengabaikan Modal QRIS yang Sudah Ada
- Pada `CheckoutView`, komponen modal QRIS (`<Modal opened={Boolean(manualInvoice)} ...>`) sudah tersedia lengkap dengan barcode QRIS dan form unggah bukti transfer.
- Namun pada implementasi `handlePay()`, bagian `selectedMethod === "manual"` justru mengeksekusi `router.push("/app/order")` dan mengabaikan state `setManualInvoice`, sehingga pengguna diarahkan keluar halaman tanpa sempat melihat barcode QRIS untuk transfer.

---

## 3. Tindakan Perbaikan (Fixing Implementation)

1. **Sinkronisasi React Query pada `useLogin` (`apps/web/hooks/use-login.ts`)**:
   - Menambahkan dependency `useQueryClient`.
   - Menjalankan invalidasi query auth secara menyeluruh (`customerProfile`, `wallet`, `orderInvoices`, `billingLedger`, `userStatus`) saat `submitLogin` maupun `verifyCode` (OTP) berhasil.
   - Menambahkan callback `options.onSuccess` agar komponen pemanggil dapat menangkap event sukses login secara reaktif.

2. **Pembersihan Cache Global pada `useLogoutConfirm` (`apps/web/hooks/use-logout-confirm.ts`)**:
   - Menjalankan `queryClient.clear()` saat pengguna melakukan logout untuk memastikan tidak ada sisa cache profil lama yang tertinggal.

3. **Optimasi Alur Checkout (`apps/web/views/checkout/checkout-view.tsx`)**:
   - Mengatur `staleTime: 0` dan `refetchOnMount: "always"` untuk query `customerProfile` di halaman checkout.
   - Menambahkan ref `pendingPayRef` untuk mendeteksi intensi bayar sebelum login. Begitu login sukses via modal atau OTP, sistem secara otomatis mengeksekusi invoice & payment.
   - **Online Payment**: Membuat invoice dan langsung melakukan pengalihan (`window.location.href`) ke halaman payment gateway (DOKU, DANA, Xendit, atau Snap popup).
   - **Manual Payment (QRIS)**: Membuat invoice dan langsung membuka modal QRIS (`setManualInvoice(...)`) di halaman checkout dengan barcode QRIS, rincian nominal, kode unik, dan input unggah bukti transfer.

---

## 4. Knowledge Base & Pencegahan di Masa Depan (Preventative Guidelines)

1. **Setiap Mutasi Status Sesi (Login, Register, Logout) Wajib Menginvaliasi Cache Klien**:
   - Jangan hanya mengandalkan `router.push()` atau `router.refresh()`. Perubahan state autentikasi cookie di Next.js App Router tidak otomatis memperbarui cache in-memory TanStack React Query.
   - Gunakan `queryClient.invalidateQueries()` atau `queryClient.clear()` di seluruh hook otentikasi.

2. **Atur `staleTime: 0` pada Query yang Menentukan Hak Akses / Gatekeeper**:
   - Untuk endpoint yang bersifat gatekeeper seperti `/api/customer-profile`, `/api/me`, dan `/api/wallet`, jangan berikan `staleTime` menit yang panjang pada halaman transaksi krusial (seperti Checkout dan Billing).

3. **Verifikasi Jalur State UI (Branching Coverage)**:
   - Pastikan setiap state modal yang sudah dibuat (seperti modal QRIS) terhubung dengan state setter-nya pada fungsi handler transaksi, bukan di-*bypass* oleh router push prematur.
