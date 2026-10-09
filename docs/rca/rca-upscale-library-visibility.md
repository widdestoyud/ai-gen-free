# Root Cause Analysis (RCA): Hasil Image Upscale Tidak Muncul pada Halaman Library (`/app/library`)

**Incident ID**: RCA-20261006-UPSCALE-LIBRARY-VISIBILITY  
**Tanggal**: 6 Oktober 2026  
**Status**: Resolved  
**Severity**: Medium (Data Consistency & Real-time UI Visibility)  
**Komponen Terdampak**:
- Frontend: `apps/web/hooks/use-generate-studio.ts`, `apps/web/hooks/use-library.ts`
- Backend API: `apps/api/src/jobs/service.ts` (`listCustomerLibrary`)

---

## 1. Deskripsi Masalah (Problem Statement)

Ketika pengguna berhasil menjalankan proses **Image Upscale (4x Upscale)** hingga status pekerjaan menjadi `succeeded` dan aset gambar beresolusi tinggi tersimpan di Object Storage (`outputs/...`), hasil gambar upscale tidak muncul pada antarmuka `/app/library` (Customer Library View). Pengguna yang berpindah dari `/app/generate` kembali ke `/app/library` melihat daftar media yang belum diperbarui dan tidak memuat hasil upscale yang baru saja selesai.

---

## 2. Analisis Akar Masalah (Root Cause Analysis - 5 Whys)

### 2.1 Kronologi & Investigasi Alur Kerja (Workflow Breakdown)
1. Pengguna membuka modal detail media (`MediaDetailModal`) pada `/app/library` dan menekan tombol **"Mulai Upscale" (4x Upscale)**.
2. Sistem membuat job upscale baru via `POST /api/generate` (`modelId: "image-upscale"`, `mode: "i2i"`, `prompt: ""`, `params: { image: "...", upscale_mode: "factor", upscale_factor: 4.0 }`).
3. Pengguna diarahkan ke `/app/generate?jobId=...` untuk melihat live progress skeleton.
4. Worker berhasil memproses gambar via Fal.ai API, mengunggah aset hasil (`image/webp`) ke Object Storage, mencatat `JobAsset` jenis `kind: "output"`, dan memperbarui status job menjadi `succeeded`.
5. Frontend di `/app/generate` (`useGenerateStudio`) menerima notifikasi keberhasilan job via Server-Sent Events (SSE) `/api/generate/:id/events`.
6. Pengguna kembali/membuka halaman `/app/library`, namun gambar hasil upscale tidak terlihat di daftar media.

### 2.2 Analisis Faktor Penyebab (Contributing Factors)

1. **Missing Query Invalidation pada Controller Generate Studio (`apps/web/hooks/use-generate-studio.ts`)**:
   - Ketika job generasi / upscale selesai dengan status `succeeded`, hook `useGenerateStudio` hanya melakukan invalidasi query cache untuk `["generated-jobs"]` dan `["wallet"]`:
     ```typescript
     void queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });
     void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
     // KEKURANGAN: queryKeys.library() TIDAK di-invalidate saat job selesai
     ```
   - Akibatnya, query cache perpustakaan media (`["library", ...]`) tetap dianggap valid oleh React Query meskipun ada aset media baru yang telah siap.

2. **Konfigurasi Cache Terlalu Agresif pada Hook Library (`apps/web/hooks/use-library.ts`)**:
   - Hook `useLibrary` mengonfigurasi React Query dengan:
     ```typescript
     staleTime: 1000 * 60 * 5, // 5 menit
     refetchOnMount: false,
     refetchOnWindowFocus: false,
     ```
   - Ketika pengguna berpindah halaman dari `/app/generate` ke `/app/library`, React Query menyajikan snapshot cache lama (yang dibuat sebelum job selesai) tanpa melakukan network request ulang ke backend.

3. **Celah Pencarian Search Filter pada Backend (`apps/api/src/jobs/service.ts`)**:
   - Pada endpoint `GET /customer/library`, filter pencarian query (`q=...`) hanya membandingkan string pencarian dengan `alias`, `prompt`, dan `id`:
     ```typescript
     const aliasMatch = item.alias?.toLowerCase().includes(search) ?? false;
     const promptMatch = item.prompt?.toLowerCase().includes(search) ?? false;
     const idMatch = item.id.toLowerCase().includes(search);
     ```
   - Pekerjaan upscale dibuat dengan `prompt: ""` (kosong) dan `alias: null`.
   - Jika pengguna mencari dengan kata kunci "upscale", model ID, atau tag gambar referensi, hasil upscale tereliminasi oleh filter backend.

---

## 3. Tindakan Perbaikan (Corrective Actions Implemented)

### 3.1 Invalidasi Query Library Otomatis saat Job Selesai ([`use-generate-studio.ts`](file:///home/ubuntu/projects/ai-gen-free/apps/web/hooks/use-generate-studio.ts))
Menambahkan invalidasi `queryKeys.library()` pada saat status job bertransisi ke `succeeded`:
```typescript
if (data.status === "succeeded") {
  if (hasLiveOutput(data.output)) {
    setLastGeneratedJob(data);
  }
  setCooldownUntil(data.nextGenerateAt ?? null);
  setActiveJobId(null);
  setActiveJob(null);
  setJobs((prev) => [data, ...prev.filter((j) => j.id !== data.id)]);
  void queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.library() }); // <-- Ditambahkan
  void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
}
```

### 3.2 Pembaruan Kebijakan Cache & Refetch on Mount ([`use-library.ts`](file:///home/ubuntu/projects/ai-gen-free/apps/web/hooks/use-library.ts))
Mengubah konfigurasi cache `useQuery` di `useLibrary` agar selalu mengambil data segar ketika pengguna berpindah atau memfokuskan kembali antarmuka:
```typescript
staleTime: 1000 * 10, // 10 detik fresh window
gcTime: 1000 * 60 * 60 * 24, // 24 jam retention
refetchOnMount: true, // Otomatis refresh saat halaman dibuka
refetchOnWindowFocus: true, // Otomatis refresh saat window aktif kembali
```

### 3.3 Peningkatan Search Matching di Backend API ([`apps/api/src/jobs/service.ts`](file:///home/ubuntu/projects/ai-gen-free/apps/api/src/jobs/service.ts))
Menambahkan pencocokan `model_id` dan deteksi keyword "upscale" pada backend library search filtering:
```typescript
const modelMatch = item.model_id?.toLowerCase().includes(search) ?? false;
const isUpscale =
  item.model_id?.toLowerCase().includes("upscale") ||
  Boolean(item.params && (item.params.upscale_mode !== undefined || item.params.upscale_factor !== undefined));
const upscaleMatch = isUpscale && (search.includes("upscale") || search === "upscaled");
return aliasMatch || promptMatch || idMatch || modelMatch || upscaleMatch;
```

---

## 4. Rencana Pengujian & Verifikasi (Verification)

1. **Unit Tests**:
   - Menjalankan seluruh test suite (`pnpm test`) untuk memastikan tidak ada regresi pada endpoint `/customer/library`, manajemen aset, dan sinkronisasi status job.
2. **TypeScript Compilation**:
   - Memastikan tidak ada error tipe (`pnpm --filter @ai-gen-free/web exec tsc --noEmit` & `pnpm --filter @ai-gen-free/api exec tsc --noEmit`).
3. **End-to-End Verification**:
   - Memastikan container API, Web, dan Worker dibangun ulang dan berjalan dengan versi terbaru.
   - Menguji alur pemanggilan library query dengan data upscale yang telah tersimpan di database.

---

## 5. Pencegahan Jangka Panjang (Preventative Measures)

1. **Standard Invalidation Protocol**: Setiap hook atau komponen yang menangani siklus hidup pekerjaan AI (AI generation lifecycle) wajib menginvalidasi set query canonical: `["generated-jobs"]`, `["library"]`, dan `["wallet"]`.
2. **Sensible Cache Windows**: Hindari penggunaan `refetchOnMount: false` bersamaan dengan `staleTime` menit panjang pada halaman data dinamis seperti galeri/library pengguna.
