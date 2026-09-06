# ai-gen-free

Platform generator web. Satu monorepo: `apps/web` (Next.js), `apps/api` (Fastify), `apps/worker`.

Baca dulu: [AGENTS.md](./AGENTS.md), [docs/product/program.md](./docs/product/program.md).  
Agen AI: patuhi `AGENTS.md` + `.kiro/steering/` (Kiro), `.grok/rules/` (Grok), `.cursor/rules/` (Cursor), `CLAUDE.md` (Claude). UI = Mantine; sesi browser = NextAuth.

## Jalan lokal

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:generate
docker compose up --build
```

Isi `.env`: `STORAGE_*` (R2/S3), `SMTP_*`, `SIRAY_API_TOKEN` di worker. Ganti provider = env/adapter, bukan rewrite UI (ADR 0012).

Postgres Docker, MinIO, Mailpit **opsional** (default: `DATABASE_URL` / `STORAGE_*` / `SMTP_*` di `.env`):

```bash
docker compose --profile postgres --profile minio --profile mailpit up --build
```

- Web (satu-satunya entry klien): http://localhost:3000
- Browser/Postman hanya `/api/...` di origin web. Fastify dan worker **tidak** dipublish ke host.
- Koleksi Postman: [`postman/`](./postman/)
- Mailpit (hanya jika profile `mailpit`): http://localhost:8025

Fase: M0 scaffold (saat ini) → M1 auth → M2 wallet → M3 jobs dummy → M4 Siray t2i → M5 admin.
