# AGENTS.md — cara manusia dan AI melanjutkan proyek ini

Baca file ini **sebelum** menulis kode. Berlaku untuk Grok, Claude, Kiro, Cursor, Codex, atau agen lain.

Proyek ini adalah platform generator web (t2i / i2i / t2v / i2v, belakangan inpaint/face swap). Bahasa UI: Indonesia. Yurisdiksi operasional: Indonesia.

## Baca dulu, urut

1. `AGENTS.md` (file ini)
2. `docs/README.md` — peta dokumen
3. `docs/architecture.md` — sistem
4. `docs/adr/` — keputusan yang **sudah dikunci**
5. `prisma/schema.prisma` — sumber kebenaran data
6. `aidlc/README.md` — SDLC, orchestrator, PO/SA/BE/FE/QA
7. `docs/github/milestones.md` — papan M0–M5
8. `docs/catatan-risiko-hukum-platform.md` — batas produk, bukan nasihat hukum

Jangan mengarang ulang arsitektur. Jika ingin mengubah keputusan di `docs/adr/`, buat ADR baru yang mencabut yang lama. Jangan diam-diam menyimpang.

## Apa yang sudah dikunci

- Monorepo TypeScript. **Bukan** semua logika di Next.js.
- `apps/web` = UI Next.js. `apps/api` = HTTP. `apps/worker` = job panjang. `packages/core` = domain.
- Prisma + PostgreSQL.
- Antrian Redis + BullMQ.
- File lewat port `ObjectStorage` (MinIO lokal, R2/S3 produksi via `STORAGE_DRIVER`), TTL 14 hari.
- Poin: ledger + hold/capture/release. Klien tidak pernah memotong poin.
- Satu sesi login per user. Login baru mencabut sesi lama.
- Satu job aktif per user. Tab baru tidak boleh generate paralel.
- Sukses generate → cooldown (default 12 jam), **diatur admin**.
- Gagal generate → poin dilepas, cooldown tidak jalan, user boleh generate lagi.
- Provider generate: port + adapter. Adapter pertama: **Siray**. Adapter lain boleh ditambah tanpa mengubah job/wallet.
- Auth v1: email + OTP **bukan** Firebase Auth. Firebase boleh jadi adapter nanti, bukan default.
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
| O | Provider/storage baru = class baru + register, bukan `if (driver === ...)` di wallet/job |
| L | Setiap adapter memenuhi `GenerationProvider` / `ObjectStorage` tanpa syarat tersembunyi |
| I | Jangan paksa adapter video mengimplementasi t2i. Capability dinyatakan di provider |
| D | `apps/api` dan `apps/worker` bergantung pada port di `packages/core/ports`, bukan SDK Siray/S3 |

UI dan Route Handler Next.js **dilarang** memanggil SDK Siray, Prisma wallet mutation, atau BullMQ langsung. Mereka hanya HTTP ke `apps/api`.

## Yang tidak boleh dilakukan agen

- Menyimpan JWT access token di `localStorage`.
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
