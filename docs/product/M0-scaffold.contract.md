# M0 contract

**Role:** SA

## Layout

```
apps/web          @ai-gen-free/web     Next.js 15, port 3000
apps/api          @ai-gen-free/api     Fastify, port 3001, prefix /api
apps/worker       @ai-gen-free/worker  Fastify health :3002 + BullMQ worker
packages/core     @ai-gen-free/core    error codes + ports
packages/db       @ai-gen-free/db      Prisma client
packages/providers-types
packages/providers-siray               stub; throws until M4
```

Package manager: **pnpm** workspaces. TypeScript strict. Node 22.

## HTTP (M0)

`GET /api/health` → `200 { ok: true, service: "api" }`  
`GET /api/ready` → `200` jika Postgres ping OK, else `503 { error: { code: "NOT_READY", message } }`  
`GET /health` on worker :3002 → `{ ok: true, service: "worker" }`

Error shape (semua fase berikutnya):

```json
{ "error": { "code": "STRING", "message": "human readable" } }
```

## Data

- Schema: `prisma/schema.prisma` (sudah ada).
- Migrasi awal wajib menyertakan:

```sql
CREATE UNIQUE INDEX job_one_active_per_user
ON "Job" ("userId")
WHERE status IN ('queued', 'running');
```

- Seed: `AppSetting.generate_cooldown_seconds = 43200`; admin users from `ADMIN_EMAILS`.

## Docker

- `migrate` runs `prisma migrate deploy` then seed, then exit 0.
- `api` waits for migrate + postgres + redis.
- `worker` waits for migrate + postgres + redis + minio.
- `web` waits for api (service_started cukup; ready dicek di UI).
- Browser memakai `http://localhost:3000` dan `http://localhost:3001` (port publish).

## File ownership

| Path | Owner |
|---|---|
| `apps/web/**` | FE |
| `apps/api/**`, `apps/worker/**`, `packages/**`, `prisma/**`, `docker-compose.yml` | BE |
| `docs/product/M0-*` | PO/SA (jangan diubah BE/FE kecuali status) |

## Tidak boleh di M0

- Endpoint auth/jobs/wallet
- Next.js Route Handler yang mutasi DB
- Memanggil Siray
