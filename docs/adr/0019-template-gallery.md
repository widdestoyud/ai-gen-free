# ADR 0019 — Galeri Template, Penyimpanan Aset Permanen, dan Isolasi Keamanan

**Status:** diterima  
**Tanggal:** 2026-11-26  
**Melengkapi:** [0009](./0009-object-storage-port.md), [0017](./0017-web-views-structure-and-api-mapping.md), [0018](./0018-server-side-pagination-sorting-filtering.md)

## Konteks

Studio `/app/generate` sebelumnya menampilkan empty state statis ketika belum ada job berjalan. Untuk mempercepat eksplorasi pengguna, dibutuhkan galeri template kurasi (beserta fitur *Try Template* untuk mengisi prompt dan gambar referensi ke Prompt Box) yang dikelola admin melalui `/admin/templates`.

Kebutuhan ini memiliki beberapa batasan keamanan dan siklus hidup aset:
1. Aset template bersifat kurasi permanen, berbeda dengan `Upload` dan `JobAsset` pengguna yang memiliki TTL 14 hari.
2. Endpoint publik/customer dilarang membocorkan `storageKey` mentah maupun nama model/provider upstream.
3. Konten dewasa (`isSpicy`) pada template hanya boleh diakses dan dipakai oleh pengguna dengan `spicyModeEnabled = true`.
4. Penghapusan atau penggantian aset template oleh admin tidak boleh menyentuh objek milik pengguna di bucket `ObjectStorage`.

## Keputusan

### 1. Tabel Permanen Tanpa TTL (`Template` dan `TemplateImage`)
- Menambahkan model `Template` dan `TemplateImage` (relasi 1-ke-banyak dengan `onDelete: Cascade`) di `prisma/schema.prisma` tanpa kolom `expiresAt` atau `purgedAt`.
- `Template.modelId` hanya menyimpan ID model abstrak opsional (`t2i-standard`, `t2i-spicy`, `i2i-standard`, `i2i-spicy`), bukan identifier provider/model upstream.
- Indeks komposit disiapkan pada `(isActive, isSpicy, sortOrder, createdAt)`, `(isActive, isSpicy, usageCount)`, `(category, isActive)`, dan `(templateId, position)` untuk mendukung paginasi dan penyaringan server-side (ADR 0018).

### 2. Prefix Storage `templates/` di Luar Worker Retensi
- Seluruh cover dan gambar referensi template dikompres ke format WebP dan disimpan di `ObjectStorage` dengan pola key `^templates\/[a-z0-9]+\.webp$`.
- Worker retensi (`isRetentionKey` di `apps/worker/src/retention.ts`) hanya menyapu prefix `outputs/`, `inputs/`, `uploads/customer/`, `uploads/admin/`, dan `temp/`. Prefix `templates/` tidak termasuk `isRetentionKey` sehingga aset template tidak pernah terhapus otomatis oleh worker retensi.

### 3. Referensi Kanonik `template-image:<id>` pada Parameter Job
- Respons API customer hanya mengembalikan URL tampilan (`coverUrl`, `images[].url`), tanpa `storageKey`.
- Saat customer menerapkan template dan mengirim job, gambar referensi dikirim menggunakan format `template-image:<id>` (merujuk ke `TemplateImage.id`).
- Worker (`apps/worker/src/resolve-inputs.ts`) mendahulukan resolusi prefix `template-image:` dari tabel `TemplateImage` + `Template` dan membaca objek melalui `ObjectStorage`, tanpa jatuh ke cabang resolusi ID upload lama.

### 4. Gating Mode Spicy & Status Aktif Server-Side
- Endpoint customer hanya menampilkan template dengan `isActive = true`. Permintaan daftar, kategori, atau pencatatan pemakaian (`use`) untuk scope spicy oleh user dengan `spicyModeEnabled = false` ditolak di server (HTTP 403).
- Worker memvalidasi ulang `Template.isActive` dan `Template.isSpicy` terhadap `User.spicyModeEnabled` saat me-resolve `template-image:<id>`. Jika template sudah nonaktif/dihapus atau user tidak berhak, resolusi gagal sehingga job gagal dan poin yang ditahan (`hold`) dilepas sesuai alur existing.

### 5. Pembersihan Objek Storage Saat Hapus atau Ganti Gambar
- Validasi input admin memaksa seluruh `coverStorageKey` dan `images[].storageKey` cocok dengan `^templates\/[a-z0-9]+\.webp$`.
- Saat template dihapus (`DELETE`) atau asetnya diganti (`PATCH`), hanya key lama yang sudah tidak direferensikan yang dihapus dari `ObjectStorage` (best-effort setelah transaksi DB sukses). Key milik customer/upload di luar prefix `templates/` tidak pernah diterima maupun dihapus.

## Konsekuensi

- Migrasi database menambahkan tabel `"Template"` dan `"TemplateImage"` (`prisma/migrations/20261126130000_template_gallery/migration.sql`).
- Penghapusan template/aset bergantung pada validasi prefix `templates/` di API dan ketahanan best-effort delete pada `ObjectStorage`.
- Kontrak rute web baru tetap wajib dicatat di `apps/web/lib/api-mapping.ts` sesuai ADR 0017.
