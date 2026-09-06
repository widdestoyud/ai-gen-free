# M5 — Admin + retensi

**Labels:** `po`, `milestone:M5`  
**Issue title:** `[M5] Panel admin cooldown, daftar user/job, retensi objek 14 hari`  
**Depends on:** M4 (t2i nyata, gallery privat, signed URL, cooldown domain); kurasi bukti transfer tetap di M2

Unit ini menutup papan v1: admin mengatur cooldown, melihat user/job (bukan file publik), dan objek hasil generate hilang setelah 14 hari. Face swap orang nyata **tidak** masuk. Explore/gallery publik **tidak** masuk.

## User-visible

### Pelanggan (Bahasa Indonesia, Mantine)

- Gallery milik sendiri menampilkan copy **“tersedia sampai {tanggal}”** (waktu lokal di UI; `expiresAt` UTC di server). Tanggal = 14 hari dari simpan sukses (`JobAsset.expiresAt`), bukan dari signed URL pendek.
- Selama file masih ada: lihat/unduh lewat **URL bertanda tangan platform** (TTL pendek 5–15 menit, default 600 detik seperti M4). Bukan tautan permanen, bukan URL Siray sebagai satu-satunya salinan, bukan bucket public-read.
- Setelah 14 hari (atau setelah cron retensi menghapus objek): gambar **tidak bisa dibuka**. Halaman job milik sendiri tetap ada: status, prompt, biaya, tanggal. Pesan bahwa file sudah tidak tersedia. Metadata job **tidak** ikut terhapus.
- Cooldown setelah generate sukses memakai nilai `app_settings.generate_cooldown_seconds` yang berlaku **saat job itu sukses** (default 43200 detik / 12 jam). Jika admin baru mengubah setting, countdown yang **sudah jalan** tidak meloncat; nilai baru hanya untuk sukses berikutnya.
- Gagal generate: poin dilepas, cooldown tidak terpasang (tidak berubah dari M3/M4).
- Tidak ada tombol “bagikan ke publik”, tautan permanen, atau explore.

### Admin (setelah Basic Auth reverse proxy + OTP admin, `role=admin`)

Kurasi bukti transfer **sudah ada di M2** (notifikasi + terima/tolak). M5 menambah menu di belakang gerbang yang sama (`/admin`, `/api/admin`), UI Mantine, Bahasa Indonesia, tanpa `style={{ … }}`.

- **Pengaturan cooldown:** field `generate_cooldown_seconds` (detik, bilangan bulat ≥ 0). Default tampil 43200. Simpan menulis `app_settings`. Nilai baru berlaku untuk job sukses **berikutnya**. `next_generate_at` yang sudah terpasang **tidak** dihitung ulang hanya karena setting berubah.
- **Reset cooldown user:** aksi terpisah (ADR 0004). Mengosongkan `users.next_generate_at` user itu agar boleh generate lagi (tetap tunduk mutex satu job aktif). Bukan efek samping dari ubah setting global.
- **Daftar user:** email, peran, `next_generate_at`, saldo cache/ledger ringkas — **bukan** dump file.
- **Daftar job:** identitas job, email pemilik, mode, status, waktu, prompt/hash ringkas. Bukan gallery publik. Jika file output masih hidup, admin boleh pratinjau lewat signed URL pendek + cek sesi admin (pola sama bukti M2), bukan objek public-read.
- **Adjust poin:** kredit/debit ledger `adjust` dengan **alasan wajib**. Bukan endpoint publik. Klien user tidak bisa menyesuaikan saldo.
- Setiap aksi admin di atas (ubah setting, reset cooldown, adjust, kurasi yang sudah ada) menulis **AuditLog** (aktor, aksi, target, waktu UTC, meta tanpa foto/prompt kesusilaan mentah jika tidak perlu).

Admin **tidak** dibuat lewat register publik. Role tidak dipercaya dari body klien.

### Yang tidak berubah

- Login email+OTP, satu sesi, NextAuth cookie browser (ADR 0010).
- Satu job `queued|running` per user; hold/capture/release; cooldown hanya setelah sukses.
- Bucket privat; `apps/web` tidak memanggil Prisma/BullMQ/SDK storage.

## Acceptance

1. **Given** admin sudah Basic Auth + sesi `sid_admin` dan `role=admin`, **when** `GET /api/admin/settings/generate_cooldown_seconds`, **then** nilai saat ini dari `app_settings` (default seed 43200).

2. **Given** cooldown saat ini 43200 dan user A punya `next_generate_at` di masa depan, **when** admin `PUT` `generate_cooldown_seconds` menjadi 3600, **then** setting tersimpan; `next_generate_at` user A **tidak** berubah; job sukses **berikutnya** (user mana pun) memakai 3600 detik; ada baris AuditLog.

3. **Given** user B masih dalam cooldown, **when** admin mengeksekusi reset cooldown untuk user B, **then** `next_generate_at` B kosong/lewat; B boleh `POST /jobs` jika tidak ada job aktif dan saldo cukup; user lain tidak terpengaruh; AuditLog tercatat.

4. **Given** job `succeeded` dengan `JobAsset.expiresAt` di masa lalu, **when** worker/cron `retention` jalan, **then** objek di `ObjectStorage` dihapus (port storage, bukan SDK di `packages/core`); aset ditandai kedaluwarsa/tidak bisa di-sign; baris `Job`, `prompt`, `sha256`/`phash`, `providerJobId`, ledger, dan akun **tetap ada**.

5. **Given** bukti transfer invoice (M2) berumur 14 hari, **when** retensi hasil generate jalan, **then** file bukti **tidak** ikut terhapus. Bukti punya retensi terpisah: default simpan **≥ 90 hari**; **jangan** hapus selama dispute/kurasi/permintaan resmi.

6. **Given** job milik user masih dalam 14 hari, **when** pemilik `GET /api/jobs/:id`, **then** `output.url` signed (TTL 5–15 menit, host publik `STORAGE_PUBLIC_ENDPOINT`, bukan hostname Docker); `availableUntil` = `expiresAt` 14 hari.

7. **Given** objek output sudah dihapus retensi, **when** pemilik `GET /api/jobs/:id`, **then** job metadata kembali; **tidak** ada URL yang membuka file; UI “tersedia sampai …” / “file tidak tersedia”; status tetap `succeeded` (poin yang sudah di-capture tidak dikembalikan).

8. **Given** signed URL atau `storageKey` job user A, **when** user B `GET /api/jobs/:idA` atau meminta URL baru, **then** `404` (bukan 403 yang membocorkan eksistensi). Menebak path bucket tidak menghasilkan objek public-read.

9. **Given** tanpa Basic Auth atau tanpa sesi admin, **when** `GET/PUT /api/admin/settings/*` atau daftar user/job admin, **then** `401`. **Given** sesi user biasa, **when** akses `/api/admin/*`, **then** ditolak.

10. **Given** admin adjust poin user dengan `reason` valid, **when** aksi sukses, **then** satu ledger `adjust` posted, saldo sesuai, AuditLog ada. **Given** tanpa `reason` / reason kosong, **then** ditolak; saldo tidak berubah.

11. **Given** klien `POST` angka `cost` / `balance` / `role` / minta hapus file orang lain, **when** API memproses, **then** diabaikan atau ditolak; tidak ada `UPDATE users SET points`; tidak ada endpoint kredit publik.

12. **Given** dua tab user, job gagal/sukses, isolasi job A vs B, **when** regresi M5, **then** invarians AGENTS.md tetap: satu job aktif; gagal = release tanpa cooldown; sukses = capture sekali + cooldown; user A tidak `GET` job B.

## Out of scope

- Explore / gallery publik, tautan unduh permanen, share link, CDN public-read.
- Face swap dalam bentuk apa pun, termasuk **face swap orang nyata** (butuh keputusan produk + ADR baru).
- t2v / i2v / i2i produksi, inpaint, ComfyUI/RunPod always-on, Firebase Auth.
- Multi-session, generate paralel per user.
- Menghapus baris `Job` / prompt / hash / akun sebagai “pembersihan 14 hari”.
- Menghapus bukti transfer pada jadwal 14 hari, atau hapus log/file **setelah** ada laporan/perkara (legal hold: jangan dirancang sebagai fitur hapus cepat).
- Portal lapor korban / take-down PSE / case management lengkap (kontrol operasional di catatan risiko; bukan unit M5).
- Ban user, katalog model admin, watermark wajib, filter kesusilaan lanjutan.
- Membuat admin lewat register publik; cookie sesi ketiga di luar NextAuth; `style={{ … }}`.

## QA

Harus lulus (fail-closed) sebelum unit dianggap selesai:

- Ubah `generate_cooldown_seconds` tidak menggeser `next_generate_at` yang sudah ada; sukses berikutnya memakai nilai baru.
- Reset cooldown hanya pada user target; AuditLog ada.
- Cron/worker retensi: objek `expiresAt < now` hilang dari storage; `Job` + prompt + hash tetap; idempoten jika dijalankan dua kali.
- Bukti transfer tidak terhapus oleh retensi 14 hari generate.
- Signed URL pendek (5–15 menit); cek pemilik; host bukan nama Docker internal.
- User A tidak bisa `GET` job user B (`404`); menebak URL/key tidak membuka bucket publik.
- Setelah retensi: pemilik masih melihat metadata job; file tidak bisa dibuka; capture tidak di-refund.
- `/api/admin/*` tanpa Basic/sesi admin → `401`; user `role=user` tidak lolos.
- Adjust tanpa alasan ditolak; adjust dengan alasan sekali tidak double-post jika diulang dengan kunci yang sama.
- `apps/web` tidak import Prisma / BullMQ / SDK S3/Siray; tidak memotong poin di klien.
- UI admin Mantine, Bahasa Indonesia, tanpa `style={{ … }}`.
- Tidak ada gallery publik dan tidak ada tautan permanen di UI.

Kasus AGENTS.md yang tetap wajib: race dua tab; login perangkat kedua; gagal tanpa cooldown; sukses + capture idempoten; webhook/poll duplikat; isolasi job antar user.

## GitHub

| Field | Nilai |
|---|---|
| Title | `[M5] Panel admin cooldown, daftar user/job, retensi objek 14 hari` |
| Labels | `po`, `milestone:M5` |
| Milestone | M5 |

Turunan papan (`docs/github/milestones.md`):

- `M5-1` [be] `app_settings` + cron/lifecycle 14 hari
- `M5-2` [fe] panel admin (di belakang Basic Auth)
- `M5-3` [qa] signed URL + user A tidak baca job B
