# ADR 0016 — Payload aksi hanya JSON body, bukan query string

**Status:** diterima  
**Tanggal:** 2026-09-09  
**Memperbarui:** ADR 0013 (OTP tanpa query), ADR 0014 (email-validation body atau query), ADR 0015 (GET `?token=` untuk reset)

## Konteks

Beberapa rute auth menerima token/email dari query (`GET /auth/email-validation?token=`, `GET /auth/password-reset-validation?token=`). Itu bocor di log akses, referer, riwayat browser, dan koleksi Postman. ADR 0013 sudah melarang query untuk OTP; aturan yang sama harus berlaku untuk seluruh payload aksi.

## Keputusan

1. **Payload aksi wajib JSON body** pada `POST` / `PATCH` / `PUT`. Termasuk: `email`, `password`, `token`, `code`, field profil, dan field aksi lain.
2. **Dilarang** membaca payload itu dari `req.query` atau mendaftarkan `GET` untuk validasi/konfirmasi token.
3. **Pengecualian:** filter dan pagination pada GET daftar (`limit`, `offset`, `q`, `status`, `userId`, `action`). Itu bukan payload aksi dan bukan rahasia.
4. Tautan di email **boleh** membawa token di URL halaman FE (`/verify-email?token=`, `/reset-password?token=`). Halaman itu yang `POST` JSON `{ token }` ke API. API sendiri tidak menerima `?token=`.

Rute yang berubah:

- `POST /auth/email-validation` body `{ token }` saja. GET dihapus.
- `POST /auth/password-reset-validation` body `{ token }` saja. GET dihapus.

## Konsekuensi

- Fastify tidak lagi bind GET pada kedua rute di atas.
- Postman dan kontrak M1 hanya mencantumkan POST + body.
- Agen baru wajib mengikuti `AGENTS.md` + file ini; jangan mengembalikan query payload.
