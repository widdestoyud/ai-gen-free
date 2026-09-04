# Domain: jobs

## Status

```
queued → running → succeeded
                 → failed
queued → canceled   (hanya queued; v1 boleh ditunda)
```

## Invarian

1. Maksimal satu job `queued` atau `running` per user (index unik parsial).
2. Tab / device lain dapat `409 JOB_IN_PROGRESS`.
3. Refresh tidak mengubah status job.
4. Sukses → `next_generate_at = now + settings.generate_cooldown_seconds`.
5. Gagal → `next_generate_at` tidak diubah; hold dilepas.
6. Submit saat `now < next_generate_at` → `429 COOLDOWN`.

## Cooldown

- Default 43200 detik (12 jam).
- Admin ubah lewat `app_settings`.
- Nilai baru berlaku untuk **sukses berikutnya**.

## Antrian

BullMQ queue `generate`.

- Job payload: `{ jobId }` saja. Sisanya dari DB.
- `WORKER_CONCURRENCY` default 3.
- FIFO (`timestamp`).
- Retry: hanya error jaringan/5xx provider, bukan 4xx/policy.
- Timeout: image 5 menit, video 20 menit (setting).

`queue_position` = 1 + jumlah job `queued` yang `created_at` lebih awal.

## Katalog mode

v1 implementasi: `t2i` dulu. Mode lain ada di enum agar tidak migrasi ulang, tetapi endpoint menolak mode yang `enabled=false`.
