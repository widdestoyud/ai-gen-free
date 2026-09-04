# ADR 0001 — Monorepo, Next.js hanya UI, API dan worker terpisah

**Status:** diterima  
**Tanggal:** 2026-09-04

## Konteks

Perlu diputuskan apakah backend dan frontend menyatu di Next.js, atau terpisah.

## Keputusan

Monorepo pnpm/TypeScript:

```
apps/web     Next.js App Router — UI + BFF tipis (proxy cookie)
apps/api     HTTP API (Fastify) — auth, jobs, wallet, admin
apps/worker  proses panjang BullMQ — panggil provider, simpan file, capture poin
packages/core      domain + ports
packages/db        Prisma client & repositories
packages/providers-siray
packages/providers-types
```

Next.js **bukan** tempat logika generate, ledger, atau Prisma mutation.

## Alasan

- Job video/image bisa > 10 menit. Serverless/route Next timeout.
- Worker harus scale terpisah dari UI.
- SOLID: HTTP adapter ≠ domain ≠ provider SDK.
- Agen AI berbeda lebih mudah patuh jika batas paket jelas.
- Docker: `api` dan `worker` image terpisah, `web` terpisah.

## Konsekuensi

- Lebih banyak service di Compose.
- Web tidak boleh import `@siray/sdk` atau memotong poin.
- CORS tidak perlu jika web dan api di belakang reverse proxy path yang sama (`/api` → api). Lokal: Caddy atau Next rewrite ke api.
