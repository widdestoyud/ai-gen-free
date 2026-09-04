# ai-gen-free

Platform generator web. Satu monorepo: `apps/web` (Next.js), `apps/api` (Fastify), `apps/worker`.

Baca dulu: [AGENTS.md](./AGENTS.md), [docs/product/program.md](./docs/product/program.md).

## Jalan lokal

```bash
cp .env.example .env
corepack enable
pnpm install
pnpm db:generate
docker compose up --build
```

- Web: http://localhost:3000
- API health: http://localhost:3001/api/health
- Worker health: http://localhost:3002/health
- Mailpit: http://localhost:8025

Fase: M0 scaffold (saat ini) → M1 auth → M2 wallet → M3 jobs dummy → M4 Siray t2i → M5 admin.
