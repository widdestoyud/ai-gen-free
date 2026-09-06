---
inclusion: always
---

# Structure

```
apps/web          Next.js — Mantine; sesi via lib/auth-actions (adapter NextAuth terpisah)
apps/api          Fastify HTTP
apps/worker       BullMQ
packages/core     domain + ports
packages/db       Prisma
packages/wallet   ledger
packages/storage  ObjectStorage adapters
packages/providers-siray
prisma/           schema = sumber kebenaran data
docs/adr/         keputusan terkunci
aidlc/            SDLC slice
.kiro/steering/   Kiro
.grok/rules/      Grok
.cursor/rules/    Cursor
```

Ownership: FE hanya `apps/web`. BE tidak mengedit `apps/web`. Orchestrator tidak menulis kode produk.

Fitur baru: domain di `packages/core` → port → adapter → `apps/api` → `apps/web`.
