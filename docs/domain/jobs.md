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

- Default 43200 detik (12 jam), kunci `AppSetting` `generate_cooldown_seconds`.
- Gerbang submit membaca **`users.nextGenerateAt`**, bukan `Job.nextGenerateAt`.
- `Job.nextGenerateAt` = snapshot saat job itu sukses (audit). Jangan dipakai UI sebagai gerbang setelah admin reset.
- Admin ubah setting: nilai baru hanya untuk **sukses berikutnya**. `users.nextGenerateAt` yang sudah terpasang **tidak** dihitung ulang.
- Reset cooldown = aksi admin terpisah: `users.nextGenerateAt = null` untuk satu user. Bukan efek samping ubah setting.
- `0` detik = tidak pasang cooldown setelah sukses berikutnya.

## Retensi objek (14 hari)

- `JobAsset.expiresAt` diisi saat `put` (sukses): `now + 14 hari`. Bukan TTL signed URL (5–15 menit).
- Worker antrian `retention` (bukan queue `generate`): `ObjectStorage.delete` untuk aset `expiresAt < now` dan belum `purgedAt`.
- Setelah hapus: set `JobAsset.purgedAt`. Baris `Job`, `prompt`, `sha256`/`phash`, `providerJobId`, ledger, akun **tetap**.
- Jangan `signGetUrl` jika `purgedAt` terisi **atau** `expiresAt <= now` (fail-closed meski cron belum jalan).
- Status `succeeded` dan capture **tidak** diubah / di-refund.
- Prefix: hanya `outputs/` dan `inputs/`. **Jangan** hapus `proofs/**` (retensi bukti ≥ 90 hari, unit terpisah; jangan bucket-wide lifecycle 14 hari).
- Idempoten: `delete` objek yang sudah hilang + aset sudah `purgedAt` = no-op.

## Antrian

BullMQ queue `generate`.

- Job payload: `{ jobId }` saja. Sisanya dari DB.
- `WORKER_CONCURRENCY` default 3.
- FIFO (`timestamp`).
- Retry: hanya error jaringan/5xx/`429` provider, bukan 4xx/policy. Setelah retry: job DB tetap `queued` atau `running`; BullMQ boleh `delayed`. **Jangan** menambah `JobStatus.delayed`.
- Timeout: image 5 menit, video 20 menit (setting).
- Resume: jika `providerJobId` ada, worker hanya `getStatus` (jangan `submit` ulang).

`queue_position` = 1 + jumlah job `queued` yang `created_at` lebih awal.

## Katalog mode

v1 produksi (M4): `t2i` lewat `providerId=siray` di `ModelCatalog`. Router: `(mode, modelId) → providerId`. Klien boleh kirim `modelId`; `providerId` dan `costPoints` selalu dari server.

Mode lain ada di enum agar tidak migrasi ulang, tetapi endpoint menolak baris `enabled=false` dan mode tanpa model aktif. Dummy (`dummy-t2i`) boleh tetap di tabel untuk tes; seed produksi `enabled=false`.

Harga dan hold/capture: `docs/domain/wallet.md`. Salinan file ke bucket kita sebelum capture: `docs/providers/generation-port.md`.
