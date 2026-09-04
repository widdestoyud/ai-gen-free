# Prisma

`schema.prisma` adalah sumber kebenaran tabel.

Index unik parsial **satu job aktif per user** belum selalu bisa dinyatakan di schema. Wajib ada di migrasi pertama:

```sql
CREATE UNIQUE INDEX job_one_active_per_user
ON "Job" ("userId")
WHERE status IN ('queued', 'running');
```

Tanpa index ini, dua tab bisa lolos race. Tes di `AGENTS.md` wajib merah jika index hilang.

Ledger: jangan `decrement` kolom poin. Lihat ADR 0002 dan `docs/domain/wallet.md`.
