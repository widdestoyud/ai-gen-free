# Architecture Decision Records

Baca urut. Mencabut keputusan = ADR baru, jangan edit diam-diam.

| ID | Keputusan |
|---|---|
| [0001](./0001-monorepo-split-api.md) | Next.js hanya UI; API + worker terpisah |
| [0002](./0002-prisma.md) | Prisma + PostgreSQL |
| [0003](./0003-single-session.md) | Satu sesi login |
| [0004](./0004-job-concurrency-cooldown.md) | 1 job aktif; cooldown setelah sukses |
| [0005](./0005-generation-providers.md) | Port generate; Siray adapter v1 |
| [0006](./0006-auth-not-firebase.md) | OTP sendiri, bukan Firebase Auth |
| [0007](./0007-docker.md) | Docker Compose kanonik |
| [0008](./0008-credits-hold.md) | Ledger hold/capture |
| [0009](./0009-object-storage-port.md) | Port ObjectStorage; MinIO/S3/R2 via parameter |
| [0010](./0010-nextauth-session.md) | Cookie sesi browser = NextAuth; identity tetap di API |
| [0011](./0011-mantine-ui.md) | UI kit Mantine; tanpa style inline |
| [0012](./0012-adapter-only-provider-swap.md) | Ganti provider = adapter + env; presentation/job/wallet tidak berubah |
| [0013](./0013-separation-of-concerns-hooks.md) | SoC di Web: Custom Hooks sebagai Controller; prefix error A/B/C/D/E/W; transaction_id |
