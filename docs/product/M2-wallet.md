# M2 — Wallet

**Labels:** `po`, `milestone:M2`

## User-visible

- Lihat saldo poin.
- Pilih paket top up → dapat invoice + instruksi QRIS (statis v1).
- Saldo naik hanya setelah admin menandai lunas.
- Riwayat: topup / hold / capture / release (bahasa sederhana).

## Acceptance

1. Given user login, when `GET /api/wallet`, then `available` = ledger posted − hold aktif.
2. Given paket 50.000 → N poin, when buat invoice, then status `unpaid`, unique code.
3. Given invoice unpaid, when admin mark paid, then satu `topup` posted, idempotent.
4. Given klien `POST` angka poin, when tanpa admin, then `403` / tidak ada endpoint kredit.
5. Screenshot transfer tidak auto-kredit.

## Out of scope

PSP otomatis, PPN, poin kedaluwarsa.

## QA

Tidak ada `points--` dari request user. Capture belum ada sampai M3; hold boleh belum dipanggil user.
