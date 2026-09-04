# ADR 0005 — Port generate, adapter Siray dulu

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

Domain tidak mengenal Siray. Worker memanggil `GenerationProvider`.

Adapter v1: `packages/providers-siray` (https://api.siray.ai/).

Router: `(mode, modelId) → providerId`. t2i dan t2v **boleh** beda provider nanti tanpa ubah `JobService`.

## Alasan

Vendor lock dicegah di batas paket. Siray bisa diganti/ditambah Fal, RunPod, dll.

## Konsekuensi

- Jangan `npm install siray` di `apps/web` atau `packages/core`.
- Mapping model ada di config/DB, bukan hardcode di UI saja. UI hanya menerima katalog dari API.
