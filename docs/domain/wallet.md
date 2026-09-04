# Domain: wallet

Sumber kebenaran: `ledger_entries`, bukan kolom `points` yang diedit bebas.

`wallets.available_cached` boleh ada untuk baca cepat, **wajib** dihitung ulang dalam transaksi tulis.

## Available

```
available = sum(posted credits) - sum(posted debits) - sum(active holds)
```

Hold bukan debit final.

## Tipe

| type | kapan |
|---|---|
| `topup` | invoice mark paid |
| `hold` | submit job |
| `capture` | job succeeded (hold jadi debit) |
| `release` | job failed/canceled (hold void) |
| `refund` | kebijakan admin |
| `adjust` | koreksi admin, wajib `reason` |

Setiap baris punya `idempotency_key` unique. Contoh: `hold:{jobId}`, `capture:{jobId}`, `topup:{invoiceId}`.

## Aturan

- Harga job dari katalog server.
- Capture hanya di worker setelah file tersimpan.
- User API tidak men-capture.
- Gagal generate = release, user bisa job baru (jika tidak ada job aktif).

## Top up

Invoice `unpaid` → admin `paid` → `topup` posted. Screenshot user tidak auto-kredit.
