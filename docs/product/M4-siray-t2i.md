# M4 — Siray t2i

**Labels:** `po`, `milestone:M4`  
**Issue title:** `[M4] Adapter Siray t2i, katalog model, hasil gallery privat`  
**Depends on:** M3 (satu job aktif, hold/capture/release, cooldown, polling 202)

Jalur user v1: **text-to-image nyata** lewat adapter Siray. Mutex, ledger, dan cooldown M3 tetap berlaku. Face swap orang nyata **tidak** masuk unit ini.

## User-visible

### Pelanggan (Bahasa Indonesia, Mantine)

- Halaman generate menampilkan model **t2i yang `enabled`** dari katalog API: nama yang dipahami manusia, mode, dan **harga poin dari server**. UI tidak mengarang harga, `providerId`, atau daftar model.
- User menulis prompt teks, memilih model t2i (jika lebih dari satu), melihat biaya, lalu Generate.
- Submit tidak menunggu gambar jadi: pindah ke halaman job, polling status. Refresh tidak membatalkan job.
- Selama antri: posisi antrean (`queue_position`) dan progress kasar. Tab/perangkat lain: “sedang generate”, tidak submit paralel.
- Sukses: gambar nyata di gallery milik sendiri, unduh/lihat lewat **URL bertanda tangan milik platform** (bukan tautan Siray sebagai satu-satunya salinan). Poin terpotong (capture), countdown cooldown (default 12 jam, nilai admin). Copy “tersedia sampai {tanggal}” (14 hari) tetap tampil.
- Gagal (policy/4xx Siray, timeout gambar, token tidak tersedia, error setelah batas retry): pesan gagal di UI, **poin kembali**, **tanpa cooldown**, boleh generate lagi.
- Siray `429` / gangguan jaringan sementara: job **tidak** langsung gagal; user tetap melihat antri/berjalan; poin tetap tertahan sampai sukses atau gagal final.
- Checkbox “simulasikan gagal” dan model dummy **bukan** jalur produksi M4.

### Yang tidak berubah

- Login email+OTP, satu sesi, poin dari kurasi admin (M1–M2).
- `POST /jobs` → `202`; klien tidak memotong poin; cost di body diabaikan.
- Satu job `queued|running` per user; cooldown hanya setelah sukses.

## Acceptance

1. **Given** user login, **when** `GET /api/catalog/generate`, **then** daftar model `enabled=true` (minimal satu t2i `providerId=siray`) berisi mode, identitas model, dan `costPoints` dari `ModelCatalog` — bukan hardcode UI.

2. **Given** katalog t2i Siray berharga N poin, **when** user `POST /api/jobs` dengan `mode=t2i`, prompt valid, `Idempotency-Key`, dan `cost` palsu di body, **then** `202 { job_id, status, cost_held: N, queue_position }`; hold N; job `queued`; provider dari katalog, bukan dari klien.

3. **Given** request HTTP `POST /api/jobs`, **when** inferensi Siray belum selesai, **then** API sudah menjawab `202`; worker (bukan request API / Next.js) yang `submit` + `getStatus` lewat port `GenerationProvider` di `packages/providers-siray`.

4. **Given** job t2i Siray sukses, **when** worker menyelesaikan, **then** byte output sudah di `ObjectStorage` (MinIO/S3/R2) **sebelum** capture; `JobAsset` output terisi; capture sekali (`idempotencyKey=capture:{jobId}`); `succeeded`; `next_generate_at` terpasang.

5. **Given** job `succeeded`, **when** pemilik `GET /api/jobs/:id`, **then** `output.url` adalah signed URL bucket kita (TTL pendek); hostname/path Siray **bukan** satu-satunya salinan yang dikirim ke browser.

6. **Given** Siray gagal 4xx/policy, timeout gambar (batas domain: 5 menit), atau `SIRAY_API_TOKEN` kosong, **when** worker menandai gagal, **then** hold dilepas (`release:{jobId}`), status `failed`, pesan di UI, **`next_generate_at` tidak diubah**.

7. **Given** Siray menjawab `429` atau error jaringan/5xx di bawah batas retry, **when** adapter menahan laju (token bucket), **then** job `delayed`/`queued`/`running` — **bukan** `failed`, hold **tidak** dilepas.

8. **Given** poll/webhook status sukses yang sama dikirim dua kali, **when** worker memproses duplikat, **then** tetap satu capture dan satu objek output (idempoten).

9. **Given** `mode` selain t2i, atau baris katalog `enabled=false`, **when** `POST /api/jobs`, **then** `VALIDATION_ERROR`; tidak ada hold dan tidak ada panggilan Siray.

10. **Given** user A punya job, **when** user B `GET /api/jobs/:idA`, **then** `404` (bukan 403 yang membocorkan eksistensi).

11. **Given** job `queued|running` milik user, **when** tab kedua submit, **then** `409 JOB_IN_PROGRESS`. **Given** `now < next_generate_at`, **when** submit, **then** `429 COOLDOWN` + `retry_after_seconds`. **Given** saldo di bawah biaya katalog, **when** submit, **then** `402 INSUFFICIENT_POINTS`.

12. **Given** `Idempotency-Key` yang sama di-replay, **when** `POST /api/jobs`, **then** `202` dengan `job_id` yang sama; tidak ada hold kedua.

13. **Given** 10 user submit hampir bersamaan, **when** `WORKER_CONCURRENCY=3`, **then** FIFO; user melihat `queue_position`; tidak ada 10 koneksi Siray paralel karena concurrency worker.

14. **Given** bundle web, **when** diaudit, **then** `apps/web` dan `packages/core` tidak mengimpor SDK Siray; `SIRAY_API_TOKEN` tidak di env web (ADR 0007).

## Out of scope

- t2v, i2v, i2i produksi, inpaint (enum boleh ada; endpoint menolak `enabled=false`).
- Face swap dalam bentuk apa pun, termasuk **face swap orang nyata** (butuh keputusan produk + ADR baru).
- Explore / gallery publik, tautan unduh permanen, multi-session, generate paralel.
- Firebase Auth, ComfyUI/RunPod always-on, adapter Fal/dll. sebagai jalur v1.
- UI admin ubah cooldown dan hapus objek 14 hari (M5). Copy TTL 14 hari sudah ada sejak M3.
- Filter kesusilaan lanjutan, watermark wajib, atau unggah foto referensi.
- Klien yang menghitung/memotong poin, atau `POST /jobs` yang blocking sampai file jadi.

## QA

Harus lulus (fail-closed) sebelum unit dianggap selesai:

- Dua tab submit: hanya satu `queued`/`running`; yang lain `409 JOB_IN_PROGRESS`.
- Job Siray gagal / timeout / token kosong: hold dilepas, cooldown tidak terpasang, user boleh submit lagi.
- Job Siray sukses: capture sekali; cooldown terpasang; objek ada di storage kita sebelum capture.
- Poll/status duplikat tidak double-capture dan tidak menumpuk `JobAsset` output.
- User A tidak bisa `GET` job user B (`404`).
- Browser/`GET` job tidak memakai URL Siray sebagai satu-satunya salinan; signed URL mengarah ke storage platform.
- Mode non-t2i atau katalog disabled → `VALIDATION_ERROR`, tanpa hold.
- `cost` klien diabaikan; biaya = `ModelCatalog.costPoints`.
- `429` Siray (di bawah batas retry) tidak me-release poin.
- `apps/web` / `packages/core` bebas import Siray; token tidak bocor ke klien.
- UI produksi tidak menampilkan checkbox gagal dummy sebagai cara generate.

Kasus AGENTS.md yang tetap wajib: race dua tab; gagal tanpa cooldown; sukses + capture idempoten; webhook/poll duplikat; isolasi job antar user.
