# M2 — Wallet

**Labels:** `po`, `milestone:M2`  
**Issue title:** `[M2] Wallet, unggah bukti transfer, kurasi admin`

## User-visible

### Pelanggan (dashboard)

- Lihat saldo poin dan riwayat ledger (isi saldo, kunci, pemakaian — bahasa sederhana).
- Pilih paket top up → invoice `unpaid` + kode unik + instruksi QRIS statis.
- **Wajib unggah bukti transaksi** (screenshot/struk) di dashboard, lalu submit.
- Setelah submit sukses, status invoice menjadi **menunggu kurasi**. Pelanggan tidak bisa memaksa poin masuk.
- Jika admin menolak, pelanggan melihat alasan dan boleh unggah ulang.
- Jika admin menerima, saldo bertambah; invoice `paid`.

### Admin

- Setelah bukti di-submit, **notifikasi muncul di halaman admin** (jumlah pending + daftar terbaru).
- Admin membuka bukti (gambar/PDF), lalu **terima** (lunas + kredit poin) atau **tolak** (dengan alasan).
- Tidak ada kredit poin dari screenshot yang dikirim lewat WhatsApp/Telegram saja. Bukti harus lewat dashboard.

## Alur

```
unpaid → (unggah bukti) → awaiting_review → paid
                              ↓
                          rejected → (unggah ulang) → awaiting_review
```

## Acceptance

1. Given user login, when `GET /api/wallet`, then `available` = ledger posted − hold aktif.
2. Given paket 50.000 → N poin, when buat invoice, then status `unpaid` + `uniqueCode`.
3. Given invoice `unpaid` tanpa bukti, when admin coba lunas, then ditolak (`PROOF_REQUIRED`).
4. Given user unggah bukti valid dan submit, then status `awaiting_review` dan item masuk notifikasi admin.
5. Given admin **terima** bukti, then satu `topup` posted (`idempotencyKey=topup:{invoiceId}`), saldo naik, notifikasi pending berkurang.
6. Given admin **tolak** dengan alasan, then status `rejected`, poin tidak bertambah, user melihat alasan.
7. Given klien `POST` angka poin / tanpa kurasi, then tidak ada endpoint kredit publik.
8. Unggah: hanya milik invoice sendiri; tipe jpeg/png/webp/pdf; batas ukuran; bucket privat.

## Out of scope

PSP otomatis, PPN, poin kedaluwarsa, konfirmasi via chat.

## QA

- Tidak ada `POST /wallet/credit`.
- File bukti tidak public-read.
- User A tidak bisa unggah/lihat bukti invoice user B.
- Terima dua kali pada invoice yang sama tidak double-topup.
