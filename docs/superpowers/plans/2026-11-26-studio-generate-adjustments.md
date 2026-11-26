# Studio Generate Adjustments: Auto-switch Tab Tasks & Clean Progress Percentage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyesuaikan interaksi studio di `/app/generate`: tab otomatis berpindah ke tab "Tasks" begitu tombol Generate diklik (bukan menunggu job id SSE/backend), dan menghilangkan teks/pesan bergulir di bawah persentase loader progress sehingga hanya menampilkan angka persentase bersih.

**Architecture:** 
1. Di `apps/web/views/app/generate/components/generate-studio.tsx`, pada handler `onSubmit` form composer dan/atau pemanggilan `ctrl.submit(e)`, langsung panggil `setActiveTab("tasks")` saat generate disubmit, serta tambahkan `useEffect` saat `ctrl.isGenerating` menjadi true.
2. Di `apps/web/views/app/generate/components/generate-skeleton.tsx`, hapus elemen `.skeletonMessageWrapper` dan logic rotating message `activeMessage`, sehingga `.skeletonProgressContainer` hanya menampilkan `.skeletonPercentText` ({Math.round(progressVal)}%).
3. Hapus class / style `.skeletonMessageWrapper` dan `.skeletonSlideInText` yang tidak terpakai lagi dari `apps/web/views/app/generate/components/generate-studio.module.css` untuk menjaga CSS tetap bersih (zero dead styles).

**Tech Stack:** React 19, Next.js 15, Mantine 8, TypeScript.

**Spec:** Permintaan user:
1. "pada klik generate seharusnya tab nya otomatis berpindah ke tab task"
2. "pada saat gambar sedang di generate saya tidak ingin ada embel-embel tulisan di bawah loader persentase, cukup tampilkan persentase saja"

## Global Constraints
- Tidak menggunakan inline `style={{ ... }}` sesuai aturan monorepo.
- Menjaga kebersihan dan paritas test unit `@ai-gen-free/web`.
- Commit kecil dan jelas. JANGAN commit `docker-compose.yml`.

## Review Focus
1. Tab Tasks langsung aktif segera setelah tombol generate ditekan (`e.preventDefault()`, `setActiveTab("tasks")`), bahkan sebelum response HTTP 202 `/api/generate` kembali.
2. Loader persentase di `GenerateSkeleton` tetap berjalan smooth (fake progress hingga real progress tiba) dan menampilkan angka `XX%` di tengah tanpa teks pesan apa pun di bawahnya.
3. Tidak ada error console atau broken layout pada `falMvOverlay` maupun `skeletonProgressContainer`.

---

### Task 1: Clean Progress Percentage Loader (Hapus teks pesan embel-embel)

**Files:**
- Modify: `apps/web/views/app/generate/components/generate-skeleton.tsx`
- Modify: `apps/web/views/app/generate/components/generate-studio.module.css`

**Interfaces:**
- `GenerateSkeleton` props: `{ progress?: number; mediaType?: "image" | "video"; size?: string }`
- Menghapus rendering `skeletonMessageWrapper` dan state interval `msgIndex` / `activeMessage`.
- Membersihkan CSS `.skeletonMessageWrapper`, `.skeletonSlideInText`, dan `.skeletonMessageContent` dari `generate-studio.module.css`.

- [ ] **Step 1: Edit `generate-skeleton.tsx`**
  Hapus import `getProgressMessage`, hapus interval rotasi pesan `useEffect` dengan `msgIndex`, dan hapus blok JSX `.skeletonMessageWrapper` di dalam `.skeletonProgressContainer`. Hanya sisakan `.skeletonPercentText` dengan nilai `{Math.round(progressVal)}%`.

- [ ] **Step 2: Bersihkan CSS di `generate-studio.module.css`**
  Hapus selector `.skeletonMessageWrapper`, `.skeletonSlideInText`, dan `.skeletonMessageContent` serta keyframe yang tidak terpakai jika hanya digunakan oleh slide in text.

- [ ] **Step 3: Jalankan test dan typecheck**
  Run: `cmd /c pnpm --filter @ai-gen-free/web test`
  Run: `cmd /c pnpm --filter @ai-gen-free/web exec tsc --noEmit`
  Expected: PASS tanpa error type.

- [ ] **Step 4: Commit**
  ```bash
  git add apps/web/views/app/generate/components/generate-skeleton.tsx apps/web/views/app/generate/components/generate-studio.module.css
  git commit -m "refactor(studio): simplify progress loader to clean percentage only"
  ```

---

### Task 2: Auto-switch Tab ke "Tasks" saat Tombol Generate Diklik

**Files:**
- Modify: `apps/web/views/app/generate/components/generate-studio.tsx`

**Interfaces:**
- State: `activeTab: StudioTabValue` ("tasks" | "templates")
- Handler: `onSubmit` form di `generate-studio.tsx`:
  ```tsx
  <form
    onSubmit={(e) => {
      setActiveTab("tasks");
      void ctrl.submit(e);
    }}
  >
  ```
  Dan tambahkan watcher:
  ```tsx
  useEffect(() => {
    if (ctrl.isGenerating) {
      setActiveTab("tasks");
    }
  }, [ctrl.isGenerating]);
  ```

- [ ] **Step 1: Update `generate-studio.tsx`**
  Panggil `setActiveTab("tasks")` langsung di event submit form sebelum `ctrl.submit(e)`, dan pastikan watcher `ctrl.isGenerating` juga menjaga tab tetap di `"tasks"` ketika generate sedang berlangsung.

- [ ] **Step 2: Jalankan test dan typecheck**
  Run: `cmd /c pnpm --filter @ai-gen-free/web test`
  Run: `cmd /c pnpm --filter @ai-gen-free/web exec tsc --noEmit`
  Expected: PASS tanpa error type.

- [ ] **Step 3: Commit**
  ```bash
  git add apps/web/views/app/generate/components/generate-studio.tsx
  git commit -m "feat(studio): automatically switch to tasks tab immediately upon generate click"
  ```

---

### Task 3: Verifikasi Browser & Build Docker

**Files:**
- Tidak ada file baru, verifikasi docker container dan antarmuka.

- [ ] **Step 1: Build & restart container web**
  Run: `cmd /c docker compose up -d --build web`
  Expected: Container `ai-gen-free-web-1` running.

- [ ] **Step 2: Smoke check HTTP**
  Run: `curl -I http://localhost:3001`
  Expected: HTTP 200 / 307.

- [ ] **Step 3: Verifikasi visual & fungsional**
  Pastikan saat submit generate diuji, tab otomatis loncat ke "Tasks" dan animasi loader progress hanya menampilkan angka persentase tanpa pesan teks di bawahnya.
