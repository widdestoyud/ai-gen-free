# M3 — Jobs dummy

**Labels:** `po`, `milestone:M3`

## User-visible

- Tombol generate (t2i dummy) menampilkan biaya dari server.
- Setelah submit: halaman job, progress kasar, refresh tetap jalan.
- Tab kedua: “sedang generate”.
- Sukses: poin terpotong, countdown cooldown (default 12 jam).
- Gagal: poin kembali, bisa generate lagi.

Provider = dummy (gambar 1×1 atau file statis), bukan Siray.

## Acceptance

1. POST `/jobs` → `202` + hold, bukan menunggu file.
2. Satu `queued|running` per user → `409 JOB_IN_PROGRESS`.
3. `now < nextGenerateAt` → `429 COOLDOWN` + `retry_after_seconds`.
4. Dummy sukses → capture sekali, set `nextGenerateAt`.
5. Dummy gagal (flag/param) → release, tanpa cooldown.
6. GET job orang lain → `404` (jangan bocorkan eksistensi dengan 403 beda).
7. Refresh GET status yang sama.

## QA

Dua tab; idempotent capture; UI tidak memotong poin.
