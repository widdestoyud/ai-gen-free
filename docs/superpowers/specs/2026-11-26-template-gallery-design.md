# Template Gallery — Revamp `/app/generate` (Spec)

Sumber: sesi grill 2026-11-26. Status: disetujui PO (human).

## Tujuan
Ganti empty state "Tulis deskripsi ide di bawah…" di `/app/generate` dengan galeri template (gaya referensi `referensi/Screenshot 2026-11-26 123648.png`). User klik "Try Template" → prompt + gambar referensi template masuk ke Prompt Box. Admin mengelola template di `/admin/templates`.

## Keputusan yang dikunci

### Studio `/app/generate`
1. Kanvas punya tab **Tasks** | **Templates**. Tasks = konten stage lama (progress job, hasil terakhir, alert cooldown/error) + badge jumlah job aktif. Templates = galeri.
2. Header tab + filter bar sticky di atas; Prompt Box tetap docked di bawah; hanya area grid yang scroll.
3. Grid: 4 kolom desktop (≥1024px), 3 tablet (768–1023px), 2 mobile (<768px).
4. Infinite scroll server-side, **12 item per batch**, lazy image, skeleton saat memuat.
5. Filter bar: toggle **18+**, search, pill kategori (dinamis dari data), pill sort **Semua / Trending / Terbaru**.
6. Toggle 18+ off → hanya template safe. On → hanya template spicy. Jika akun belum `spicyModeEnabled`: aturan existing (wajib tanggal lahir → `SpicyConsentModal`). Server menolak spicy untuk akun yang belum aktif.
7. Card: cover portrait, **tanpa ikon bintang**. Hover (desktop) → overlay + tombol **"Try Template"** di tengah. Jika template punya gambar referensi, thumbnail referensi tampil di pojok kanan atas.
8. Mobile (tanpa hover): tap pertama memunculkan overlay; tap tombol "Try Template" menerapkan template lalu fokus ke textarea Prompt Box.
9. Try Template: timpa prompt + gambar referensi, set aspect ratio & mode safe/spicy (+ model jika template menentukan). **Konfirmasi** hanya jika user sudah mengedit Prompt Box secara manual (ketik / tambah / hapus gambar). Mengganti dari template ke template lain tanpa edit manual → langsung timpa.
10. Template spicy dipilih oleh user yang belum aktif spicy → muncul alur validasi umur yang sama.

### Admin `/admin/templates`
11. CRUD penuh + toggle Aktif/Nonaktif.
12. Field: judul, prompt, kategori, model target (opsional, ID abstrak), aspect ratio, safe/spicy, aktif, urutan, cover (wajib), 0–4 gambar referensi (+alias opsional).
13. Gambar: upload file (drag & drop / file picker) atau tempel URL → dikompres WebP, disimpan di R2 `templates/`.
14. Paginasi nomor halaman + search + filter (mode, kategori, status), server-side (ADR 0018).
15. Hapus template / ganti gambar → objek R2 lama ikut dihapus.
16. Tidak ada seed data.

### Data
17. Tabel `Template` + `TemplateImage` di PostgreSQL. **Tanpa TTL** (tidak tersentuh worker retensi).
18. Endpoint browser tidak mengekspos nama model/provider upstream maupun storage key.
