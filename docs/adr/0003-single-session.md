# ADR 0003 — Satu sesi, satu perangkat logis

**Status:** diterima  
**Tanggal:** 2026-09-04

## Keputusan

- User tidak boleh login di dua perangkat / dua sesi.
- Login sukses **mencabut semua sesi lama** jenis yang sama (`user` atau `admin`).
- Cookie sesi httpOnly, Secure, SameSite=Lax. Bukan JWT di JS.

## Batas jujur

Ini **satu sesi**, bukan DRM perangkat. Cookie yang dicuri masih dipakai sampai login baru atau logout. V1 tidak pakai binding hardware. Boleh ikat `user-agent` sebagai sinyal lemah, bukan keamanan utama.

## Alasan

Permintaan produk: tidak multi-device. Memudahkan audit “siapa yang generate” dan mengurangi bagi akun.

## Konsekuensi

- Login di HP menendang sesi laptop.
- User yang kehilangan sesi minta OTP baru ke email yang sama.
