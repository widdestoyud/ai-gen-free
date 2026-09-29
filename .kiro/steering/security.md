---
inclusion: always
---

# Security

- Sesi browser: NextAuth httpOnly cookie (ADR 0010). Bukan `localStorage`.
- OTP dan token sesi di DB: hash, bukan plaintext.
- Satu sesi per user `kind` (ADR 0003). Login baru mencabut yang lama.
- Jangan percaya `cost` / `balance` / `role` dari body klien.
- Jangan `UPDATE users SET points = points - n`. Ledger hold/capture/release.
- `POST /jobs` = 202 + job_id, bukan tunggu gambar.
- Admin bukan lewat register publik. Role hanya seed/CLI.
- Bucket hasil generate bukan public-read.
- Next.js tidak import Prisma, BullMQ, atau SDK Siray.
- Payload aksi (email, token, OTP, password, profil) hanya JSON body. Dilarang query param (`?token=`, `?email=`). Filter GET daftar (`limit`, `offset`, `q`) boleh tetap query.
- Endpoint browser pelanggan DILARANG mengekspos nama model upstream (OpenAI, Bytedance, Alibaba, Flux, dsb.) dan nama provider (Siray). Gunakan modelId abstrak (`t2i-standard`, `video-standard`, dsb.) tanpa displayName dan providerId.
