# Program spec — ai-gen-free v1

**Role:** PO  
**Status:** accepted as phase plan (implementation starts at M0)

## User-visible product

Pengguna web login dengan email + OTP, isi poin lewat top up QRIS: **unggah bukti di dashboard**, admin mengkurasi dari notifikasi, baru saldo bertambah. Lalu generate gambar (t2i dulu). Job jalan di background; refresh tidak membatalkan. Hasil privat 14 hari. Setelah generate sukses, user menunggu cooldown (default 12 jam, diatur admin) sebelum generate berikutnya. Gagal generate tidak memotong poin dan tidak memasang cooldown.

Admin masuk lewat gerbang terpisah (Basic Auth + OTP), bukan form login pelanggan.

## Fase

| Fase | Nama | Outcome yang user/admin rasakan |
|---|---|---|
| **M0** | Scaffold | `docker compose up --build` hidup; halaman status; API `/health` |
| **M1** | Auth | Login OTP, satu sesi, admin terpisah |
| **M2** | Wallet | Saldo, invoice, unggah bukti, notifikasi + kurasi admin |
| **M3** | Jobs dummy | Submit generate palsu, polling, mutex, cooldown |
| **M4** | Siray t2i | Generate gambar nyata, file di gallery |
| **M5** | Admin + retensi | Ubah cooldown, file hilang setelah 14 hari |

Tidak ada fase “semua fitur sekaligus.” Face swap orang nyata, explore publik, t2v/i2v produksi: **bukan v1.**

## Aturan produk yang tidak boleh dilanggar di fase mana pun

- Poin tidak dipotong dari browser.
- Satu perangkat logis (login baru menendang sesi lama).
- Satu job aktif per user.
- Cooldown hanya setelah **sukses**.
- UI Bahasa Indonesia.

## Task board

Kanonik: `docs/github/milestones.md`. Unit kerja: `docs/product/M*.md` + `docs/product/M*.contract.md`.
