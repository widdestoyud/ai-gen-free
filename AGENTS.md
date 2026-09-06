# AGENTS.md — cara manusia dan AI melanjutkan proyek ini

Baca file ini **sebelum** menulis kode. Berlaku untuk Grok, Claude, Kiro, Cursor, Codex, Copilot, Gemini, atau agen lain.

Proyek ini adalah platform generator web (t2i / i2i / t2v / i2v, belakangan inpaint/face swap). Bahasa UI: Indonesia. Yurisdiksi operasional: Indonesia.

Steering per-tool **menunjuk ke file ini**. Jangan mengarang aturan baru yang bertentangan. Salinan di `.kiro/steering/`, `.grok/rules/`, `.cursor/rules/`, `CLAUDE.md`, `.github/copilot-instructions.md` hanya pointer + detail scoped.

## Baca dulu, urut

1. `AGENTS.md` (file ini)
2. `docs/README.md` — peta dokumen
3. `docs/architecture.md` — sistem
4. `docs/adr/` — keputusan yang **sudah dikunci**
5. `prisma/schema.prisma` — sumber kebenaran data
6. `aidlc/README.md` — SDLC, orchestrator, PO/SA/BE/FE/QA
7. `docs/github/milestones.md` — papan M0–M5
8. `docs/catatan-risiko-hukum-platform.md` — batas produk, bukan nasihat hukum
9. Scoped: `apps/web/AGENTS.md`, `apps/api/AGENTS.md` jika menyentuh folder itu

Jangan mengarang ulang arsitektur. Jika ingin mengubah keputusan di `docs/adr/`, buat ADR baru yang mencabut yang lama. Jangan diam-diam menyimpang.

## Apa yang sudah dikunci

- Monorepo TypeScript. **Bukan** semua logika di Next.js.
- `apps/web` = UI Next.js. `apps/api` = HTTP. `apps/worker` = job panjang. `packages/core` = domain.
- Prisma + PostgreSQL.
- Antrian Redis + BullMQ.
- File lewat port `ObjectStorage` (`STORAGE_DRIVER`: r2 / s3 / minio). TTL 14 hari. Compose **tidak** mengunci MinIO.
- Email OTP lewat port `EmailPort` (`SMTP_*`). Mailpit opsional (`--profile mailpit`), bukan wajib.
- Poin: ledger + hold/capture/release. Klien tidak pernah memotong poin.
- Satu sesi login per user. Login baru mencabut sesi lama.
- Satu job aktif per user. Tab baru tidak boleh generate paralel.
- Sukses generate → cooldown (default 12 jam), **diatur admin**.
- Gagal generate → poin dilepas, cooldown tidak jalan, user boleh generate lagi.
- Provider generate: port + adapter. Adapter pertama: **Siray**. Adapter lain = paket baru + register, tanpa mengubah job/wallet/UI.
- Ganti storage / email / sesi browser / generate: **hanya adapter + env** (ADR 0012). Presentation (flow, komponen, layout) dan use case tidak berubah.
- Auth & User Security (ADR 0014):
  - Signup via `POST /user/register`: input `email` + `password`. Whitelist domain email resmi: `@gmail.com`, `@yahoo.com`, `@ymail.com` (menolak email test/palsu). Password minimal 8 karakter, setidaknya 1 huruf kapital dan 1 angka.
  - Verifikasi email wajib via `POST /auth/email-validation` sebelum user diizinkan masuk.
  - Login via `POST /user/login` (pelanggan) dan `POST /admin/login` (admin): input `email`/`username` + `password`. Login pertama kali atau ganti perangkat pada pelanggan memicu OTP verifikasi ke email. Jika user/admin **sudah dalam posisi login** (membawa cookie/token sesi aktif atau login ulang di perangkat yang sama), request login **dilarang mengembalikan HTTP 200** dan wajib melempar error reusable `ALREADY_LOGGED_IN` (`A019`, HTTP 409).
  - Request/resend OTP via `POST /auth/otp`: dibatasi maksimal 3x per 30 menit (lockout 30 menit jika terlampaui).
  - Validasi OTP via `POST /auth/otp-validation`: maksimal 3x salah input OTP sebelum kode dikunci permanen.
  - Profil user via `GET/PATCH /user/profile`: input nama alias, telepon, KTP, alamat. **Bebas celah IDOR**: identitas user diambil mutlak dari cookie sesi server (`session.userId`), tidak boleh mempercayai ID dari body/query.
  - Konfigurasi terpusat: Rate limit di `packages/core/src/config/rate-limit.config.ts` dan respon di `packages/core/src/config/responses.config.ts`. Terikat error reusable `ALREADY_LOGGED_IN` (`A019`, 409) untuk seluruh pencegahan aktivitas saat sesi masih aktif.
- Cookie/sesi **browser**: adapter v1 NextAuth (ADR 0010) di belakang `lib/auth-actions.ts` + `lib/server-api.ts`. Halaman/komponen **tidak** mengimpor `next-auth`. Identity/OTP/satu-sesi tetap di `apps/api`.
- UI: **Mantine**. Dilarang style inline `style={{ … }}`. Item berulang = komponen di `apps/web/components/` (ADR 0011).
- SoC Web (ADR 0013): Controller = custom hooks di `apps/web/hooks/`, presentation = komponen di `components/` & `app/`. OTP login via Modal di 1 halaman, body JSON `{ email, code }` tanpa query param. Kode error ber-prefix (`AXXX`, `BXXX`, dll.) dan `transaction_id` di seluruh endpoint.
- Seluruh stack jalan lewat Docker Compose.


## SDLC (AIDLC slice)

Conductor: `.grok/agents/orchestrator.md`  
Spesialis: `po`, `sa`, `be`, `fe`, `qa`  
Workflow Grok: `/workflow aidlc-mvp` dengan `intent` (contoh `M1-auth`)  
Diagram: `docs/archify/html/aidlc.workflow.html`

Orchestrator **tidak** menulis kode produk. Construction hanya setelah gerbang manusia pada artefak PO+SA. QA fail-closed.

## Diagram Archify

HTML di `docs/archify/html/`. JSON di `docs/archify/src/`. Skill: `archify-docs`.

## SOLID di repo ini

| Huruf | Artinya di kode |
|---|---|
| S | Satu service satu alasan berubah: `JobService`, `WalletService`, `AuthService`, `CooldownService` terpisah |
| O | Provider/storage/email/sesi baru = class baru + register + env, bukan `if (driver === ...)` di wallet/job/halaman |
| L | Setiap adapter memenuhi `GenerationProvider` / `ObjectStorage` / `EmailPort` / kontrak sesi web tanpa syarat tersembunyi |
| I | Jangan paksa adapter video mengimplementasi t2i. Capability dinyatakan di provider |
| D | `apps/api` dan `apps/worker` bergantung pada port di `packages/core/ports`. Halaman web bergantung pada `lib/auth-actions` + HTTP API, bukan NextAuth/Siray/R2 |

UI dan Route Handler Next.js **dilarang** memanggil SDK Siray, Prisma wallet mutation, atau BullMQ langsung. Mereka hanya HTTP ke `apps/api`.

## Yang tidak boleh dilakukan agen

- Menyimpan JWT access token di `localStorage`.
- Cookie sesi browser custom di luar adapter sesi (`lib/auth-actions`), atau PrismaAdapter NextAuth.
- Meng-hardcode MinIO/Mailpit/Siray di Compose `environment:` atau di halaman UI.
- Mengubah layout/komponen/flow hanya karena ganti R2, SMTP, atau merek Auth.js (ADR 0012).
- `style={{ … }}` di `apps/web` (pakai Mantine / komponen).
- Percaya `cost` / `balance` / `role` dari body klien.
- `UPDATE users SET points = points - n`.
- `POST /jobs` yang menunggu sampai gambar jadi (harus 202 + job_id).
- Membuat admin lewat register publik.
- Menyimpan OTP atau session token dalam bentuk plaintext.
- Public-read bucket untuk hasil generate.
- Face swap orang nyata sebagai fitur default tanpa keputusan produk baru + ADR.
- Memakai Firebase Auth sebagai identity utama tanpa ADR yang mencabut `0006`.

## Cara menambah fitur

1. Domain dulu di `packages/core` (use case + tes).
2. Port jika butuh I/O baru.
3. Adapter (Prisma / Siray / SMTP / queue).
4. Endpoint di `apps/api`.
5. UI di `apps/web`.
6. Update dokumen jika kontrak berubah.

## Tes minimum yang wajib ada sebelum klaim “selesai”

- Race dua tab submit job: hanya satu yang `queued`/`running`.
- Login di perangkat kedua: sesi pertama mati.
- Job gagal: hold dilepas, cooldown tidak terpasang.
- Job sukses: capture sekali (idempoten), cooldown terpasang.
- Webhook/poll duplikat tidak double-capture.
- User A tidak bisa `GET` job user B.

## Konvensi

- TypeScript strict.
- ID: `cuid()`.
- Waktu: UTC di server, tampil lokal di UI.
- Error API: `{ error: { code, message } }`.
- Log: jangan kirim foto input / prompt kesusilaan ke Sentry tanpa redaksi.
- Commit: kecil, satu topik. Jangan campur schema + UI acak.
