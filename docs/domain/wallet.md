# Domain: wallet

Sumber kebenaran: `ledger_entries`, bukan kolom `points` yang diedit bebas.

`wallets.available_cached` boleh ada untuk baca cepat, **wajib** dihitung ulang dalam transaksi tulis.

## Available

```
available = sum(posted credits) - sum(posted debits) - sum(active holds)
```

Hold bukan debit final.

## Tipe ledger

| type | kapan |
|---|---|
| `topup` | admin **approve** bukti transfer |
| `hold` | submit job |
| `capture` | job succeeded (hold jadi debit) |
| `release` | job failed/canceled (hold void) |
| `refund` | kebijakan admin |
| `adjust` | koreksi admin, wajib `reason` |

Setiap baris punya `idempotency_key` unique. Contoh: `hold:{jobId}`, `capture:{jobId}`, `topup:{invoiceId}`, `adjust:{userId}:{key}`.

## Aturan

- Harga job dari katalog server.
- Capture hanya di worker setelah file tersimpan.
- User API tidak men-capture dan **tidak** men-topup. Tidak ada `POST /wallet/credit`.
- Gagal generate = release, user bisa job baru (jika tidak ada job aktif).
- Hapus file hasil generate (retensi 14 hari) **bukan** alasan refund capture.

## Adjust admin

- Hanya `sid_admin` + Basic + `role=admin`. Bukan endpoint publik.
- `amount` bilangan bulat ≠ 0 (positif = kredit, negatif = debit). `reason` wajib, trim, min 3 karakter.
- Posted langsung (`LedgerType.adjust`, `LedgerStatus.posted`). Bukan hold.
- Debit yang membuat `available < 0` ditolak; saldo tidak berubah.
- Replay `Idempotency-Key` yang sama → baris yang sama, bukan double-post.
- Setiap sukses menulis `AuditLog`.

## Top up (bukti + kurasi)

```
unpaid
  → user unggah bukti di dashboard
  → awaiting_review  (notifikasi admin)
  → admin approve → paid + ledger topup
  → admin reject  → rejected (boleh unggah ulang)
```

- Bukti hidup di object storage privat, bukan chat.
- Screenshot di luar dashboard tidak mengkredit poin.
- Approve tanpa file bukti dilarang.
- Mutasi rekening admin (bukan screenshot user) tetap dicatat lewat aksi approve + `paidByAdminId` + audit log.
