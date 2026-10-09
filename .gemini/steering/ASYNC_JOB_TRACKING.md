# Steering Rule: Asynchronous Job Lifecycle & Cross-View Synchronization

## Prinsip Utama
1. **Invalidasi Cache Saat Inisiasi Job**:
   Setiap kali memicu job komputasi AI (Text-to-Image, Image-to-Image, Upscale, Video, dsb.) di luar studio generate (misalnya dari modal perpustakaan/detail media), selalu panggil `queryClient.invalidateQueries` untuk:
   - `["generated-jobs"]`
   - `["library-items"]`
   - `["wallet"]`

2. **Navigasi dengan Identitas Pekerjaan**:
   Ketika berpindah ke studio generate (`/app/generate`) setelah pembuatan job baru, teruskan parameter `jobId` di URL:
   `/app/generate?jobId=${encodeURIComponent(jobId)}`

3. **Fresh Mount & Active Tracking di Generate Studio**:
   - `useGenerateStudio` membaca `jobId` dari `useSearchParams` untuk langsung menampilkan state proses (skeleton & wave animation).
   - Gunakan `staleTime: 0` dan `refetchOnMount: "always"` untuk daftar pekerjaan agar status sinkron dengan server.
   - Sambungkan koneksi Server-Sent Events (SSE) `/api/generate/:id/events` untuk progress realtime (0-100%).
