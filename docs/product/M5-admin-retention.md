# M5 — Admin + retensi

**Labels:** `po`, `milestone:M5`

## User-visible

- Admin (setelah Basic Auth + OTP): daftar invoice unpaid, tombol lunas, field cooldown detik, daftar job/user (bukan file publik).
- User melihat “tersedia sampai {tanggal}” di gallery.
- Setelah 14 hari: gambar tidak bisa dibuka; metadata job tetap.

## Acceptance

1. Ubah `generate_cooldown_seconds` berlaku untuk sukses **berikutnya**.
2. Lifecycle/cron menghapus objek yang `expiresAt < now`.
3. Signed URL pendek (5–15 menit), cek pemilik.
4. User A tidak bisa menebak URL user B.

## Out of scope

Explore publik, share link permanen.
