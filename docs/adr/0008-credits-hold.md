# ADR 0008 — Poin via ledger hold/capture

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

User melihat “poin dipotong saat sukses.” Implementasi: **hold saat submit, capture saat sukses, release saat gagal.**

Klien tidak punya endpoint yang menambah/memotong poin atau menandai job sukses.

Top up hanya dari invoice `paid` yang di-set admin (nanti webhook PSP).

Rincian: `docs/domain/wallet.md`.
