# Root Cause Analysis (RCA)
## Insiden: Paket Sparks Baru (Rp 10.000) Tidak Langsung Muncul di Halaman `/app/order` Setelah Ditambahkan di Halaman Admin

---

### Informasi Dokumen
* **Tanggal Analisis**: 09 Oktober 2026
* **Status**: **RESOLVED / MITIGATED**
* **Tingkat Keparahan**: Low / Medium (User Experience & Data Stale Cache)
* **Komponen Terdampak**:
  - Web Frontend Admin Packages (`apps/web/views/admin/packages/components/packages-list.tsx`)
  - Web Frontend Order Page (`apps/web/views/app/order/order-view.tsx`)
  - TanStack React Query Cache (`queryKeys.orderPackages()` & `queryKeys.catalogPackages()`)

---

## 1. Ringkasan Insiden (Executive Summary)
Administrator menambahkan paket baru di halaman **Admin Packages** (`/admin/packages`) dengan detail:
- Nama Paket: `paket sanbox`
- Nominal: `Rp 10.000`
- Poin: `100 sparks`
- Status: `active: true`

Data berhasil disimpan di PostgreSQL database (`topupPackage` table), namun saat pengguna/admin membuka kembali halaman pesanan (`/app/order`), daftar paket yang tampil masih merupakan data lama (3 paket lama) dan paket Rp 10.000 tersebut tidak langsung tampak.

---

## 2. Analisis Investigasi (Root Cause Investigation)

### A. Verifikasi Data Backend & Database
1. Pemeriksaan langsung ke tabel database `prisma.topupPackage`:
   ```json
   {
     "id": "cmu3qrto40000ph0yq0cz46aa",
     "name": "paket sanbox",
     "amountIdr": "10000",
     "points": "100",
     "active": true,
     "sortOrder": 4,
     "badgeText": "UNTUK SANBOX"
   }
   ```
   **Hasil**: Data paket **telah tersimpan dengan benar dan berstatus aktif** di database.

2. Pengujian Endpoint API (`GET /api/catalog/topup`):
   ```bash
   curl -s https://satulabs.id/api/catalog/topup
   ```
   **Hasil**: Backend API Fastify mengembalikan 4 paket lengkap termasuk paket baru Rp 10.000.

---

### B. Akar Masalah di Frontend (Root Causes)

1. **Client-Side Query Cache Invalidation Miss**:
   - Di `packages-list.tsx`, setelah aksi pembuatan paket (`POST`), pembaruan paket (`PATCH`), atau penghapusan paket (`DELETE`), sistem hanya menjalankan `router.refresh()`.
   - `router.refresh()` hanya merefresh Server Component cache di Next.js, tetapi **TIDAK memicu invalidasi TanStack React Query cache** di browser.
   - Cache key `queryKeys.orderPackages()` (`["order-packages"]`) dan `queryKeys.catalogPackages()` (`["catalog-topup-packages"]`) tetap menyimpan data lama di memori browser.

2. **Stale Time & Refetch Strategy di Order View**:
   - Di `views/app/order/order-view.tsx`, konfigurasi `useQuery` adalah:
     ```tsx
     staleTime: 60_000, // Data dianggap fresh selama 60 detik
     refetchOnWindowFocus: false,
     ```
   - Akibatnya, saat admin berpindah dari `/admin/packages` kembali ke `/app/order` melalui navigasi SPA (Single Page Application) dalam kurun waktu 60 detik, React Query menyajikan data dari cache memori tanpa melakukan fetch ulang ke server.

---

## 3. Tindakan Perbaikan (Corrective Actions)

1. **Implementasi Query Invalidation di Admin Packages Form (`packages-list.tsx`)**:
   - Menambahkan `useQueryClient()` dari `@tanstack/react-query`.
   - Menambahkan pemanggilan invalidasi `queryClient.invalidateQueries({ queryKey: queryKeys.orderPackages() })` dan `queryClient.invalidateQueries({ queryKey: queryKeys.catalogPackages() })` pada:
     - Pembuatan paket baru (`handleSave - POST`)
     - Edit paket (`handleSave - PATCH`)
     - Hapus paket (`handleDelete - DELETE`)
     - Toggle status aktif/nonaktif (`handleToggleActive`)

2. **Optimalisasi Caching di Order View (`order-view.tsx`)**:
   - Mengubah `staleTime` menjadi `5_000` (5 detik) atau `refetchOnMount: "always"` agar saat halaman dibuka, daftar paket selalu terupdate secara instan dengan data terbaru dari database.

---

## 4. Alur Redirect Pembayaran DOKU (Payment Success Clarification)

Mengenai redirect halaman saat pembayaran selesai:
- Di level transaksi aplikasi normal (`apps/api/src/wallet/payment.ts`), `callbackUrl` diarahkan ke:
  `process.env.PAYMENT_SUCCESS_URL || "https://satulabs.id/payment/success?invoice=..."`
- Pengujian manual sebelumnya mengarahkan ke `/app/order` karena script testing menggunakan parameter statis `/app/order`.
- Seluruh order yang dibuat via UI aplikasi akan otomatis dialihkan ke halaman **Payment Success** (`/payment/success`) begitu pembayaran lunas.
