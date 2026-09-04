# QA — M2 wallet

Runner: `node scripts/qa-m2-run.mjs` (Compose `api` + `web` + Mailpit + MinIO).

| Case | Result | Evidence |
|---|---|---|
| Saldo awal | pass | `{ available: 0, held: 0, currency: "points" }` |
| Buat invoice p50 | pass | `unpaid` + uniqueCode + instruksi QRIS dashboard |
| Approve tanpa bukti | pass | 400 `PROOF_REQUIRED` |
| Unggah PNG | pass | `awaiting_review`, `hasProof: true` |
| Notifikasi admin | pass | `pendingCount: 1`, kode invoice muncul |
| Signed URL | pass | `http://localhost:9000/generations/proofs/{userId}/{invoiceId}` (bukan hostname `minio`) |
| Stream bukti admin | pass | 200 `image/png` |
| MinIO privat | pass | unsigned GET 403; signed GET 200 |
| User B vs invoice A | pass | GET 404, unggah 404 |
| Admin terima | pass | `paid`, wallet `available: 500` |
| Approve dua kali | pass | tetap `available: 500` |
| Admin tolak | pass | `rejected` + `reviewNote`; saldo tidak naik |
| Unggah ulang setelah tolak | pass | kembali `awaiting_review` |
| `POST /api/wallet/credit` | pass | 404 |
| `POST /admin/invoices/:id/paid` | pass | 404 (diganti approve) |
| `/wallet` tanpa login | pass | 307 `/login` |
| Web proxy `/api/*` | pass | `/api/health` → API; invoice milik sendiri 200 |
| `/admin` Basic Auth | pass | tanpa Basic 401; `admin:change-me` 200 |

Bukti key MinIO: `proofs/{userId}/{invoiceId}`, bucket privat.
