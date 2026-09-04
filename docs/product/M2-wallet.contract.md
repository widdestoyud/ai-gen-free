# M2 contract

**SA** — pembayaran manual: bukti di dashboard, kurasi di admin. Bukan chat.

## Status invoice

`unpaid` → `awaiting_review` → `paid`  
`awaiting_review` → `rejected` → (unggah ulang) → `awaiting_review`  
`expired` / `canceled` terminal tanpa kredit.

Admin **tidak** boleh `paid` dari `unpaid` tanpa bukti. Terima = satu-satunya jalan kredit.

## Routes (prefix `/api`)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/wallet` | sid | `{ available, held, currency: "points" }` |
| GET | `/wallet/ledger` | sid | milik sendiri |
| GET | `/catalog/topup` | sid | paket server |
| POST | `/invoices` | sid | `{ packageId }` → `unpaid` |
| GET | `/invoices` | sid | daftar milik sendiri |
| GET | `/invoices/:id` | sid | milik sendiri + status bukti |
| POST | `/invoices/:id/proof` | sid | `multipart/form-data` field `file` → `awaiting_review` |
| GET | `/admin/notifications` | sid_admin + Basic | pending kurasi (`awaiting_review`) |
| GET | `/admin/invoices` | sid_admin + Basic | daftar invoice + email user |
| GET | `/admin/invoices/:id/proof` | sid_admin + Basic | `{ url, expiresAt, contentType }` signed (host publik, bukan hostname Docker) |
| GET | `/admin/invoices/:id/file` | sid_admin + Basic | stream bukti (preview same-origin) |
| POST | `/admin/invoices/:id/approve` | sid_admin + Basic | `paid` + ledger `topup:{id}` |
| POST | `/admin/invoices/:id/reject` | sid_admin + Basic | `{ reason }` → `rejected` |

Tidak ada `POST /wallet/credit`.  
`POST /admin/invoices/:id/paid` **diganti** oleh `approve` (bukti wajib).

## Unggah bukti

- Field: `file`
- MIME: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- Maks **5 MB**
- Hanya invoice `unpaid` atau `rejected` milik user
- Simpan MinIO/R2 key `proofs/{userId}/{invoiceId}` — privat
- Ganti file = unggah ulang (masih `awaiting_review` jika submit dari `unpaid`/`rejected`)

## Notifikasi admin

`GET /admin/notifications` →

```json
{
  "pendingCount": 2,
  "items": [
    {
      "invoiceId": "...",
      "uniqueCode": "INV-…",
      "email": "user@example.com",
      "amountIdr": 50000,
      "points": 500,
      "proofSubmittedAt": "…",
      "status": "awaiting_review"
    }
  ]
}
```

Ini **antrian kurasi**, bukan push/email. Halaman admin menampilkan badge `pendingCount` dan daftar.

## Approve

- Hanya `awaiting_review` + `proofStorageKey` terisi
- Transaksi: `SELECT Wallet FOR UPDATE` → invoice `paid` → ledger `topup` posted → cache saldo
- Idempoten: approve ulang pada `paid` mengembalikan invoice tanpa double credit (`P2002` / cek status)

## Reject

- Body `{ "reason": string }` (wajib, min 3 karakter)
- Status `rejected`, `reviewNote` terisi, poin tidak bergerak
- User boleh unggah bukti baru

## Saldo

`available` dihitung dari ledger; kunci tulis `FOR UPDATE` pada wallet.
