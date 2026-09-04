# ADR 0004 — Satu job aktif, cooldown setelah sukses

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

1. User tidak bisa generate paralel (termasuk tab baru).
2. Selama job `queued` atau `running`, submit baru → `409 JOB_IN_PROGRESS`.
3. Job jalan di worker (background). Refresh tidak membatalkan.
4. Gagal: hold dilepas, **tidak** ada cooldown, boleh submit baru.
5. Sukses: capture poin, pasang `users.next_generate_at = now + cooldown`.
6. Cooldown default **12 jam**, disimpan di `app_settings.generate_cooldown_seconds`, diubah dari menu admin.

Perubahan cooldown admin:

- Job sukses **berikutnya** memakai nilai baru.
- `next_generate_at` yang sudah terpasang **tidak** dihitung ulang, kecuali admin mengeksekusi aksi “reset cooldown user”.

## Antrian global (contoh 10 user bersamaan)

- Setiap user maksimal 1 job di antrian/jalan.
- 10 user submit ≈ 10 job FIFO di Redis (BullMQ).
- Worker concurrency = `WORKER_CONCURRENCY` (default 3), bukan 10, agar patuh rate limit Siray.
- User melihat `queue_position` dan estimasi kasar.

Algoritme: **FIFO global + mutex per user + token bucket di adapter provider**. Bukan round-robin dulu; dengan 1 job/user, FIFO sudah adil.

## Konsekuensi

- Unique partial index: satu job `queued|running` per `user_id`.
- Cooldown dicek **setelah** cek job aktif.
