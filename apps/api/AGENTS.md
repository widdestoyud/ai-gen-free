# apps/api

Baca root `AGENTS.md`. Jangan edit `apps/web`.

- OTP, hash sesi, satu sesi per `kind` tetap di sini.
- Payload aksi hanya JSON body (`POST`/`PATCH`/`PUT`). Dilarang baca `email` / `token` / `code` / `password` dari `req.query`. Jangan daftarkan GET untuk validasi token. Filter GET daftar (`limit`, `offset`, `q`, `status`) tetap query.
- Fastify **tanpa** prefix `/api`, kecuali `GET /api/health`. Browser `/api/...` hanya di Next.js (BFF).
- `POST /auth/otp-validation` merespons `{ user, sessionToken }`. Cookie `sid` boleh tetap untuk klien API langsung.
- NextAuth hidup di `apps/web`; jangan pasang Auth.js di Fastify.
- Jangan percaya `cost` / `role` / `balance` dari body. Hold/capture di server.
- `POST /generate/...` → 202. Jangan blokir request pada latency Siray.
