# Domain: auth

## User

- Daftar = login. Email + OTP. Tidak ada password v1.
- `role` tidak pernah dari klien. Register selalu `user`.

## OTP

1. Normalisasi email (trim, lowercase).
2. Tolak domain disposable (daftar di config).
3. Rate limit: 3 kirim / email / 15 menit; 10 / IP / jam.
4. Simpan `code_hash` (SHA-256 + salt aplikasi), expiry 10 menit, max 5 attempts.
5. Kirim 6 digit lewat `EmailPort` (Mailpit/SMTP).
6. Verifikasi sukses → consume challenge, cabut OTP lama email itu.

## Sesi

- Token acak 32 byte, **hash** di DB, raw di cookie `sid` (user) atau `sid_admin` (admin).
- Login sukses: hapus sesi lama `kind` yang sama untuk `user_id` itu (ADR 0003).
- Logout: hapus sesi itu.

## Admin

- Tidak lewat `/login` publik.
- Setelah Basic Auth, OTP ke email yang `role=admin`.

## Port

```
EmailPort.sendOtp(email, code): Promise<void>
```

Adapter v1: SMTP. Bukan Firebase. Lihat ADR 0006.
