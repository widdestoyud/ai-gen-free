# QA — M0 scaffold

| Case | Result | Evidence |
|---|---|---|
| `GET /api/health` 200 | pass | `{"ok":true,"service":"api"}` |
| `GET /api/ready` 200 | pass | postgres ping |
| `GET :3002/health` 200 | pass | worker + queue waiting 0 |
| Web `http://localhost:3000` | pass | halaman memuat "Terhubung" |
| migrate apply | pass | `20260904120000_init` applied |
| web tidak import prisma/bullmq/siray | pass | grep hanya Dockerfile COPY package.json |
| core tidak import fastify/next/siray | pass | grep kosong |

Compose: api/worker healthy, web up. Mailpit/minio/postgres/redis up.
