# M4 — Siray t2i

**Labels:** `po`, `milestone:M4`

## User-visible

- Model t2i dari katalog (nama ramah, harga poin).
- Hasil gambar di gallery, unduh lewat URL bertanda tangan.
- Jika Siray gagal: pesan gagal, poin kembali, tanpa cooldown.

## Acceptance

1. Worker memanggil Siray lewat `packages/providers-siray`, bukan dari `apps/web` atau `packages/core`.
2. Output disalin ke MinIO sebelum capture.
3. Browser tidak menerima URL Siray sebagai satu-satunya salinan.
4. Mode selain t2i enabled=false → `VALIDATION_ERROR`.

## Out of scope

t2v, i2v, face swap, i2i produksi (enum boleh ada, endpoint menolak).
