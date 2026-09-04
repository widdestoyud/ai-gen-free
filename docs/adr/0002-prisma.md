# ADR 0002 — Prisma + PostgreSQL

**Status:** diterima  
**Tanggal:** 2026-09-04

## Konteks

Rancangan awal menyebut PostgreSQL tanpa ORM. Pertanyaan: kenapa tidak Prisma?

Prisma **bukan pengganti** arsitektur. Ia adalah akses data. Cocok, dan dikunci.

## Keputusan

- ORM: Prisma
- DB: PostgreSQL 16
- Schema: `prisma/schema.prisma` adalah sumber kebenaran tabel
- Generate client di `packages/db`

## Ledger dan kunci baris

Prisma `update({ data: { points: { decrement }}})` **dilarang** sebagai sumber kebenaran.

Untuk hold/capture:

1. `$transaction` isolation `Serializable` atau `RepeatableRead`, **dan**
2. Kunci wallet: `UPDATE wallets SET version = version + 1 WHERE user_id = $1 AND version = $2` (optimistic), atau `$queryRaw` `SELECT ... FOR UPDATE`

Race dua tab harus ditutup tes, bukan kepercayaan pada default Prisma.

## Konsekuensi

- Migrasi: `prisma migrate` di service `migrate` pada Compose.
- Agen baru wajib ubah schema dulu, baru kode.
