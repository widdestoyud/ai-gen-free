# Root Cause Analysis (RCA)
## Bug: Progress Tracking Image Upscale Tidak Muncul di `/app/generate`

**Tanggal**: 5 Oktober 2026  
**Status**: Resolved  
**Severity**: Medium (UX / Realtime Feedback Inconsistency)  
**Komponen**: Web Frontend (`MediaDetailModal`, `useGenerateStudio`, React Query Cache)  

---

### 1. Deskripsi Masalah (Problem Statement)
Ketika pengguna memilih tindakan **"Mulai Upscale" (4x Upscale)** dari `MediaDetailModal` di halaman perpustakaan media (`/app/library`), sistem berhasil memotong poin/kredit dan membuat pekerjaan AI baru via `POST /api/generate`. Namun setelah pengguna diarahkan ke `/app/generate`, halaman Generate Studio tidak menampilkan animasi skeleton / live progress upscale yang sedang berlangsung. Pengguna harus menunggu tanpa feedback visual yang jelas hingga gambar selesai dibuat.

---

### 2. Analisis Akar Masalah (Root Cause Analysis - 5 Whys)

1. **Mengapa progress upscale tidak muncul di `/app/generate`?**
   - Komponen `GenerateStudio` hanya menampilkan progress skeleton jika state `isGenerating` aktif (`Boolean(activeJobId) || Boolean(active)` bernilai `true`). Saat berpindah halaman, `activeJobId` bernilai `null` dan `active` bernilai `null`.

2. **Mengapa `activeJobId` dan `activeJob` bernilai `null` saat membuka `/app/generate`?**
   - State awal `activeJob` mengandalkan daftar pekerjaan dari `jobsQuery` (`/api/generate`). Ketika query dieksekusi, React Query mengembalikan data dari cache lokal (stale cache) yang belum memuat job upscale yang baru saja dibuat.

3. **Mengapa React Query mengembalikan cache lama dan tidak memicu refetch pekerjaan terbaru?**
   - Konfigurasi `jobsQuery` di `useGenerateStudio` memiliki `staleTime: 1000 * 60 * 5` (5 menit) dan tidak memiliki `refetchOnMount: "always"`. Selain itu, saat berpindah dari `MediaDetailModal` ke `/app/generate`, query cache `["generated-jobs"]` tidak di-invalidate secara eksplisit.

4. **Mengapa `MediaDetailModal` tidak menginformasikan `jobId` hasil pembuatan ke halaman tujuan?**
   - Handler `handleUpscale` hanya memanggil `router.push("/app/generate")` tanpa menyertakan `jobId` (misalnya `/app/generate?jobId=${newJobId}`). Akibatnya, `useGenerateStudio` tidak mengetahui adanya job aktif pada initial render sebelum network request selesai.

5. **Akar Masalah Utama (Root Cause):**
   - **Ketidakselarasan Cache & Navigasi Antarmuka**: Trigger asynchronous job yang diinisiasi di luar Generate Studio (`MediaDetailModal`) tidak melakukan invalidasi cache React Query (`["generated-jobs"]`, `["library-items"]`, `["wallet"]`), tidak meneruskan parameter identifikasi job (`jobId`) saat routing navigasi, dan `useGenerateStudio` menggunakan `staleTime` yang terlalu panjang tanpa instant state synchronization.

---

### 3. Solusi & Perbaikan yang Diterapkan (Corrective Actions)

1. **Sinkronisasi Navigasi & Invalidasi Cache pada [`MediaDetailModal`](file:///home/ubuntu/projects/ai-gen-free/apps/web/views/app/library/components/media-detail-modal.tsx)**:
   - Menambahkan `useQueryClient()` dari `@tanstack/react-query`.
   - Melakukan invalidasi query `["generated-jobs"]`, `["library-items"]`, dan `["wallet"]` segera setelah API `POST /api/generate` merespons sukses.
   - Melakukan navigasi dengan menyertakan parameter `jobId`: `router.push("/app/generate?jobId=${encodeURIComponent(newJobId)}")`.

2. **Deteksi Instan & Fresh Polling pada [`useGenerateStudio`](file:///home/ubuntu/projects/ai-gen-free/apps/web/hooks/use-generate-studio.ts)**:
   - Membaca `urlJobId` dari `useSearchParams().get("jobId")`.
   - Menginisialisasi `activeJobId` dan `activeJob` secara instan sejak initial render.
   - Membersihkan query string `jobId` dari URL setelah state diinisiasi menggunakan `window.history.replaceState`.
   - Mengubah konfigurasi `jobsQuery` menjadi `staleTime: 0` dan `refetchOnMount: "always"`.
   - Menjalankan `checkJobFallback()` pada awal inisiasi SSE agar data detail job langsung terisi sebelum payload streaming pertama tiba.

3. **Suspense Boundary Support pada [`page.tsx`](file:///home/ubuntu/projects/ai-gen-free/apps/web/app/app/generate/page.tsx)**:
   - Memastikan `useSearchParams()` berada di dalam `<Suspense fallback={null}>` sesuai standar Next.js App Router.

---

### 4. Pencegahan Masalah Serupa (Preventative Measures & Steering Rules)
- Semua aksi asynchronous generation / upscale yang diinisiasi dari luar view utama studio wajib menginvalidasi cache query global terkait dan meneruskan `jobId` jika melakukan redirect.
- Controller halaman studio (`useGenerateStudio`) harus selalu menyelaraskan active state dari parameter routing dan SSE streaming.
