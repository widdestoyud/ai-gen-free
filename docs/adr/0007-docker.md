# ADR 0007 — Docker Compose sebagai cara jalan kanonik

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

Satu `docker compose up --build` menyalakan: Postgres, Redis, MinIO, Mailpit, migrate, api, worker, web.

Target: VPS, Pods, laptop — sama. Bukan “Next dev + Supabase cloud” sebagai jalur utama.

## Image

- `web`, `api`, `worker` dari Dockerfile di masing-masing app.
- Dependensi data: image resmi postgres:16, redis:7, minio, axllent/mailpit.

## Rahasia

- `.env` tidak di-commit. `.env.example` adalah kontrak.
- `SIRAY_API_TOKEN` hanya di `worker` (dan opsional api jika katalog butuh). Jangan ke `web`.

## Konsekuensi

- Agen yang menambah service wajib edit Compose + README run.
- Healthcheck: `/health` di api, web, worker metrics sederhana.
