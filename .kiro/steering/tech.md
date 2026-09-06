---
inclusion: always
---

# Tech stack

Kanonik: `#[[file:AGENTS.md]]` `#[[file:docs/architecture.md]]` `#[[file:docs/adr/README.md]]`

- Monorepo pnpm/TypeScript. Docker Compose adalah jalur jalan.
- `apps/web` Next.js App Router — UI + BFF tipis. **Mantine**. Cookie browser **NextAuth (Auth.js v5)**.
- `apps/api` Fastify — OTP, wallet, jobs, admin.
- `apps/worker` BullMQ — provider, storage, capture/release.
- Prisma + PostgreSQL. Redis. Object storage port (`STORAGE_DRIVER`: r2/s3/minio).
- Email: `EmailPort` + SMTP env. Mailpit/MinIO hanya `compose --profile`, bukan default.
- Provider generate: port + adapter. Adapter v1 Siray, hanya di `packages/providers-siray`.
- Ganti provider = adapter + env. Jangan ubah halaman, layout, job, atau wallet (ADR 0012).

Jangan usulkan Firebase Auth, Prisma di Next.js, Tailwind sebagai sistem utama, hardcode MinIO/Mailpit di Compose, atau `import "next-auth"` di komponen UI.
