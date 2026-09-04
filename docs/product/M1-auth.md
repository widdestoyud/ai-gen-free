# M1 — Auth

**Labels:** `po`, `milestone:M1`

## User-visible

- Pelanggan isi email → terima kode 6 digit (Mailpit lokal) → masuk.
- Login di HP menendang sesi laptop.
- Tidak ada pilihan “masuk sebagai admin” di form publik.
- Admin: Basic Auth dulu, lalu OTP ke email yang `role=admin`.

## Acceptance

1. Given email valid, when minta OTP, then email terkirim dan challenge sekali pakai 10 menit.
2. Given OTP benar, when verifikasi, then cookie `sid` httpOnly; user `role=user` jika baru.
3. Given sesi aktif di perangkat A, when login di perangkat B, then sesi A ditolak (`401`).
4. Given body `{ "role": "admin" }`, when register/login publik, then role tetap `user`.
5. Given tanpa Basic Auth, when `GET /admin` atau `/api/admin/*`, then `401`.
6. Disposable email ditolak.

## Out of scope

Password, Firebase, ganti email, KYC 21+.

## QA

Kasus AGENTS.md: login perangkat kedua. OTP tidak tersimpan plaintext.
