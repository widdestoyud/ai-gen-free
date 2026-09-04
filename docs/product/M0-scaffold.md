# M0 — Scaffold

**Labels:** `po`, `milestone:M0`  
**Issue title:** `[M0] Monorepo + Compose app services`

## User-visible

Developer (dan nanti user di lokal) menjalankan satu perintah dan melihat:

- Postgres, Redis, MinIO, Mailpit hidup
- API menjawab sehat
- Worker menjawab sehat
- Web menampilkan status koneksi ke API (Bahasa Indonesia)

Tidak ada login, generate, atau pembayaran di fase ini.

## Acceptance

1. **Given** repo di-clone dan `.env` dari `.env.example`, **when** `docker compose up --build`, **then** service `postgres`, `redis`, `minio`, `mailpit`, `migrate`, `api`, `worker`, `web` menjadi healthy/running.
2. **Given** stack hidup, **when** `GET http://localhost:3001/api/health`, **then** `200` dan body `{ "ok": true, "service": "api" }`.
3. **Given** stack hidup, **when** `GET http://localhost:3002/health`, **then** `200` `{ "ok": true, "service": "worker" }`.
4. **Given** stack hidup, **when** buka `http://localhost:3000`, **then** halaman Indonesia menampilkan status API sehat atau tidak, tanpa crash.
5. **Given** Postgres kosong, **when** service `migrate` selesai, **then** tabel Prisma ada, termasuk index unik satu job aktif, dan baris `AppSetting` `generate_cooldown_seconds` = 43200.
6. **Given** `ADMIN_EMAILS` di env, **when** seed jalan, **then** user admin dengan email itu ada (`role=admin`) tanpa password publik.

## Out of scope

- Login OTP, ledger, job generate, Siray, UI generate, Basic Auth admin UI.

## QA

- `apps/web` tidak import `@prisma/client`, `bullmq`, atau `siray`.
- `packages/core` tidak import `fastify`, `next`, atau SDK Siray.
- Health API tidak membutuhkan cookie.

## Ownership

- BE: `apps/api`, `apps/worker`, `packages/*`, `prisma/`, `docker-compose.yml`
- FE: `apps/web`
