# ADR 0009 — Port ObjectStorage, backend via parameter

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

File (bukti transfer, hasil generate) lewat port `ObjectStorage`. Composition root memilih adapter dengan `STORAGE_DRIVER` / `createObjectStorage(params)`.

Adapter v1: S3-kompatibel di `packages/storage` — **satu class** untuk MinIO, AWS S3, dan Cloudflare R2 (protokol sama, beda default endpoint/region/path-style).

`memory` untuk tes. Backend non-S3 (GCS, disk) = class + `registerStorageDriver`, tanpa mengubah pemanggil.

## Alasan

Sama seperti `GenerationProvider` (ADR 0005): SDK vendor tidak merembes ke domain/API/worker. Ganti R2 ↔ S3 = env, bukan rewrite.

## Konsekuensi

- Jangan `npm install @aws-sdk/client-s3` di `apps/web` atau `packages/core`.
- `apps/api` dan `apps/worker` bergantung pada port, bukan `PutObjectCommand`.
- Alias `S3_*` didukung sementara; kanonik `STORAGE_*`.
