# GitHub milestones

Sumber kebenaran papan kerja. Buat milestone + issue yang sama di GitHub dengan `scripts/bootstrap-github.ps1` (butuh `gh`).

Wiki GitHub (jika diaktifkan) menyalin halaman dari `docs/wiki/`. Jangan andalkan wiki sebagai satu-satunya sumber: isi wiki bisa hilang; git tetap di `docs/`.

## M0 — Scaffold

**Goal:** `docker compose up` menyalakan postgres, redis, minio, mailpit. Monorepo kosong dengan paket yang terdaftar.

Issues:

- `M0-1` scaffold pnpm workspaces (`apps/web`, `apps/api`, `apps/worker`, `packages/*`)
- `M0-2` Dockerfile + service api/worker/web di Compose
- `M0-3` Prisma migrate job + seed admin email

## M1 — Auth

**Goal:** email OTP, sesi tunggal, admin Basic Auth + role.

Issues:

- `M1-1` [be] OTP + session cookie + revoke sesi lama
- `M1-2` [fe] layar login / OTP
- `M1-3` [be] gerbang `/admin` + seed `role=admin`
- `M1-4` [qa] tes login perangkat kedua menendang sesi pertama

## M2 — Wallet

**Goal:** ledger hold/capture/release; top up invoice admin.

Issues:

- `M2-1` [be] ledger + wallet lock
- `M2-2` [be] invoice unpaid → admin paid → topup
- `M2-3` [fe] saldo + riwayat + minta top up
- `M2-4` [qa] tidak ada decrement poin dari klien

## M3 — Jobs dummy

**Goal:** generate palsu di worker; refresh aman; 1 job aktif; cooldown setelah sukses.

Issues:

- `M3-1` [be] POST /jobs 202 + hold + mutex
- `M3-2` [be] worker dummy + capture/release + cooldown setting
- `M3-3` [fe] halaman job polling + gallery TTL copy
- `M3-4` [qa] dua tab, gagal tanpa cooldown, sukses dengan cooldown, idempotent capture

## M4 — Siray t2i

**Goal:** adapter Siray, port `GenerationProvider`, t2i nyata.

Issues:

- `M4-1` [sa] katalog model + mapping mode
- `M4-2` [be] `packages/providers-siray`
- `M4-3` [fe] form t2i + biaya dari katalog API
- `M4-4` [qa] worker tidak expose URL Siray sebagai satu-satunya salinan

## M5 — Admin + retensi

**Goal:** menu cooldown, konfirmasi bayar, hapus objek 14 hari.

Issues:

- `M5-1` [be] `app_settings` + cron/lifecycle 14 hari
- `M5-2` [fe] panel admin (di belakang Basic Auth)
- `M5-3` [qa] signed URL + user A tidak baca job B

## Label

`po` `sa` `be` `fe` `qa` `orch`  
`milestone:M0` … `milestone:M5`
