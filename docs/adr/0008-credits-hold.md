# ADR 0008 — Poin via ledger hold/capture

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

User melihat “poin dipotong saat sukses.” Implementasi: **hold saat submit, capture saat sukses, release saat gagal.**

Klien tidak punya endpoint yang menambah/memotong poin atau menandai job sukses.

Top up hanya dari invoice `paid` setelah admin **approve bukti** yang diunggah di dashboard (`idempotencyKey=topup:{invoiceId}`). Screenshot di chat atau `POST /wallet/credit` dilarang. Webhook PSP boleh ditambah nanti tanpa mengganti kurasi sebagai sumber kredit v1.

Alur top up v1: `unpaid` → unggah bukti → `awaiting_review` (notifikasi admin) → `approve` = `paid` + ledger, atau `reject` = `rejected`.

Rincian: `docs/domain/wallet.md`, `docs/product/M2-wallet.md`.
