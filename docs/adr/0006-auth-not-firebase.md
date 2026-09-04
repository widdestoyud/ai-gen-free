# ADR 0006 — Auth email OTP sendiri, bukan Firebase Auth

**Status:** diterima  
**Tanggal:** 2026-09-04

## Konteks

Diminta memakai Firebase untuk email + OTP.

## Keputusan

**Tidak** memakai Firebase Authentication sebagai identity v1.

Default: OTP 6 digit, hash di Postgres, kirim lewat SMTP.

- Dev Docker: Mailpit (`http://localhost:8025`)
- Prod: SMTP (Resend / SES / penyedia lain)

`AuthPort` tetap ada. Adapter Firebase **boleh** ditulis nanti tanpa mengubah job/wallet, tetapi tidak default.

## Alasan menolak Firebase sebagai default

1. **Docker-first gagal.** `compose up` tidak menyalakan Firebase Auth. Emulator tidak setara produksi dan tetap butuh Google.
2. **Sesi tunggal.** Firebase dirancang multi-device refresh token. `revokeRefreshTokens` kasar dan bertabrakan dengan cookie sesi kita.
3. **Admin Basic Auth + role seed** lebih sederhana tanpa Google Identity.
4. **PDP / data.** Identity user masuk ke Google tanpa kebutuhan v1.
5. Email OTP Firebase yang “resmi” lebih dekat ke email-link, bukan kode 6 digit yang kita rancang.

Yang **boleh** dari ekosistem Google nanti: FCM notifikasi, bukan Auth.

## Konsekuensi

- Butuh SMTP. Di Docker, Mailpit wajib.
- Rate limit OTP di API kita, bukan kuota Firebase.
