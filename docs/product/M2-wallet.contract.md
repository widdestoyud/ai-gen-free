# M2 contract

## Routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/wallet` | sid | `{ available, held, currency: "points" }` |
| GET | `/wallet/ledger` | sid | halaman sendiri, tanpa field internal provider |
| GET | `/catalog/topup` | sid | paket dari config/DB |
| POST | `/invoices` | sid | `{ packageId }` → invoice |
| GET | `/invoices/:id` | sid | milik sendiri |
| POST | `/admin/invoices/:id/paid` | sid_admin | ledger `topup:{invoiceId}` |

Tidak ada `POST /wallet/credit`.

`available` dihitung di transaksi tulis dengan kunci `Wallet.version` / `FOR UPDATE`.
